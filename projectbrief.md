# 🧬 Phronesis CSO — Full Codebase Project Brief

> **One-page-and-then-some brief** so any AI (or human) can understand the entire
> `A:\future ai hackssss` codebase in seconds.
>
> **Tagline:** *"The Virtual Chief Scientific Officer — A Multi-Agent AI That
> Nominates Drug Targets and Shows Its Work."*

---

## 0. TL;DR

`Phronesis CSO` (a.k.a. `virtual-biotech-cso`, `vbcso`) is a **multi-agent AI
system that nominates drug targets and shows its work**, that operationalizes the Stanford
*"Virtual Biotech"* paper (Zhang et al. 2026, bioRxiv
`10.64898/2026.02.23.707551`).

* **Problem solved.** 9/10 clinical drug programs fail, mostly because the
  *target* was picked wrong. Target prioritization is the most expensive
  decision in pharma R&D. CSO collapses the 6–12 month expert review into
  a **6-minute cited, replayable assessment** ending in a formal
  **GO / CONDITIONAL_GO / REVIEW / NO_GO** verdict.
* **Three layers stack:**
  1. **Agentic loop** — `harness.py` driving Chief-of-Staff → CSO → 4
     scientific divisions → 4-lens Reviewer Panel → CSO Synthesis.
  2. **Deterministic ClawBio skills** — GWAS Catalog, CELLxGENE, Open
     Targets, openFDA, ClinicalTrials.gov, TCGA (NCI GDC), Tavily.
  3. **Formal deductive reasoning** — Prometheux Vadalog engine
     (`prometheux_reason.py`) emits the verdict via `@explain` rules +
     a **non-silenceable structural gap-detector**.


---

## 1. Repository Map

```
A:\future ai hackssss\
├── README.md            # main landing doc (21KB)
├── pyproject.toml       # name=phronesis-cso, Python ≥3.12
├── package.json         # agentation-mcp, shiki  (frontend tooling)
├── pnpm-workspace.yaml  # stub config
├── .env.example         # all env vars documented
├── .mcp.json            # local stdio MCP: dataset-projection
├── .gitignore           # excludes .venv, output/, .env, *.h5ad…
├── .python-version      # 3.12
├── cited.md             # **published** cited report (paywalled artifact)
├── cited.payment.json   # x402 payment manifest for cited.md
├── publish_cited.py     # mints cited.md + cited.payment.json
├── uv.lock              # python lockfile
├── skills/              # ── THE LIBRARY ──
│   ├── phronesis-cso/                 # ★ orchestrator (CSO)
│   ├── celltype-specificity-profiler/ # ★ new skill (PR #1)
│   ├── cellxgene-fetch/
│   ├── clinical-trial-finder/
│   ├── dataset-projection/            # ★ MCP server + Vadalog binder
│   ├── frontend-design/               # design constitution only
│   ├── lit-synthesizer/
│   ├── malignant-expression-profiler/
│   ├── openfda-safety/
│   ├── opentargets-association-evidence/
│   ├── opentargets-target-factors/
│   ├── tcga-somatic-profiler/
│   └── (test data, prompts, kg.json, demo_data/)
├── frontend/                          # ── THE WEB UI ──
│   ├── server.py         # python http.server + ThreadingHTTPServer (SSE)
│   ├── index.html        # /app & /console react mount point
│   ├── app.jsx           # JSX source
│   ├── app.js            # pre-compiled JS (Babel-offline)
│   ├── x402.py           # 402 Payment gate for cited.md
│   ├── build.py          # JSX→JS via headless Chrome (no Node)
│   ├── vendor/           # react, react-dom, tailwind, babel, agentation
│   ├── assets/           # hero.png, logo-mark.png, decision-card.png
│   ├── site/             # /, /schematic (static marketing pages)
│   └── tests/
├── tests/
│   └── test_prometheux_reason.py     # 18 cases for Vadalog reasoning
├── docs/                # ── THE NARRATIVE ──  (12 design docs)
│   ├── PROJECT.md, SPONSORS.md, ENVIRONMENT.md
│   ├── deferred-skills.md, evidence-gap-analysis.md
│   ├── expert-gaps-review.md, agentic-workflow-ideas.md
│   ├── agentic-hypothesis-optimization.md
│   ├── ai-scientist-landscape-review.md
│   ├── kg-pareto-provenance-design.md
│   ├── loom-script-3min.md, loom-slides.md
│   ├── prometheux-evidence-graph-applicability.md
│   └── target-arena-research.md
├── data/                # small test fixtures (pbmc3k.h5ad, README.md)
├── workflows/
│   └── b7h3_adc_nomination.md         # demo case study walkthrough
├── output/              # 8 timestamped run outputs (gitignored)
│   ├── report.md, result.json         # top-level clinical-trial-finder run
│   ├── gwas_*/  crispr-triage_*/  equity_*/
│   └── reproducibility/
├── output_demo/         # one demo run of the multi-agent loop
│   ├── report.md, result.json
│   ├── trace.jsonl, run_decision.facts.csv
│   └── reproducibility/
├── output/result.json   # demo orchestrator result (decision=REVIEW)
├── output_demo/run_decision.facts.csv  # header-only (no facts emitted in demo)
├── .gemini/update_docs.py  # regenerates 10 docs from canonical templates
├── .pytest_cache/  .venv/  node_modules/
├── .mcp.json        # 1 stdio MCP server: dataset-projection
└── projectbrief.md  # ★ THIS FILE
```

---

## 2. Stack & Dependencies

### Python (`pyproject.toml`)

* **Name:** `phronesis-cso` (v0.1.0)
* **Python:** `>=3.12` (matches `.python-version`)
* **Build backend:** `hatchling` → wheel packages `skills/`
* **Pytest:** `testpaths = ["skills", "tests"]`

#### Mandatory deps
| Package | Constraint | Purpose |
|---|---|---|
| `scanpy` | `>=1.10` | Single-cell transcriptomics |
| `anndata` | `>=0.10` | Annotated single-cell data storage |
| `numpy` | `>=1.26` | Numerical calculations |
| `scipy` | `>=1.13` | Scientific computations |
| `pandas` | `>=2.2` | Dataframes processing |
| `pyyaml` | `>=6.0` | Configuration parser |
| `clawbio` | `>=0.5.2` | Bioinformatics tools runner |
| `pydantic` | `>=2.7` | Typed JSON contract validation (I1) |
| `pydantic-settings` | `>=2.3` | Centralized settings management (I7) |
| `tenacity` | `>=8.3` | Exponential backoff retry policy (I2) |
| `httpx` | `>=0.27` | Connection-pooled HTTP client (I3) |
| `diskcache` | `>=5.6` | In-process file stats graph cache (I6) |
| `structlog` | `>=24.1` | Structured JSON log format (I5) |

#### Optional extras
| Extra | Packages | Purpose |
|---|---|---|
| `agents` | `anthropic>=0.40`, `openai>=1.40` | live multi-agent loop |
| `tracing` | `langfuse>=4.0` | Langfuse span mirror (SDK v4 API) |
| `reasoning` | `neo4j>=5.0` | local-first graph database and Cypher reasoning |
| `mcp` | `mcp>=1.2` | local stdio MCP server |
| `dev` | `pytest>=8.0`, `pytest-asyncio>=0.23`, `ruff>=0.6`, `pyright>=1.1` | test, lint + type check |

### JS (`package.json`)
```json
"dependencies": {
  "agentation-mcp": "^1.2.0",
  "shiki":            "^4.3.1"
},
"devDependencies": {
  "agentation": "^3.0.2"
}
```
No `scripts` block. `pnpm-workspace.yaml` is a stub:
```yaml
allowBuilds:
  better-sqlite3: set this to true or false
```

### Tooling
* `uv` / `pip` (venv), `pnpm`, `pytest`, `ruff`, `hatchling`
* **Headless Chrome** (called by `frontend/build.py`) for JSX→JS compilation
  — no Node toolchain needed.

---

## 3. Environment Variables (Centralized in `settings.py`)

### LLM Providers & Models
| Var | Default | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | Primary backend key |
| `ANTHROPIC_MODEL` | `claude-sonnet-4-6` | Anthropic model override |
| `ANTHROPIC_TIMEOUT_S` | `180.0` | Request timeout in seconds |
| `NVIDIA_API_KEY` | — | NVIDIA NIM developer key |
| `NIM_MODEL` | `nvidia/nemotron-3-super-120b-a12b` | NIM model override |
| `OPENAI_API_KEY` | — | OpenAI developer key |
| `OPENAI_MODEL` | `gpt-4o-mini` | OpenAI model override |
| `OPENAI_BASE_URL` | — | Custom OpenAI gateway endpoint |
| `GEMINI_API_KEY` / `GOOGLE_API_KEY` | — | Google Gemini endpoint key |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Gemini model override |
| `VBIO_MODEL` | — | Global model override flag |

### Logic Reasoning Engines
| Var | Default | Purpose |
|---|---|---|
| `PMTX_TOKEN` | — | Prometheux Vadalog SaaS authentication |
| `JARVISPY_URL` | — | JarvisPy compute machine endpoint routing URL |
| `NEO4J_URI` | `bolt://localhost:7687` | Bolt connection URI to local Neo4j graph db |
| `NEO4J_USER` | `neo4j` | Local Neo4j instance username |
| `NEO4J_PASSWORD` | `neo4j` | Local Neo4j instance password |

### External Integrations & Datasets
| Var | Default | Purpose |
|---|---|---|
| `TAVILY_API_KEY` | — | Live web search (lit-synthesizer); bypassed in `--demo` |
| `PRIMEKG_CSV_URL` | `https://raw.githubusercontent.com/...` | Source location of PrimeKG CSV file |

### Observability & Logs
| Var | Default | Purpose |
|---|---|---|
| `LANGFUSE_PUBLIC_KEY` | — | Langfuse project public token |
| `LANGFUSE_SECRET_KEY` | — | Langfuse project secret token |
| `LANGFUSE_HOST` | — | Langfuse host URL (defaults to Cloud) |
| `LOG_LEVEL` | `INFO` | Filter severity below this level |
| `LOG_JSON` | `False` | Force structured JSON format (default: on when redirected) |

### Server Rate Limiting & CORS (frontend `server.py`)
| Var | Default | Purpose |
|---|---|---|
| `RATE_LIMIT_PER_MIN` | `60` | Request budget rate per minute per IP |
| `RATE_LIMIT_BURST` | `5` | Request token capacity per IP bucket |
| `RATE_LIMIT_CONCURRENT` | `4` | Cap on simultaneous SSE runs |
| `CORS_ALLOW_ORIGIN` | `*` | CORS origin rule wildcard or list |
| `CORS_ORIGIN_ALLOWLIST` | — | CSV list of origins if CORS_ALLOW_ORIGIN=list |
| `CORS_MAX_AGE_S` | `600` | Access-Control-Max-Age cache window in seconds |

### Monetisation Gate (frontend `x402.py`)
| Var | Purpose |
|---|---|
| `X402_PAY_TO` | Wallet destination address for paid reports |
| `X402_NETWORK` | Target payment blockchain network (e.g. XRPL, Solana) |
| `X402_FACILITATOR_URL` | Endpoint of the facilitator verifying TX hashes |

---

## 4. MCP Servers (`.mcp.json`)

```json
{
  "mcpServers": {
    "dataset-projection": {
      "command": ".venv/bin/python",
      "args": ["skills/dataset-projection/mcp_server.py"]
    }
  }
}
```
Local stdio MCP server; exposes `project_single_cell_facts`. Activated when
`mcp>=1.2` extra installed.

---

## 5. THE ORCHESTRATOR — `skills/phronesis-cso/`

### 5.1 Files
```
phronesis-cso/
├── cso.py              # orchestrator core (65 KB) — produces bundles
├── harness.py          # agent loop (57 KB) — drives cso via runners; structlog integration
├── kg.py               # canonical KnowledgeGraph (typed entities + edges) with diskcache support
├── kg.json             # persistent graph (27 KB)
├── resolver.py         # Open Targets mapIds; disease→EFO expansion; httpx client
├── routing.yaml        # intent → skill map (4 divisions)
├── runners.py          # Anthropic / OpenAI / NIM / Gemini / Claude-CLI / Stub; tenacity backoff retry
├── prometheux_reason.py# ★ Vadalog decision engine (49 KB)
├── neo4j_reason.py     # ★ Local Neo4j + Cypher reasoning fallback (Alternative Engine)
├── schemas.py          # ★ Pydantic v2 typed JSON contracts for LLM payloads
├── settings.py         # ★ Centralized Pydantic-Settings singleton configuration
├── primekg_enrich.py   # ★ PrimeKG context-only edge propagation
├── tracing.py          # OTel-style spans; optional Langfuse v4 mirror
├── SKILL.md            # manifest (20 KB)
├── demo_data/b7h3/     # 8 JSON fixtures (briefing, review, step_01..06, synthesis)
├── prompts/            # chief_of_staff.md, orchestrator.md, reviewer.md, division_scientist.md
└── tests/              # in-skill pytest cases (including test_kg_cache.py)
```

### 5.2 The agentic loop (Chief-of-Staff → CSO → 4 divisions → Reviewer → Synthesis)
```
query
  ↓
Chief-of-Staff briefing          (chief_of_staff.md)
  ↓
CSO Planner                      (orchestrator.md)
  ↓
Division Scientists (parallel):
  ├─ target_id_and_prioritization   → gwas-lookup, opentargets-association-evidence,
  │                                 → malignant-expression-profiler, tcga-somatic-profiler,
  │                                 → crispr-screen-triage
  ├─ target_safety                  → openfda-safety, opentargets-target-factors
  ├─ modality_selection             → opentargets-target-factors
  ├─ literature_and_landscape       → lit-synthesizer (Tavily)  ← re-route target
  └─ clinical_officers              → clinical-trial-finder, openfda-safety
  ↓
Reviewer Panel (4 lenses): safety, genetics, specificity, clinical
  • ≥ 2 votes → re-route (cap MAX_REROUTES = 3)
  • ★ Prometheux structural-gap is a non-silenceable 5th panel member
  • Forcing gap always wins (`forced_by_engine: true`)
  ↓
(loop bounded by DEFAULT_TOKEN_BUDGET = 60,000)
  ↓
CSO Synthesis → prometheux_reason.decide_from_evidence() → final verdict
```

### 5.3 The 4 evidence axes
| Axis | Weight source | Grading |
|---|---|---|
| 🎯 `target_validity` | GWAS · CRISPR · somatic signal | strong / supporting / suggestive / absent |
| 🔬 `specificity` | Cell-type tau · malignant localisation | strong / supporting / suggestive / absent |
| 🛡️ `safety` | openFDA · OT liabilities | strong → hard gate (any strong safety liability caps verdict at REVIEW) |
| 💊 `tractability` | Clinical precedent · modality · literature | strong / supporting / suggestive / absent |

### 5.4 Decision tiers
| Tier | Score | Condition |
|---|---|---|
| ✅ `GO` | ≥ 3.0 | + strong safety |
| 🟡 `CONDITIONAL_GO` | ≥ 2.0 | + safety covered |
| 🔄 `REVIEW` | < 2.0 | or weak coverage |
| ❌ `NO_GO` | — | Prolog rule `unsafe_advance` fires (strong claim + zero safety read) |

### 5.5 Grade weights (`GRADE_WEIGHT` in `prometheux_reason.py`)
```python
GRADE_WEIGHT = {"strong": 1.0, "supporting": 0.5, "suggestive": 0.25, "absent": 0.0}
REQUIRED_AXES = ("target_validity", "specificity", "safety", "tractability")
GO_THRESHOLD = 3.0
CONDITIONAL_THRESHOLD = 2.0
```
Safety axis is a **hard gate** — any strong safety liability caps verdict at `REVIEW`.

### 5.6 Prometheux Vadalog engine (`prometheux_reason.py`)
* **49 KB module** with full Datalog/Vadalog compiler + local fallback
  evaluator (no Neo4j server required for offline).
* Key rules: `co_niche(A, B)`, `differentiates(A, B, Ax)`, `@explain("console")`,
  `weak_axis/strong_axis`, `unsafe_advance` (safety hard-gate).
* **Confidence gating:** specificity ≥ 0.8 → "strong" claim edge.
* **Gap detector:** `gaps_from_evidence(results, target)` →
  `{forced: [...], not_forcing: [...]}`; binds to *real* skills in
  `routing.yaml` (e.g. `routes["safety"] == "openfda-safety"`).
* **Rank module:** `rank_targets(graph)` builds a leaderboard with
  `wins_on` axis and "ranks over" explanations.
* **Decision module:** `decide_from_evidence(edges, factors)` → `{tier, score,
  max_score=4.0, axes, absent_axes, explanation, facts}`.
* **Neo4j Cypher Reasoning fallback (`neo4j_reason.py`):** Local graph reasoning implementation running recursive patterns (`co_niche`, `shares_axis`, `strong_claim`, `differentiates`) directly on a local Neo4j instance using Cypher when `NEO4J_URI` is provided, returning an identical `ReasonResult` contract.

### 5.7 Runners & Schema Contracts (`runners.py`, `schemas.py`)
* `select_runner(backend, model)` returns one of `AnthropicRunner`, `OpenAIRunner`, `NIMRunner`, `GeminiRunner`, `ClaudeCLIRunner`, or `StubRunner`.
* **LLM Output Validation (`schemas.py`):** Validates all agent outputs (Briefing, Plan, Reviewer, synthesis) using Pydantic v2 schemas at the boundary (`parse_llm`), catching bad shapes early.
* **Tenacity HTTP Retry Policy:** Calls are wrapped by `run_with_retry` implementing exponential-backoff retries (up to 5 attempts, max 30s) on connection timeouts, rate-limits (HTTP 429), and malformed JSON decodes.
* `.env` loaded walking up parents; existing env vars win.

### 5.8 Knowledge Graph with mtime Caching (`kg.py`)
* Canonical entity IDs: `<kind>:<slug>` for {gene, disease, drug, cell_type, dataset, trial, paper, factor, axis, verdict}. Edges carry `provenance`, `grade`, `confidence`, `method`, `timestamp`. Persisted to `kg.json`.
* **In-process Cache (`diskcache`):** Caches graph parses across runs. Uses the file's `mtime_ns` and `size` (inode metadata) as the cache key, enabling automatic cache invalidation on any `commit()` file writes.

### 5.9 Tracing & Structured Logging (`tracing.py`, `harness.py`, 15 KB)
* `TraceRecorder` writes `trace.jsonl` — **OpenTelemetry-style spans** with `run_id` / `span_id` / `parent_id` / `kind` / `status` / `started_at` / `duration_ms` / `usage` / `attrs` / `error`. Optional Langfuse mirror via SDK v4; no-op without keys.
* **Structured Logging (structlog):** Emits structured events to stderr. Outputs JSON formats for log shippers in production and colorized box-drawing lines on interactive TTY stdout.
* Reviewer emits **NUMERIC scores** per axis + CATEGORICAL `reviewer.verdict` with `reroute_votes` and `forced_by_engine` flags.

### 5.10 Demo data (`demo_data/b7h3/`)
8 JSON fixtures: `briefing.json`, `review.json`, `step_01.json` … `step_06.json`,
`synthesis.json`. The B7-H3 ADC case study.

### 5.11 Routing map (`routing.yaml`)
Six divisions, each list of `skill:` + optional `also:`, `consumes:`,
`note:`, and `reroute_target: true` flag for lit re-route:
* `target_id_and_prioritization`
* `target_safety`
* `modality_selection`
* `literature_and_landscape` (re-route target)
* `clinical_officers`
* `equity_heim`

---

## 6. THE FRONTEND — `frontend/`

### 6.1 Stack
* **Browser:** React 18 (classic `React.createElement` runtime) + Tailwind
  (both vendored); Babel-standalone only at *build* time.
* **No build toolchain** — headless Chrome compiles JSX→JS via vendored
  `vendor/babel.js` (see `build.py`).
* **Backend:** Python stdlib `http.server` + `ThreadingHTTPServer`
  (no Flask/FastAPI) — chosen so the whole project runs anywhere.
* **Fonts:** Phosphor-Bold icon font (CDN), Google Sans, JetBrains Mono.
* **Streaming:** native `EventSource` (SSE).
* **No external libs** for graph viz — hand-written SVG radial layout.

### 6.2 Vendor (offline-friendly)
```
vendor/
├── react.js       (10 KB)
├── react-dom.js   (132 KB)
├── tailwind.js    (276 KB)
├── babel.js       (2.4 MB)  — used only at build time
└── agentation.js  (708 KB)
```

### 6.3 Routes (`server.py`, 30 KB)
| Method | Path | Purpose |
|---|---|---|
| GET | `/` / `/app` / `/console` / `/schematic` | static HTML |
| GET | `/api/run` | **SSE stream** of the multi-agent loop |
| POST | `/api/decision?run_id=…` | HITL decision delivery |
| GET | `/api/ledger` | accumulated evidence across all runs |
| GET | `/api/ranking` | Prometheux `rank_targets` + explanations |
| GET | `/api/report` | **x402 payment-gated cited.md** |

`/api/run` query-string flags:
* `query=…` — required
* `demo=1` — cached offline fixtures
* `live=1` — routed skills execute live
* `agents=1`/`0` — also drives LLM selection
* `partial=1` — skip safety step (forces re-route)
* `hitl=1` — pause at each reviewer pass for human input
* `token_budget=N` — `0 = core only`, `30000 = balanced`, `60000 = thorough`

### 6.4 SSE event vocabulary (consumed by `reduceEvent` in `app.jsx`)
`start`, `phase`, `briefing`, `plan`, `evidence`, `node`, `edge`,
`engine_gaps`, `panel`, `division_finding`, `review`, `checkpoint_wait`,
`checkpoint_resolved`, `synthesis`, `decision`, `done`, `error`.

### 6.5 UI components (all in `app.jsx` / compiled to `app.js`)
* **Layout:** `App`, `QueryScreen`, `CheckpointModal`, `Sidebar`, `Header`
* **Run tabs:**
  * **Loop trace** — `LoopTrace` (Process flow ↔ Timeline toggle), `LoopGraph`
    (full SVG), `FlowNode`, `LoopStep`, `PrometheuxDecision`
  * **Evidence graph** — `GraphView`, `EvidenceGraphSVG` (radial layout;
    shared-runs amber dashed ring; PrimeKG dashed edges), `GraphInspector`
  * **Evidence ledger** — `LedgerView`
  * **Report** — `Report`, `ReportOverview`, `AxisEvidence`
* **Primitives:** `Chip`, `Panel`, `Stat`
* **Icon set:** `Icons` → Phosphor-Bold CSS font via CDN
* **Provenance legend:** 🗄️ retrieved · 🔧 computed · 🌐 web · 🧬 PrimeKG · ⚪ gap

### 6.6 React reducer pattern
Pure `reduceEvent(run, ev, data)` over SSE events → immutable run state.
`esRef = useRef(null); runRef = useRef(run);` to defeat stale closures.
Server is the source of truth (persistent `KG` in `server.py`,
dumped to `frontend/kg.json`).

### 6.7 Token budgets (`BUDGETS`)
`focused` = 0 · `balanced` = 30 000 · `thorough` = 60 000.

### 6.8 The build process (`build.py`)
1. Read `frontend/app.jsx` source.
2. Write a tiny HTML harness loading `vendor/babel.js` and dumping
   `Babel.transform(SRC, {presets: [["react", {runtime:"classic"}]]}).code`
   into `<pre id="out">`.
3. `chrome --headless --dump-dom` reads the harness, regex-parses the
   `<pre>`, writes compiled code to `frontend/app.js`.
4. Run: `python3 frontend/build.py` (only when `app.jsx` changes).

### 6.9 x402 Payment gate (`x402.py`, 5.5 KB)
* `GET /api/report` with no payment → **HTTP 402** with `accepts` block,
  `x402Version: 1`, scheme=`exact`, listing pointers to **MPP**, **CDP**,
  and **agentic.market**.
* Retry with `X-PAYMENT` header (base64 JSON of `{payload:{amount, asset,
  payTo, txHash, …}}`) → server calls `verify_payment()` either via
  `X402_FACILITATOR_URL` or local DEMO (declared amount/asset/payTo
  must match the manifest).
* Success → 200 with `cited.md` body + `X-PAYMENT-RESPONSE` settlement receipt.
* Manifest is **single-sourced** in `cited.payment.json` (written by
  `publish_cited.py`); no drift between minter and gate reader.

---

## 7. THE SKILLS LIBRARY — `skills/`

All 12 leaf/auxiliary skills; all live skills hit official APIs (no scraping);
all write a reproducibility bundle.

| Skill | Purpose | Data source | Key function |
|---|---|---|---|
| **celltype-specificity-profiler** ★ | tau + bimodality on `.h5ad` atlas | scanpy transform | `compute_tau`, `bimodality_coefficient`, `profile_gene` |
| **cellxgene-fetch** | annotated `.h5ad` slice from Census | `cellxgene-census` | `fetch_census`, `build_demo_adata` |
| **clinical-trial-finder** | ClinicalTrials.gov v2 query | clinicaltrials.gov API v2 | `fetch_trials`, `_study_to_trial`, `build_demo` |
| **dataset-projection** ★ | `.h5ad` → Fact CSV (no upload); binder MCP server | Prometheux + PrimeKG + cellxgene-census | `project_single_cell_facts` MCP tool; `bind.vada` rules |
| **frontend-design** | design constitution (no code) | — | read-only reference |
| **lit-synthesizer** | Tavily 3-angle lit search | Tavily Search REST | angles: `recent_literature`, `competitive_landscape`, `safety_signals` |
| **malignant-expression-profiler** | tumour vs non-tumour contrast | `.h5ad` transform | `malignant_contrast`, `resolve_malignant_label` |
| **openfda-safety** | FAERS + boxed warning | openFDA `/drug/event.json`, `/drug/label.json` | `fetch_adverse_events`, `fetch_boxed_warning` |
| **opentargets-association-evidence** | T↔D association across 7 datatypes | Open Targets GraphQL | `fetch_association`; demo offline |
| **opentargets-target-factors** | constraint, mouse-KO, tractability, safety | Open Targets GraphQL | `fetch_target_factors`; demo offline |
| **tcga-somatic-profiler** | TCGA SSM frequency per cancer type | NCI GDC `/ssm_occurrences`, `/cases` | `_gdc_post`, `fetch_mutation_counts`, `somatic_frequencies` |
| **phronesis-cso** ★ (orchestrator) | end-to-end GO/NO-GO verdict | all of the above | see §5 |

★ = new skill shipped by this project (`celltype-specificity-profiler` PR #1 to ClawBio#307;
  `phronesis-cso` PR #2; `dataset-projection` is the MCP/Vadalog binder).

### 7.1 Each skill's CLI signature
```bash
python <skill>.py \
  --<args>  \
  --output <dir>           # writes:
  #   ├── <primary>.json
  #   ├── report.md
  #   └── reproducibility/
  #         ├── commands.sh
  #         ├── environment.yml
  #         └── checksums.sha256
[--demo]                   # offline cached fixture available
```

### 7.2 The dataset-projection skill (deep dive)
Holds the MCP server + Vadalog binder:
```
dataset-projection/
├── mcp_server.py          # stdio MCP server (tool: project_single_cell_facts)
├── facts.py               # Fact schema (subject,relation,object,value,confidence,source_dataset,provenance) + writer
├── bind.vada              # ★ Vadalog program: marker_disease_link + verdict_disease_context
├── run_live.py, run_decision_live.py
├── to_cso.py              # emits 4-axis decision block in cso schema
├── extractors/
│   ├── pbmc3k_expression.py   # EXPRESSED_IN facts
│   ├── literature_claims.py   # lexicon OR optional Gemini LLM
│   └── run_decision.py        # local decision fallback
└── README.md
```

---

## 8. OUTPUT SCHEMAS (what the system *produces*)

### 8.1 Markdown reports (skill-specific)
* **phronesis-cso:** Target Assessment (target header → Executive summary
  with decision+confidence → Target overview → Evidence by division table →
  Evidence strength → Liabilities & risks → Evidence gaps → Proposed
  experiments → References → Reproducibility → Disclaimer)
* **clinical-trial-finder:** bulleted NCT list with phase/status/link
* **crispr-screen-triage:** ranked gene table (priority high/medium/watch)
* **equity-scorer:** HEIM score 0–100 + 4 components + PCA/FST/het tables
* **gwas-lookup:** variant metadata + VEP + GWAS/PheWAS/eQTL tables + data sources

### 8.2 `result.json` schema (orchestrator / phronesis-cso)
```jsonc
{
  "skill": "phronesis-cso",
  "version": "0.1.0",
  "completed_at": "ISO-8601",
  "input_checksum": "",
  "datasets": {},
  "summary": {
    "query": "...", "case": "b7h3", "mode": "demo|live",
    "loop": "live-agent-harness", "backend": "...", "model": "...",
    "n_steps": 8, "reviewer_verdict": "synthesize|re-route", "n_executed": 1,
    "decision": "GO|CONDITIONAL_GO|REVIEW|NO_GO",
    "decision_source": "prometheux|agent",
    "agent_decision": "CONDITIONAL_GO",
    "decision_engine": {
      "tier": "REVIEW", "score": 0.5, "max_score": 4.0,
      "axes": {
        "target_validity": {"grade":"illustrative","weight":0.5},
        "specificity":     {"grade":"absent",     "weight":0.0},
        "safety":          {"grade":"absent",     "weight":0.0},
        "tractability":    {"grade":"absent",     "weight":0.0}
      },
      "absent_axes": ["specificity","safety","tractability"],
      "explanation": "...",
      "facts": ["axis_score(B7-H3, target_validity, 0.5)", "no_information(B7-H3, specificity)", ...]
    },
    "confidence": "low|medium|high",
    "calls_llm": true
  },
  "data": {
    "briefing":       {"context":"...","data_availability":[...],
                        "priority_questions":[...], "feasibility_flags":[...],
                        "source":"agent (live)|cached demo (illustrative)"},
    "plan":           [{"step":"step_01_…","division":"...","question":"...",
                        "skill":"...","depends_on":[...]}],
    "division_findings": [{"division":"...","interpretation":"...",
                           "confidence":"low|medium|high","caveats":[...],
                           "evidence_grade":"absent|weak|illustrative|strong",
                           "source":"..."}],
    "evidence":       [{"step":"…","division":"…","skill":"…","question":"…",
                        "result":{...},"source":"unavailable|cached demo (illustrative)"}],
    "review":         {"verdict":"synthesize|re-route",
                       "scores":{"relevance":4,"evidence":3,"thoroughness":2},
                       "gaps":[{"missing":"…","route_to":"…","why":"…",
                                "lenses":["genetics","safety"],"forces_reroute":false,
                                "fact":"weak_axis(B7-H3, specificity)",
                                "explanation":"…"}],
                       "experiments":[{"missing":"…","proposed_experiment":"…",
                                       "route_to":"…","expected_readout":"…","why":"…"}],
                       "panel":{"n_lenses":4,"reroute_votes":0,"min_votes":2,
                                "forced_by_engine":false,"lenses":["safety","genetics","specificity","clinical"]},
                       "source":"agent (live)"},
    "synthesis":      {"decision":"…","confidence":"…","recommendation":"…",
                       "target_overview":"…","liabilities":[{"risk":"…","mitigation":"…"}],
                       "evidence_gaps":["…"],"proposed_experiments":[{"experiment":"…",...}]},
    "references":     [{"n":1,"skill":"…","provenance":"⚪/🔧/🧪/🌐","grade":"…","source":"…","step":"…"}],
    "evidence_gaps":  ["…"],
    "proposed_experiments": [{"experiment":"…","rationale":"…","expected_readout":"…"}],
    "disclaimer":     "…"
  }
}
```

### 8.3 OTel trace (`trace.jsonl`)
* **Span tree:** `run → (chief_of_staff, planner) → execute → divisions →
  scientists → review_loop → {review_panel → [reviewers × 4,
  prometheux_gaps] → reroute:* tool} × N → prometheux_decision →
  cso_synthesis`.
* **Span fields:** `run_id` (root hex), `span_id`, `parent_id`, `name`,
  `kind` ∈ {`run`, `agent`, `tool`, `loop`}, `status` ∈ {`ok`, `stub`,
  `error`}, `started_at` (epoch float), `duration_ms`, `usage` (input/
  output/total tokens or null), `attrs` (varies), `error`.
* **Stub spans** (`status:"stub"`, `usage:null`) signal
  `lens-failed` (HTTP 504/503) or `agent-failed` (connection error);
  original payload preserved in `attrs.reason`.

### 8.4 `run_decision.facts.csv` (triple-store)
Header: `subject,relation,object,value,confidence,source_dataset,provenance`
* `subject` = target symbol (e.g. `B7-H3`)
* `relation` ∈ {`axis_score`, `no_information`, `score`, `review`,
  `weak_axis`, `missing_datatype`, …}
* `object` = axis name (`target_validity`, `specificity`, `safety`,
  `tractability`)
* `value` = numeric or boolean fact

The demo file in `output_demo/` is **header-only** (no body) because
the run externalized facts inline in `decision_engine.facts`.

### 8.5 Reproducibility bundle (`reproducibility/`)
```
checksums.sha256     # sha256 of report.md + result.json
commands.sh          # exact bash one-liner that produced the run
environment.yml      # conda env spec (Python 3.12.13, etc.)
api_versions.json    # (gwas only) per-source base URLs + skip flags
```

### 8.6 Run taxonomy in `output/`
| Run prefix | Count | What it does |
|---|---|---|
| `gwas_<ts>` | 7 | Single-variant federated query across 9 genomic DBs (Ensembl, GWAS Catalog, Open Targets, UKB-TOPMed PheWeb, FinnGen, BBJ PheWeb, GTEx, eQTL Catalogue, LocusZoom PortalDev) |
| `crispr-triage_<ts>` | 2 | Per-gene / per-guide screen scoring (priority high/medium/watch) |
| `equity_<ts>` | 1 | HEIM equity scoring on VCF (HEIM score 0–100, PCA + FST + het) |
| top-level `report.md` + `result.json` | — | One-off `clinical-trial-finder` run for `CD276` (B7-H3) |

---

## 9. THE CITED ARTIFACT & PUBLISHING PIPELINE

### 9.1 `cited.md` (the paywalled product)
* **Title:** "Target Assessment — B7H3 · B7-H3 (CD276) ADC in lung cancer"
* **Decision:** `CONDITIONAL_GO`
* **Access:** `paid` via HTTP 402 (x402 rail)
* **Bundle:** `reproducibility/{commands.sh, environment.yml, checksums.sha256}`
* **Case study:** B7-H3 ADC in NSCLC — 6 evidence steps, tau = 0.78,
  fibroblast co-expression liability, multiple active Phase I/II ADC programs.

### 9.2 `cited.payment.json`
| Field | Value |
|---|---|
| Asset | `cited.md` |
| Price | `0.50 USDC` on `base` network |
| Pay-to | `0x000000000000000000000000000000000000dEaD` (publishable default; overridable in `server.py`) |

Rails:
* **x402** (primary) — HTTP 402 on `GET /api/report`, `scheme: exact`,
  `version: 1`
* **MPP** — Machine Payment Protocol listing `vbcso/cited-report`
* **CDP** — Coinbase Developer Platform wallet receiver
* **agentic.market** — public marketplace listing at
  `https://agentic.market/listings/vbcso-cited-report`,
  seller = `virtual-biotech-cso`

### 9.3 `publish_cited.py` (mints both)
1. Publishes the latest `output/report.md` as `cited.md` (caches
   `output/report.md` first, then newest `output/*/report.md` by mtime).
2. Normalizes trailing "References & data sources" block so every `[n]`
   resolves to a real source URL (skill registry + deep-link from the
   step).
3. Stamps canonical YAML front-matter (title, decision, published_by,
   access, payment_manifest) + paywall notice + body.
4. Writes `cited.payment.json` with manifest + citations + `source_report`.

CLI:
```bash
python3 publish_cited.py                              # newest output/report.md
python3 publish_cited.py --report path/to/report.md
```

---

## 10. THE .env / .env.example / .gitignore

`.env.example` covers all env vars (LLMs, Prometheux, Tavily, Langfuse,
x402). `.env` is **gitignored**.

`.gitignore` excludes:
* Python: `__pycache__/`, `*.py[cod]`, `*.egg-info/`, `.pytest_cache/`,
  `.ruff_cache/`
* Venv: `.venv/`
* Node/Frontend: `node_modules/`, `dist/`, `.next/`, `.turbo/`, `.vite/`
* Secrets: `.env`, `.env.*` (except `.env.example`)
* Generated output: `output/`, `output_demo/`
* Large raw data: `frontend/data/`, `*.h5ad`, `data/*.h5ad`
* Runtime KG stores: `skills/virtual-biotech-cso/kg.json`, `frontend/kg.json`
* Tooling caches: `.gemini/`, `.puku-cli/`

---

## 11. DATA FIXTURES

`data/pbmc3k_processed.h5ad` (24 MB) — scanpy built-in `pbmc3k` dataset,
used as an offline test fixture for `celltype-specificity-profiler`.
Per `data/README.md`: "Data access is ClawBio's job, not ours. Every dataset
is pulled live by an existing ClawBio skill (gwas-lookup,
scrna-embedding, clinical-trial-finder, …). No cached or fabricated
results shipped." These fixtures are small real data for offline validation,
never synthetic.

---

## 12. DESIGN RATIONALE / DOCS LANDSCAPE (`docs/`)

| Doc | Purpose |
|---|---|
| `PROJECT.md` | Project design notes — 4 core principles (verdict provable; every claim grounded; loop converges; offline == live); known limitations (CELLxGENE slow, NIM synthesis drops, tau atlas-dependent, GWAS weak for expression targets) |
| `SPONSORS.md` | Prometheux = decision layer; Tavily = lit search; Cursor = dev env; Gemini = one of LLM backends; Tessl = hackathon host; runtime = ClawBio over Open Targets, CELLxGENE, TCGA, DepMap, openFDA, ClinicalTrials.gov |
| `ENVIRONMENT.md` | Re-documents every env var (LLMs, Prometheux, Tavily, Langfuse, x402) |
| `deferred-skills.md` | Skills listed in `routing.yaml` but not yet executed live: `scrna-embedding`, `cellxgene-fetch` (live path), `opentargets-association-evidence`, `pathway-enricher`, `gwas-catalog-region-fetch`, `fine-mapping`, `struct-predictor`, `omics-target-evidence-mapper`, `claw-ancestry-pca`, `turingdb-graph` |
| `evidence-gap-analysis.md` | 8 paper gaps classified (R vs C); recommendation: compute G1 (tau) + G2 (bimodality) only; retrieve everything else from Open Targets |
| `expert-gaps-review.md` | 17 critical issues. Top fixes: backtest/calibration; judge circularity; per-division Elo + Pareto; genetics direction-of-effect; keep tau ≠ causal validation |
| `agentic-workflow-ideas.md` | Pre-registration of decision rubric ★🔭; adversarial bear-case ★⚡; cross-examination between divisions ★; abstention ★; growing skill library ★🔭 |
| `agentic-hypothesis-optimization.md` | VoI framework — `a* = argmax_a EIG(a) / cost(a)`; (a) VoI-gated acquisition, (b) Sequential Halving / LUCB, (c) plateau-stopping |
| `ai-scientist-landscape-review.md` | L0–L4 autonomy spectrum; Phronesis is L3 (goal-level). TxAgent, Sakana AI Scientist v2, Google Co-Scientist (Nature 2026), Biomni, Robin, Coscientist, Kosmos compared |
| `kg-pareto-provenance-design.md` | KG + Pareto + Provenance = one system. Typed edges `HAS_EVIDENCE`, `ON_AXIS`, `SUPPORTS`, `REFUTES`, `DERIVED_FROM`, `EXPRESSED_IN`, `SIGNALS_TO`, `BEAT`. Edge metadata includes `confidence ∈ [0,1]`, `source`, `method`, `timestamp`. Confidence gating: ≥0.8 solid "strong"; 0.5–0.8 medium "supported"; 0.2–0.5 faded "suggestive"; <0.2 dashed "insufficient" |
| `loom-script-3min.md` | 3-min pitch script. Hook → Problem → Solution → Proof → Potential → Close. ~150 wpm |
| `loom-slides.md` | 6-slide Marp deck — Title → Problem → Solution → Grounded & Trustworthy → Hypothesis Gen/Refinement → Explainable → Thank You |
| `prometheux-evidence-graph-applicability.md` | Yes, but as a *reasoning layer* on top of the graph. Strong fits: "explain a rank", transitive/multi-hop, confidence-gated claims, lineage. Weak fits: Pareto numerics, infra weight, classical Datalog± doesn't do confidence semiring |
| `target-arena-research.md` | Re-frames Virtual Biotech as a **ranking arena** (LMSYS-Chatbot-Arena-style): target × disease × modality hypotheses pitted pairwise; Elo live + Bradley–Terry final with 95% CIs; 4 LLM judges, order-swapped to defeat position bias. Demo target: ≤250 judge calls (n=10 RR + panel re-judge of top-6) |

---

## 13. THE DEMO CASE STUDY (`workflows/b7h3_adc_nomination.md`)

The flagship end-to-end walkthrough reproducing Zhang et al. 2026.

**Query:** *"Assess B7-H3 potential as a therapeutic target in lung cancer."*

| # | Division | Sub-question | Skill | Expected signal |
|---|---|---|---|---|
| 0 | Office of CSO | Field briefing | `chief_of_staff` | IO checkpoint, ADC landscape, atlases |
| 1 | Target ID | Germline genetic support? | `gwas-lookup` | Weak/absent — *non-disqualifying* |
| 2 | Target ID | Which cell types express it? | `scrna-embedding` | Enriched in fibroblasts, low in T cells |
| 3 | Target ID | Cell-type-specific? | `celltype-specificity-profiler` | High tau + bimodality → favourable prior |
| 4 | Target Safety | Off-target tissue risk? | `celltype-specificity-profiler` | Specificity ⇒ lower broad-tissue AE risk |
| 5 | Clinical | Prior trials / outcomes | `clinical-trial-finder` | Existing B7-H3 ADC programs (NCT04145622, NCT05280470, NCT04338087) |
| — | Reviewer | Audit → gap? | `reviewer` | Flags missing **spatial** validation → re-route |
| 6 | Target ID | Spatial immune exclusion? | `scrna-orchestrator` | B7-H3-high spots depleted of immune cells |

**CSO synthesis:** B7-H3 has weak germline genetics but strong somatic/
stromal rationale, cell-type-specific expression, spatial evidence of an
immune-excluded niche → supports **ADC strategy**, with stromal-vs-
malignant expression split flagged as the key liability → **`CONDITIONAL_GO`**.

**Run commands:**
```bash
clawbio run phronesis-cso --demo                 # offline
clawbio run phronesis-cso --query "..." --live   # live routed skills
```

---

## 14. CONVERGENCE GUARANTEES (regression-tested)

1. **Budget gate** — `DEFAULT_TOKEN_BUDGET = 60,000` bounds the re-route loop
2. **No-thrash guard** — same skill + same question is skipped
3. **One forced pass only** — a forcing engine gap (`gaps_from_evidence`
   marks with `forces_reroute: true`) triggers exactly one re-route

---

## 15. TEST SURFACE

* **Pytest config:** `testpaths = ["skills", "tests"]`
* **Total tests:** 133 passing across 9 test files
* **Key files:**
  * `tests/test_prometheux_reason.py` — **18 cases** covering: Vadalog compile,
    local reasoning, confidence-gated strong-claim, explain-a-rank,
    gap-detector, gap-to-routing binding, absent-grade handling, full-
    coverage negative, decision tiers (GO/CONDITIONAL_GO/REVIEW/NO_GO),
    engine-gap override, leaderboard ordering.
  * `skills/<*>/tests/` — per-skill smoke + fixture tests.

---

## 16. KNOWN LIMITATIONS / EXPERT GAPS (acknowledged)

* **No backtest / calibration ✱A** — leaderboard never shown to predict reality
* **Judge circularity / pretraining leakage ✱A** — LLM judge already knows EGFR/MET succeeded
* **Single Elo collapses multi-objective decision ✱P ✱A**
* **Genetics as "support," not direction/dose ✱P-lite ✱A**
* **Tau is a biomarker, not causal validation ✱A** — keep "is it a driver" (genetics + CRISPR) separate from "is it clean" (specificity)
* **CELLxGENE slow** (network)
* **NIM synthesis drops** (provider flakiness)
* **Tau atlas-dependent**
* **GWAS weak for expression targets**
* **Deferred skills** (see §12)
* **Demo run produces no facts in `run_decision.facts.csv`** (header-only)
* **No cross-run memory** — deliberately omitted to preserve reproducibility

---

## 17. INSTRUCTIONS TO RUN

```bash
# Install
pip install -e .                  # base (no LLM deps)
pip install clawbio               # platform runner
pip install -e .[agents]          # live multi-agent loop
pip install -e .[tracing]         # Langfuse mirror
pip install -e .[reasoning]       # hosted Prometheux
pip install -e .[mcp]             # local MCP server
pip install -e .[dev]             # pytest + ruff
pnpm install                      # agentation-mcp, shiki

# Run the CLI orchestrator
python skills/phronesis-cso/harness.py --demo                                # offline
python skills/phronesis-cso/harness.py --demo --query "Assess HER2 in breast cancer"
python skills/phronesis-cso/harness.py --live --backend auto --query "..."
clawbio run phronesis-cso --demo                                              # alt entry

# Run the web UI
python frontend/server.py               # → http://localhost:8765/app

# Publish the cited artifact
python3 publish_cited.py                  # → cited.md + cited.payment.json

# Regenerate docs
python .gemini/update_docs.py             # rebuilds 10 README/SKILL files

# Tests
python -m pytest                         # 133 tests
python -m pytest -v
python -m pytest tests/test_prometheux_reason.py -v
```

---

## 18. RECENT CHANGELOG (last 24h of file mtimes → snapshot)

* **Top-level:** `README.md` updated 18:08 (most recent edit)
* **Skills shipped:** `celltype-specificity-profiler` (PR #1), `phronesis-cso`
  (PR #2)
* **Last 6 run directories** in `output/`: `gwas_20260705_154221` (15:42),
  `gwas_20260705_152643` (15:26), `gwas_20260705_152009`, `gwas_20260705_151824`,
  `gwas_20260705_151334`, `gwas_20260705_144927`, `gwas_20260705_142758`,
  `gwas_20260705_142738`, `crispr-triage_20260705_143014`, `crispr-triage_
  20260705_141837`, `equity_20260705_143014`
* **Output demo:** 1 orchestrator run (B7-H3 case)
* **Frontend:** vendored assets include `assets/decision-card.png` (480 KB),
  `assets/hero.png` (559 KB), `assets/logo-mark.png` (114 KB) — generated
  via `assets/gen.py` calling **Gemini 3 Pro Image ("Nano Banana 2")**
* **`cited.md` + `cited.payment.json` + `publish_cited.py`** present —
  the paywalled product
* **`.gemini/update_docs.py`** present (Windows-hardcoded path) — batch
  doc-regeneration utility for 10 README/SKILL files

---

## 19. HOUSE-WIDE INVARIANTS & CONVENTIONS

* **Every leaf skill:** `--output <dir>` runner; writes
  `reproducibility/{commands.sh, environment.yml, checksums.sha256}` next
  to primary outputs.
* **Every leaf skill:** live API call (no scraping); `--demo` offline
  fixture; ends with the **ClawBio disclaimer** ("research and educational
  tool … not a medical device").
* **Every orchestrator run:** ends with the **ClawBio disclaimer** plus
  the **trial-success caveat** ("Trial-success priors are correlational …").
* **Entity IDs:** canonical `<kind>:<slug>` (kind ∈ {gene, disease, drug,
  cell_type, dataset, trial, paper, factor, axis, verdict}).
* **Provenance emoji legend (universal):** 🗄️ retrieved · 🔧 computed ·
  🌐 web · ⚪ gap · 🧪 demo · 🧬 PrimeKG.
* **Grades (universal):** `strong` (1.0) / `supporting` (0.5) /
  `suggestive` (0.25) / `absent` (0.0). Variant `illustrative` appears in
  the orchestrator as a synonym for `supporting`.
* **Decision tiers (universal):** GO (≥3.0+strong safety) ·
  CONDITIONAL_GO (≥2.0+safety covered) · REVIEW · NO_GO (safety hard-gate)
* **Span status:** OK / stub / error (stub = lens-failed or agent-failed;
  original payload preserved in `attrs.reason`)
* **Three convergence guarantees:** budget gate, no-thrash guard, one forced
  pass only — all regression-tested.
* **Paywall:** cited.md is the only monetized surface; price 0.50 USDC on
  base network; pay-to `0x000…dEaD` (overridable).

---

## 20. WHERE AN AI SHOULD *START* TO MAKE A CHANGE

| If you want to … | Touch |
|---|---|
| Add a new leaf skill | Copy `skills/clinical-trial-finder/`, register in `skills/phronesis-cso/routing.yaml`, add a prompt template in `skills/phronesis-cso/prompts/` |
| Add a new lens / new rating dimension | `skills/phronesis-cso/cso.py` (panel construction) + `prometheux_reason.py` (axis list, thresholds) + `kg.py` (entity kinds) |
| Change the decision tiers | `skills/phronesis-cso/prometheux_reason.py` — `REQUIRED_AXES`, `GRADE_WEIGHT`, `GO_THRESHOLD`, `CONDITIONAL_THRESHOLD`, `unsafe_advance` Prolog rule |
| Change the UI | `frontend/app.jsx` then run `python3 frontend/build.py` |
| Add a new endpoint | `frontend/server.py` (`Handler.do_GET` / `do_POST`) — match the SSE event vocabulary that `reduceEvent` consumes |
| Change payment rails | `cited.payment.json` + `frontend/x402.py` + `publish_cited.py` (`PAY_TO`, `PRICE_USDC`) |
| Add a new LLM | `skills/phronesis-cso/runners.py` — append a new `*Runner` class + register in `select_runner()` |
| Change the trace schema | `skills/phronesis-cso/tracing.py` + per-runner `attrs`; mirror in frontend `reduceEvent` |
| Tune convergence | `DEFAULT_TOKEN_BUDGET`, `MAX_REROUTES`, "no-thrash" guard in `cso.py`/`harness.py` |
| Add a new ranking axis | `prometheux_reason.rank_targets` + `kg.py` edge kinds |
| Add new heroes / images | `frontend/assets/gen.py` (Gemini 3 Pro Image) + replace files |
| Update documentation | Use `python .gemini/update_docs.py` (Windows-hardcoded path); otherwise edit per-file |

---

> **Disclaimer:** Phronesis CSO is a research and educational tool — **not a
> medical device. Do not use for clinical decisions.**

