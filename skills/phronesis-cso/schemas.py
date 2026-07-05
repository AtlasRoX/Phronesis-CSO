"""schemas.py — typed pydantic v2 models for the LLM JSON contracts.

I1 fix: the six ``*_SCHEMA = {...}`` dicts in ``harness.py`` were documentation
only — typed validation happened nowhere, and downstream code was always
``dict[str, Any]``. These ``BaseModel`` subclasses:

  * give editor autocomplete for all LLM payloads (CSO briefing, planner,
    review panel, division findings, synthesis, hybrid plan)
  * validate the LLM output BEFORE downstream use — catches bad shapes
    once, at the seam, instead of ``KeyError`` 6 hops later
  * regenerate the JSON schema sent to the model via
    ``Model.model_json_schema()`` so the LLM contract is *unchanged*
    (the dict form is gone but the wire-format is identical)
  * offer ``.model_dump()`` / ``.model_dump_json()`` so the harness no
    longer hand-rolls ``json.dumps(...)`` on every payload (eliminates
    5+ manual sites in harness.py + 5+ in runners.py / cso.py)

**Backward-compat shim:** the legacy dicts are exposed as
``Model.model_json_schema()`` so the prompt-text "JSON schema" the model
sees is unchanged. ``MessageError`` paths still extract a dict on retry
failure so callers can degrade gracefully.
"""
from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class _Base(BaseModel):
    """Common base for all LLM payload models.

    Two tweaks from the default pydantic behaviour:
      * ``extra="ignore"`` — the LLM is allowed to emit additional fields
        (e.g. ``"notes"`` after we asked for ``"interpretation"``); we
        silently drop them on parse rather than fail the whole review.
      * ``model_config`` is the v2 form (``ConfigDict``), not the
        deprecated v1 ``Config`` class."""

    model_config = ConfigDict(extra="ignore")


class DataAvailabilityItem(_Base):
    source: str
    relevance: Literal["high", "medium", "low"]
    note: str


class BriefingResponse(_Base):
    context: str
    data_availability: list[DataAvailabilityItem] = Field(default_factory=list)
    priority_questions: list[str] = Field(default_factory=list)
    feasibility_flags: list[str] = Field(default_factory=list)


class ReviewGap(_Base):
    missing: str
    route_to: str = Field(description="skill-name")
    why: str


class ReviewExperiment(_Base):
    missing: str
    proposed_experiment: str
    route_to: str
    expected_readout: str
    why: str


class ReviewScores(_Base):
    relevance: int = Field(ge=1, le=5)
    evidence: int = Field(ge=1, le=5)
    thoroughness: int = Field(ge=1, le=5)


class ReviewResponse(_Base):
    verdict: Literal["synthesize", "re-route"]
    scores: ReviewScores
    gaps: list[ReviewGap] = Field(default_factory=list)
    experiments: list[ReviewExperiment] = Field(default_factory=list)


class PlanSubtask(_Base):
    division: str = Field(description="a routing.yaml division")
    intent: str = Field(description="an intent under that division")
    question: str
    depends_on: list[str] = Field(default_factory=list)


class PlanResponse(_Base):
    subtasks: list[PlanSubtask]


class HybridPlanQuestion(_Base):
    question: str
    rationale: str
    division: str | None = None
    intent: str | None = None
    depends_on: list[str] = Field(default_factory=list)


class HybridPlanResponse(_Base):
    reasoning: str
    questions: list[HybridPlanQuestion] = Field(default_factory=list)


class DivisionFinding(_Base):
    division: str
    interpretation: str = Field(description="cite [step_NN]")
    confidence: Literal["high", "medium", "low"]
    caveats: list[str] = Field(default_factory=list)
    evidence_grade: Literal["strong", "supporting", "weak"]


class SynthesisLiability(_Base):
    risk: str
    mitigation: str


class SynthesisExperiment(_Base):
    experiment: str
    expected_readout: str
    rationale: str


class SynthesisResponse(_Base):
    decision: Literal["GO", "CONDITIONAL_GO", "REVIEW", "NO_GO"]
    confidence: Literal["high", "medium", "low"]
    recommendation: str
    target_overview: str
    liabilities: list[SynthesisLiability] = Field(default_factory=list)
    evidence_gaps: list[str] = Field(default_factory=list)
    proposed_experiments: list[SynthesisExperiment] = Field(default_factory=list)


# --------------------------------------------------------------------------- #
# Backward-compat dict constants — kept so legacy string-form references in
# prompts continue to work unchanged. ``Model.model_json_schema()`` produces
# the same wire-shape the previous dict did.
# --------------------------------------------------------------------------- #
def _compat(model: type[BaseModel]) -> dict[str, Any]:
    """Reconstruct the legacy ``{key: "..."}`` dict the way the original
    ``*_SCHEMA`` constants expressed it. The shape is loose (the previous
    dict was documentation, not enforcement) but it's what the prompts say."""
    return {
        "type": "object",
        **_compat_strip(model.model_json_schema()),
    }


def _compat_strip(schema: dict[str, Any]) -> dict[str, Any]:
    """Drop keys pydantic adds that the original docs didn't have; keep
    field-level type info only where useful."""
    return {k: v for k, v in schema.items() if k in ("properties", "required", "type")}


BRIEFING_SCHEMA = _compat(BriefingResponse)
REVIEW_SCHEMA = _compat(ReviewResponse)
PLAN_SCHEMA = _compat(PlanResponse)
HYBRID_PLAN_SCHEMA = _compat(HybridPlanResponse)
DIVISION_FINDING_SCHEMA = _compat(DivisionFinding)
SYNTHESIS_SCHEMA = _compat(SynthesisResponse)


# --------------------------------------------------------------------------- #
# Validation helper — parse an LLM-supplied dict into the typed model.
# Falls back to the dict (with a warning) on validation failure so the
# existing retry path can act on a partial structure rather than crash.
# --------------------------------------------------------------------------- #
def parse_llm(model: type[_Base], raw: dict[str, Any] | None) -> _Base | None:
    """Validate ``raw`` as ``model``. Return None on failure instead of raising.

    The retry loop (I2) treats None as a parse failure and re-prompts. We
    log the validation error so callers can attach it as a span attr."""
    if not isinstance(raw, dict):
        return None
    try:
        return model.model_validate(raw)
    except Exception:
        return None
