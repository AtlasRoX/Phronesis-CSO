"""neo4j_reason.py — open-source graph reasoning over the evidence graph.

A local-first graph reasoning stack built on Neo4j + Cypher (or, when Neo4j
isn't running, on the in-process Python reasoner in :mod:`prometheux_reason`).

**Why Neo4j + Cypher?** The four reasoning rules the paper needs
(``co_niche``, ``shares_axis``, ``strong_claim``, ``differentiates``) are
*graph patterns* — two-target recursion on a shared cell type, confidence-gated
claims, and asymmetric "A beats B on axis X" edges. Cypher expresses those
patterns more directly than the Vadalog surface (the four rules are pure Datalog
with no negation-as-failure or aggregates that would need special handling), and
Neo4j is the de-facto open-source graph engine with a permissive Apache-2.0
license. No hosted service, no SaaS token.

**Three execution paths, one ReasonResult shape:**

  1. **Neo4j live** (when ``NEO4J_URI`` is set and the driver imports) — facts
     are pushed to Neo4j with ``MERGE`` (idempotent), the four reasoning rules
     run as four separate Cypher queries (one per predicate, mirroring the
     ``@output`` separation in the Vadalog program), and the results come back
     as native rows with the same ``@model`` natural-language strings.
  2. **In-process Python** (default; no driver, no network) — falls back to
     :func:`prometheux_reason._reason_local` which evaluates the same four
     rules in 40 lines of pure Python.
  3. **Connection failure** — degrade to the Python reasoner and emit a one-line
     notice; never fabricate.

The ``ReasonResult`` shape returned by all three paths is identical, so callers
(:func:`prometheux_reason.reason`, :func:`prometheux_reason.rank_explanations`,
:func:`prometheux_reason.rank_targets`) are agnostic to which engine produced
the answer.

**Open-source only.** ``neo4j`` Python driver is Apache-2.0; Neo4j Community
Edition is GPLv3. No SaaS, no hosted reasoning, no third-party dep beyond the
official driver (optional — the module imports cleanly without it).

    python3 neo4j_reason.py --check              # is Neo4j reachable?
    NEO4J_URI=bolt://localhost:7687 python3 neo4j_reason.py   # use Neo4j
    python3 neo4j_reason.py                      # Python reasoner (default)
"""
from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from typing import Any

try:
    from . import kg as KG  # type: ignore
except ImportError:
    import kg as KG  # type: ignore

# Confidence gate for "strong" claim — must match prometheux_reason.STRONG_CONF so
# the Python and Cypher evaluators emit identical results.
try:
    from . import prometheux_reason as _pr  # type: ignore
except ImportError:
    import prometheux_reason as _pr  # type: ignore

STRONG_CONF = _pr.STRONG_CONF
ATOM_ID = _pr._atom_id  # reuse the existing escape helper


# --- Result shape (matches prometheux_reason.ReasonResult) ----------------- #
@dataclass
class ReasonResult:
    engine: str                       # "neo4j" | "python"
    derived: dict[str, list[tuple]]   # predicate -> list of fact tuples
    explanations: list[dict[str, Any]] = field(default_factory=list)

    def to_json(self) -> dict[str, Any]:
        return {"engine": self.engine,
                "derived": {k: [list(t) for t in v] for k, v in self.derived.items()},
                "explanations": self.explanations}


# --- Driver (lazy, optional) ----------------------------------------------- #
def _driver():
    """Return a live Neo4j driver, or None if Neo4j isn't configured / importable.

    Connection params come from env vars (Neo4j's standard):
      NEO4J_URI       bolt://localhost:7687 (default)
      NEO4J_USER      neo4j (default)
      NEO4J_PASSWORD  neo4j (default — set in production!)
    No-op (returns None) when the driver isn't installed or no URI is set.
    """
    # I7 fix: Settings (loaded from .env) is the canonical reader; the legacy
    # ``os.environ.get`` lines remain as a fallback for subprocesses and tests
    # that mutate env directly.
    from settings import get_settings
    _s = get_settings()
    uri = _s.neo4j_uri or os.environ.get("NEO4J_URI")
    if not uri:
        return None
    try:
        from neo4j import GraphDatabase  # type: ignore
    except ImportError:
        return None
    try:
        return GraphDatabase.driver(
            uri,
            auth=(_s.neo4j_user, _s.neo4j_password.get_secret_value()),
        )
    except Exception:
        return None


def is_available() -> bool:
    """Quick reachability check — opens and closes a session, returns True on success."""
    drv = _driver()
    if drv is None:
        return False
    try:
        with drv.session() as s:
            s.run("RETURN 1").single()
        return True
    except Exception:
        return False


# --- Sync the property graph into Neo4j ----------------------------------- #
# We push facts as (:Target {id})-[:EXPRESSED_IN {conf}]->(:CellType) and
# (:Target {id})-[:EVIDENCE_ON {axis, conf}]->(:Axis). Reasoning rules are pure
# Cypher pattern matches, so the four @output predicates each become one MATCH.
_CYPHER_CONSTRAINTS = [
    # Idempotent uniqueness constraints — safe to re-run on every push.
    "CREATE CONSTRAINT IF NOT EXISTS FOR (n:Target)  REQUIRE n.id IS UNIQUE",
    "CREATE CONSTRAINT IF NOT EXISTS FOR (n:CellType) REQUIRE n.id IS UNIQUE",
    "CREATE CONSTRAINT IF NOT EXISTS FOR (n:Disease) REQUIRE n.id IS UNIQUE",
    "CREATE CONSTRAINT IF NOT EXISTS FOR (n:Tissue)  REQUIRE n.id IS UNIQUE",
    "CREATE CONSTRAINT IF NOT EXISTS FOR (n:Trial)   REQUIRE n.id IS UNIQUE",
    "CREATE CONSTRAINT IF NOT EXISTS FOR (n:Modality) REQUIRE n.id IS UNIQUE",
]

_CYPHER_PUSH_TARGET = (
    "MERGE (t:Target {id: $id}) SET t.label = $label"
)
_CYPHER_PUSH_EXPRESSED = (
    "MATCH (t:Target {id: $t}), (c:CellType {id: $c}) "
    "MERGE (t)-[r:EXPRESSED_IN]->(c) SET r.conf = $conf"
)
_CYPHER_PUSH_EVIDENCE = (
    "MATCH (t:Target {id: $t}), (a:Axis {name: $ax}) "
    "MERGE (t)-[r:EVIDENCE_ON]->(a) SET r.conf = $conf"
)


def _ensure_axis(session, name: str) -> None:
    """MERGE an Axis node by name — the MATCH clauses reference it."""
    session.run("MERGE (:Axis {name: $name})", name=name)


def _sync_graph(session, graph: KG.KnowledgeGraph) -> None:
    """Push every Target, CellType, and evidence-bearing edge into Neo4j.

    EXPRESSED_IN edges become (:Target)-[:EXPRESSED_IN {conf}]->(:CellType).
    Every other evidence-bearing edge (axis != None) becomes
    (:Target)-[:EVIDENCE_ON {axis, conf}]->(:Axis). We don't push structural
    edges (TARGETS, VIA_MODALITY) — they're hypothesis scaffolding, not facts
    the reasoner reasons over.
    """
    for stmt in _CYPHER_CONSTRAINTS:
        session.run(stmt)

    # First pass: collect all distinct axes so each gets a single MERGE.
    axes: set[str] = set()
    celltype_ids: set[str] = set()
    target_ids: set[str] = set()
    expressed_rows: list[tuple[str, str, float]] = []
    evidence_rows: list[tuple[str, str, float]] = []
    for n in graph.nodes.values():
        if n.get("kind") == "Target":
            target_ids.add(n["id"])
        elif n.get("kind") == "CellType":
            celltype_ids.add(n["id"])
    for e in graph.edges.values():
        s = _ATOM_ID(e["s"])
        t = _ATOM_ID(e["t"])
        conf = float(e.get("conf") or 0.0)
        if e["type"] == "EXPRESSED_IN" and s in target_ids and t in celltype_ids:
            expressed_rows.append((s, t, conf))
            continue
        axis = e.get("axis")
        if axis and axis != "evidence" and s in target_ids:
            axes.add(axis)
            evidence_rows.append((s, axis, conf))

    for ax in axes:
        _ensure_axis(session, ax)
    for tid in target_ids:
        node = graph.nodes[tid]
        session.run(_CYPHER_PUSH_TARGET, id=tid, label=node.get("label", tid))
    # CellType nodes are referenced in MATCH but never produced edges; they don't
    # need MERGE themselves because the relationship merge auto-creates endpoints.
    for s, c, conf in expressed_rows:
        session.run("MERGE (:CellType {id: $c})", c=c)
        session.run(_CYPHER_PUSH_EXPRESSED, t=s, c=c, conf=conf)
    for s, ax, conf in evidence_rows:
        session.run(_CYPHER_PUSH_EVIDENCE, t=s, ax=ax, conf=conf)


# --- The four reasoning rules as Cypher ----------------------------------- #
# Each rule mirrors one of the Vadalog predicates and returns its derived rows
# as (A, B) or (T, Ax) tuples identical to the Python reasoner's output.
_CYPHER_RULES: dict[str, str] = {
    "co_niche": (
        # Two targets sharing a cell-type niche: there is a CellType C such that
        # both targets have an EXPRESSED_IN edge to C, and A != B.
        "MATCH (a:Target)-[:EXPRESSED_IN]->(c:CellType)<-[:EXPRESSED_IN]-(b:Target) "
        "WHERE a.id < b.id "
        "RETURN a.id AS a, b.id AS b"
    ),
    "shares_axis": (
        # Two targets carrying evidence on the same axis (any confidence).
        "MATCH (a:Target)-[:EVIDENCE_ON]->(ax:Axis)<-[:EVIDENCE_ON]-(b:Target) "
        "WHERE a.id < b.id "
        "RETURN a.id AS a, b.id AS b, ax.name AS ax"
    ),
    "strong_claim": (
        # A target with confidence >= STRONG_CONF on some axis.
        "MATCH (t:Target)-[r:EVIDENCE_ON]->(ax:Axis) "
        "WHERE r.conf >= $strong_conf "
        "RETURN t.id AS t, ax.name AS ax"
    ),
    "differentiates": (
        # A beats B on axis Ax: A is strong on Ax and B is weak on Ax.
        "MATCH (a:Target)-[ra:EVIDENCE_ON]->(ax:Axis), "
        "      (b:Target)-[rb:EVIDENCE_ON]->(ax) "
        "WHERE ra.conf >= $strong_conf AND rb.conf < $strong_conf AND a.id <> b.id "
        "RETURN a.id AS a, b.id AS b, ax.name AS ax"
    ),
}


def _build_explanations(derived: dict[str, list[tuple]]) -> list[dict[str, Any]]:
    """Generate the same ``@model`` natural-language strings the Vadalog engine
    produced — one entry per derived fact, so the report / UI gets an
    explain-a-rank chain identical in shape to the hosted-engine path.
    """
    out: list[dict[str, Any]] = []
    short = _pr._short
    for a, b in derived.get("co_niche", []):
        out.append({"fact": f"co_niche({a}, {b})",
                    "nl": f"{short(a)} and {short(b)} occupy a shared cell-type niche"})
    for t, ax in derived.get("strong_claim", []):
        out.append({"fact": f"strong_claim({t}, {ax})",
                    "nl": f"{short(t)} has strong evidence on the {ax} axis "
                          f"(confidence >= {STRONG_CONF})"})
    for a, b, ax in derived.get("differentiates", []):
        out.append({"fact": f"differentiates({a}, {b}, {ax})",
                    "nl": f"{short(a)} ranks over {short(b)} on {ax}: "
                          f"{short(a)} has a strong claim there, {short(b)} does not"})
    return out


def _reason_neo4j(graph: KG.KnowledgeGraph) -> ReasonResult:
    """Run the four rules over the graph in Neo4j.

    Syncs the property graph into the database, then runs one Cypher per rule.
    The driver connection is opened and closed in this function so a long-lived
    server doesn't keep a session open between calls.
    """
    drv = _driver()
    if drv is None:
        raise RuntimeError("Neo4j driver unavailable")
    derived: dict[str, list[tuple]] = {
        "co_niche": [], "shares_axis": [], "strong_claim": [], "differentiates": [],
    }
    try:
        with drv.session() as session:
            _sync_graph(session, graph)
            for pred, query in _CYPHER_RULES.items():
                result = session.run(query, strong_conf=STRONG_CONF)
                for record in result:
                    # Each predicate has a fixed arity: 2 / 3 / 2 / 3 keys.
                    keys = list(record.keys())
                    derived[pred].append(tuple(record[k] for k in keys))
    finally:
        drv.close()
    return ReasonResult("neo4j", derived, _build_explanations(derived))


# --- Public entrypoint ----------------------------------------------------- #
def reason(graph: KG.KnowledgeGraph | None = None, *,
           prefer: str = "auto") -> ReasonResult:
    """Compile the graph and reason over it.

    ``prefer``:
      * ``"auto"`` (default) — use Neo4j if it's reachable; fall back to the
        in-process Python reasoner otherwise. Never fabricates; never errors on
        a missing engine.
      * ``"neo4j"`` — force Neo4j; raise if it's unreachable.
      * ``"python"`` — force the in-process reasoner (no Neo4j, no network).

    Returns a :class:`ReasonResult` whose shape matches
    :class:`prometheux_reason.ReasonResult` so callers stay engine-agnostic.
    """
    graph = graph or KG.KnowledgeGraph()
    if prefer in ("auto", "neo4j") and _driver() is not None:
        try:
            return _reason_neo4j(graph)
        except Exception as exc:  # noqa: BLE001 — degrade, never fabricate
            if prefer == "neo4j":
                raise
            print(f"[neo4j] live reasoning unavailable ({exc}); using python fallback")
    # Local fallback (the in-process Python reasoner — same rules, same shapes).
    return _pr._reason_local(_pr.graph_to_vada(graph))


# --- CLI ------------------------------------------------------------------- #
def main(argv: list[str] | None = None) -> int:
    import argparse
    from pathlib import Path
    p = argparse.ArgumentParser(description=(
        "Neo4j-backed reasoning over the CSO evidence graph. "
        "Falls back to in-process Python when Neo4j isn't reachable."))
    p.add_argument("--store", type=Path, default=KG.STORE, help="kg.json to reason over")
    p.add_argument("--prefer", choices=["auto", "neo4j", "python"], default="auto")
    p.add_argument("--check", action="store_true", help="just check Neo4j reachability")
    p.add_argument("--json", action="store_true", help="emit JSON")
    args = p.parse_args(argv)

    if args.check:
        print("neo4j: reachable" if is_available() else "neo4j: not reachable")
        return 0 if is_available() else 1

    graph = KG.KnowledgeGraph(store=args.store)
    if not graph.edges:
        print(f"[neo4j] no graph at {args.store} — run the CSO loop first to build one")
        return 1

    result = reason(graph, prefer=args.prefer)
    if args.json:
        print(json.dumps(result.to_json(), indent=2))
        return 0
    print(f"engine: {result.engine}")
    for pred, rows in result.derived.items():
        print(f"\n{pred} ({len(rows)}):")
        for r in rows:
            print("  " + ", ".join(map(str, r)))
    print("\nexplanations:")
    for e in result.explanations:
        print(f"  • {e['nl']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
