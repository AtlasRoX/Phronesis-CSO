<div align="center">

# 🧬 Phronesis CSO

### *The Virtual Chief Scientific Officer — A Multi-Agent AI That Nominates Drug Targets and Shows Its Work*

[![Reasoning: Prometheux](https://img.shields.io/badge/reasoning-Prometheux%20Vadalog-fbbf24?style=for-the-badge)](https://prometheux.ai)
[![Search: Tavily](https://img.shields.io/badge/search-Tavily-38bdf8?style=for-the-badge)](https://tavily.com)
[![Built on ClawBio](https://img.shields.io/badge/built%20on-ClawBio-34d399?style=for-the-badge)](https://clawbio.ai)
[![Tests](https://img.shields.io/badge/tests-133%20passing-22c55e?style=for-the-badge)](#-testing)
[![Paper](https://img.shields.io/badge/paper-The%20Virtual%20Biotech%20(bioRxiv)-94a3b8?style=for-the-badge)](https://www.biorxiv.org/content/10.64898/2026.02.23.707551v1)

</div>

---

## 🎯 The Problem

Choosing the right drug target is the single most expensive decision in pharmaceutical R&D. **Nine out of ten clinical drug programs fail**, and most failures trace back to one mistake: picking the wrong target.

A landmark Stanford paper — *[The Virtual Biotech](https://www.biorxiv.org/content/10.64898/2026.02.23.707551v1)* (Zhang et al. 2026) — proved that a multi-agent AI can automate this decision reliably, and found a striking result: **targets with high cell-type specificity are 40% more likely to advance from Phase I to Phase II trials and carry 32% lower adverse-event rates.**

**Phronesis CSO turns that paper into a running production system.** It is a multi-agent AI organisation — a virtual R&D company — that:

- Decomposes any target-disease question into expert sub-tasks
- Routes those tasks to bioinformatics tools over live public databases
- Audits the evidence with a peer-reviewer panel
- Derives a **GO / NO-GO verdict deductively** using formal logic — not LLM guesswork
- Generates a fully cited, reproducible report with a replayable reasoning chain

> **The key insight:** The verdict is not *generated* by a language model. It is *derived* from cited evidence by a **Prometheux Vadalog logic engine** — the way a mathematician proves a theorem, not the way a chatbot summarizes text.

---

## 🗺️ System Architecture

<p align="center">
  <a href="docs/assets/architecture.svg">
    <img src="docs/assets/architecture.svg" alt="Phronesis CSO — System Architecture" width="100%"/>
  </a>
</p>

<details>
<summary><b>📐 Click here for the text-rendering (mermaid) version of the same diagram</b></summary>

```mermaid
graph TD
    subgraph UI["🖥️  Web UI  (localhost:8765)"]
        Q[User Query] --> SSE[Server-Sent Event Stream]
    end

    subgraph LOOP["🤖  Multi-Agent Reasoning Loop  (harness.py)"]
        direction TB
        CS["👔 Chief of Staff<br/>Field Briefing"] --> CSO
        CSO["🧠 CSO Orchestrator<br/>Decompose & Route"] --> DIV
        subgraph DIV["🔬  Four Scientific Divisions"]
            D1["📊 Target ID & Prioritization"]
            D2["🛡️ Target Safety"]
            D3["💊 Modality & Tractability"]
            D4["🏥 Clinical & Literature"]
        end
        DIV --> REV
        REV["👥 Scientific Reviewer Panel<br/>4 Lenses · Majority Vote"] -->|gaps found| REROUTE
        REROUTE["↩️ Re-route to Missing Skill"] --> DIV
        REV -->|synthesize| SYN
        SYN["📝 CSO Synthesis<br/>Report Assembly"]
    end

    subgraph REASONING["⚙️  Prometheux Vadalog Engine  (prometheux_reason.py)"]
        GAP["🔍 Gap Detector<br/>Structural Missing Axes"]
        DECIDE["⚖️ GO/NO-GO Decision<br/>Weighted Axis Scores"]
        RANK["🏆 Explain-a-Rank<br/>Cross-Target Leaderboard"]
    end

    subgraph KG["🗄️  Knowledge Graph  (kg.py)"]
        EDGES["Evidence Edges<br/>Confidence · Axis · Provenance"]
        NODES["Entity Nodes<br/>Target · Disease · Trial · Cell"]
    end

    subgraph SKILLS["🧰  ClawBio Skills  (real databases)"]
        S1["🧬 GWAS Catalog"]
        S2["🔬 CELLxGENE Census"]
        S3["💉 Open Targets"]
        S4["⚠️ openFDA/FAERS"]
        S5["🏥 ClinicalTrials.gov"]
        S6["📚 Tavily Literature"]
    end

    Q --> LOOP
    DIV --> SKILLS
    SKILLS --> KG
    KG --> REASONING
    GAP --> REV
    DECIDE --> SYN
    SYN --> SSE
```

</details>

### The Three Layers

| Layer | What It Does | Why It Exists |
|---|---|---|
| **Agentic Loop** | Agents plan, route, review, and synthesize | Automates the full R&D decision workflow end-to-end |
| **Expert Tools** | ClawBio skills call real databases deterministically | Every claim in the report is grounded in real biology |
| **Reasoning Engine** | Prometheux Vadalog derives the verdict formally | The conclusion is provable from cited facts, not generated |

---

## 🤖 The Multi-Agent Organisation

Phronesis CSO is a **genuine multi-agent system**, not a single prompt with a collection of tools. Five distinct roles operate in sequence, and the reviewer panel is a genuine vote.

```mermaid
sequenceDiagram
    participant U as 🧑 User
    participant CS as 👔 Chief of Staff
    participant CSO as 🧠 CSO Orchestrator
    participant D as 🔬 Divisions x4
    participant PR as ⚙️ Prometheux
    participant REV as 👥 Reviewer Panel
    participant OUT as 📄 Output

    U->>CS: "Assess B7-H3 in lung cancer"
    CS->>CSO: Field briefing + data availability
    CSO->>D: Decompose query → route sub-tasks
    D->>D: Run ClawBio skills in parallel
    D->>PR: Evidence edges → knowledge graph
    PR->>REV: Gap report (missing axes)
    REV->>REV: 4 lenses vote independently
    alt gaps detected → re-route
        REV->>D: Force exactly one re-route pass
        D->>PR: New evidence → update graph
    end
    PR->>CSO: GO/NO-GO tier + explanation
    CSO->>OUT: report.md + result.json + trace.jsonl
    OUT->>U: Cited verdict with full rule chain
```

### Agent Roles Explained

| Role | What It Does | Why Not Just One Agent? |
|---|---|---|
| **Chief of Staff** | Produces a briefing before anything starts — what is known about this target, what data is available, likely gaps | Without this, the CSO would plan blind and waste agent calls |
| **CSO Orchestrator** | Reads the briefing, decomposes the query into sub-tasks, routes each to the right ClawBio skill | Specialisation: the orchestrator is a project manager, not a scientist |
| **Scientist Divisions** (×4) | Each runs its assigned ClawBio skills over real databases and records cited evidence edges | Parallelism + specialisation: genetics, safety, tractability, and clinical are genuinely different domains |
| **Scientific Reviewer Panel** | Four lenses (completeness, methodology, safety, recency) each vote independently; majority re-routes | Adversarial review catches gaps the scientists didn't know to look for |
| **Prometheux Gap Detector** | Non-silenceable fifth panel member — detects structurally missing axes with formal logic | An LLM reviewer might ignore a missing axis; formal logic cannot |

---

## ⚙️ The Vadalog Reasoning Engine

This is the scientific heart of the project.

### What is Vadalog?

[Vadalog](https://prometheux.ai) is a logic programming language for knowledge graphs. Instead of asking "what does the AI think?", you write rules:

```prolog
%% A target has a 'strong claim' on an axis if confidence >= 0.8
strong_claim(T, Ax) :- evidence(T, Ax, C), C >= 0.8.

%% A target is missing an axis if no evidence exists
missing_axis(T, Ax) :- target(T), required_axis(Ax), not has_axis(T, Ax).

%% Unsafe advance: strong claim somewhere but NO safety read
unsafe_advance(T) :- strong_claim(T, _), not has_axis(T, "safety").

%% Explain-a-rank: A ranks over B because A is strong on Ax and B is not
differentiates(A, B, Ax) :- strong_claim(A, Ax), not strong_claim(B, Ax).
```

The engine **proves** these from cited evidence facts. The rule chain is shown explicitly with `@explain`.

### The Four Decision Axes

```mermaid
graph LR
    subgraph AXES["Evidence Axes — each contributes 0.0 to 1.0"]
        A1["🎯 Target Validity<br/>GWAS · CRISPR · somatic signal"]
        A2["🔬 Specificity<br/>Cell-type tau · malignant localisation"]
        A3["🛡️ Safety<br/>openFDA adverse events · OT liabilities"]
        A4["💊 Tractability<br/>Clinical precedent · modality · literature"]
    end

    AXES --> SCORE["Coverage Score  0 → 4.0"]

    SCORE --> T1["✅ GO  score >= 3.0 + strong safety"]
    SCORE --> T2["🟡 CONDITIONAL GO  score >= 2.0 + safety covered"]
    SCORE --> T3["🔄 REVIEW  below threshold"]
    SCORE --> T4["❌ NO-GO  strong claim + zero safety read"]
```

**The safety hard-gate:** A target can score perfectly on three axes — but if there is **zero safety evidence**, `unsafe_advance` fires and returns NO-GO regardless of score. An LLM might silently skip this; formal logic cannot.

### Evidence Grades

| Grade | Weight | Meaning |
|---|---|---|
| `strong` | 1.0 | Direct experimental proof, high confidence |
| `supporting` / `illustrative` | 0.5 | Corroborating evidence, well-sourced |
| `suggestive` | 0.25 | Indirect or low-power signal |
| `absent` | 0.0 | Step ran but returned no data |

---

## 🔄 The Re-Route Control Loop

The reviewer panel can force the loop back to collect missing evidence. This is governed by three convergence guarantees:

```mermaid
flowchart TD
    START([Evidence collected]) --> GAP_CHECK{"Prometheux:\nMissing required axis?"}
    GAP_CHECK -->|Yes - structural gap| FORCE["Force re-route\nNon-negotiable"]
    GAP_CHECK -->|No structural gap| PANEL_VOTE

    PANEL_VOTE{"Reviewer Panel:\n2+ of 4 lenses\nvote re-route?"}
    PANEL_VOTE -->|Yes| BUDGET{"Token budget\nremaining?"}
    PANEL_VOTE -->|No| SYNTHESIZE

    BUDGET -->|Yes| ALREADY_RUN{"Same skill + question\nalready answered?"}
    BUDGET -->|No| SYNTHESIZE

    ALREADY_RUN -->|Yes| SYNTHESIZE
    ALREADY_RUN -->|No| REROUTE["Run one re-route pass"]
    REROUTE --> GAP_CHECK

    FORCE --> REROUTE
    SYNTHESIZE([Synthesize final report])
```

**Three convergence guarantees (all regression-tested):**

1. **Budget gate** — only chases gaps while token spend stays under `DEFAULT_TOKEN_BUDGET = 60,000`
2. **No thrash** — if re-route calls the exact same skill with the same question, it is skipped. The loop deepens, it does not spin
3. **One forced pass only** — a structural gap triggers exactly one re-route, then moves to synthesis regardless

---

## 🌐 The Web UI

Start the server and open `http://localhost:8765/app`:

```bash
python frontend/server.py
```

The UI has six tabs:

| Tab | What it shows |
|---|---|
| **Loop Trace** | Real-time streaming of every agent event as the loop runs |
| **Evidence Graph** | Interactive knowledge graph — nodes and edges from all evidence steps |
| **Axis Scorecard** | The four-axis breakdown: grade, weight, evidence items per axis |
| **Report** | Full cited markdown report with all references |
| **Evidence Ledger** | All evidence edges across all runs in the session |
| **Target Ranking** | Cross-target leaderboard with Prometheux `differentiates` explanations |

---

## 🧬 The Cell-Type Specificity Primitive

The paper's key predictive signal was cell-type specificity, but none of the 128 existing ClawBio skills computed it. We built it:

```mermaid
graph LR
    INPUT["Gene expression matrix\n.h5ad from CELLxGENE"] --> TAU
    INPUT --> BC

    TAU["📐 Tau index\n0 = ubiquitous\n1 = single-cell-type restricted\nYanai et al. 2005"]
    BC["📊 Bimodality coefficient\nON/OFF per cell type\nρ ≈ 0.54 with tau"]

    TAU --> PRIOR
    BC --> PRIOR
    PRIOR["📈 Trial success prior\n+40% Phase I→II\n−32% adverse events\nZhang et al. 2026"]
```

**Why tau?** A gene expressed only in lung tumour cells (tau = 0.9) is a much safer drug target than one expressed across all tissues (tau = 0.1). You hit the tumour without damaging healthy cells.

**Why bimodality?** The bimodality coefficient (from psychometrics) detects genes that are either ON or OFF in specific cell types. It independently predicts trial success and correlates with tau (ρ ≈ 0.54).

---

## 📁 Repository Structure

```
phronesis-cso/
│
├── skills/
│   ├── phronesis-cso/                    # PRIMARY — the orchestration layer
│   │   ├── cso.py                        # Core logic: routing, synthesis, evidence grading
│   │   ├── harness.py                    # Full agent loop: brief→route→review→synthesize
│   │   ├── prometheux_reason.py          # Vadalog program: gaps + decision + ranking
│   │   ├── kg.py                         # Knowledge graph: nodes, edges, upsert, ledger
│   │   ├── routing.yaml                  # Query intent → ClawBio skill routing map
│   │   ├── runners.py                    # LLM backend adapters (Anthropic/NVIDIA/OpenAI/Gemini)
│   │   ├── tracing.py                    # trace.jsonl writer + optional Langfuse mirror
│   │   ├── primekg_enrich.py             # PrimeKG corroborating edge enrichment
│   │   ├── prompts/
│   │   │   ├── chief_of_staff.md         # Agent prompt: field briefing
│   │   │   ├── orchestrator.md           # Agent prompt: CSO synthesis
│   │   │   ├── reviewer.md               # Agent prompt: scientific reviewer
│   │   │   └── division_scientist.md     # Agent prompt: division scientist
│   │   └── demo_data/b7h3/               # Cached offline fixtures (B7-H3 case study)
│   │
│   ├── celltype-specificity-profiler/    # SUPPORTING — tau + bimodality primitive
│   ├── cellxgene-fetch/                  # CELLxGENE Census API wrapper
│   ├── malignant-expression-profiler/    # Tumour vs normal expression
│   ├── gwas-lookup/                      # GWAS Catalog + Open Targets genetic evidence
│   ├── openfda-safety/                   # FDA FAERS adverse event snapshot
│   ├── opentargets-target-factors/       # OT prioritisation, tractability, safety liabilities
│   ├── clinical-trial-finder/            # ClinicalTrials.gov live search
│   ├── lit-synthesizer/                  # Tavily-powered live literature search
│   └── tcga-somatic-profiler/            # TCGA/GDC somatic mutation frequency
│
├── frontend/
│   ├── server.py                         # HTTP server: SSE streaming + static serving
│   ├── app.jsx / app.js                  # React UI: loop trace, graph, scorecard, report
│   ├── index.html                        # App shell
│   └── site/
│       ├── index.html                    # Marketing landing page
│       └── schematic.html                # Interactive system schematic
│
├── docs/
│   ├── ENVIRONMENT.md                    # All environment variables explained
│   └── assets/architecture.svg          # System architecture diagram
│
├── tests/                                # 133 tests, all passing
│   └── test_prometheux_reason.py         # Vadalog reasoning + gap detector
│
└── workflows/
    └── b7h3_adc_nomination.md            # Full B7-H3 ADC case study walkthrough
```

---

## 🚀 Quick Start

### Web UI (Recommended)

```bash
# 1. Install
pip install -r requirements.txt

# 2. Start server
python frontend/server.py
# → http://localhost:8765

# 3. Open browser, type any query in Demo mode
```

### Command Line

```bash
# Full offline demo — no keys, no network
python skills/phronesis-cso/harness.py --demo

# Custom query, still offline
python skills/phronesis-cso/harness.py --demo --query "Assess HER2 in breast cancer"

# Live mode with real databases
python skills/phronesis-cso/harness.py --live --backend auto \
       --query "Assess KRAS G12C in colorectal cancer"
```

### ClawBio Platform

```bash
pip install clawbio
clawbio run phronesis-cso --demo
clawbio run celltype-specificity-profiler --demo
```

---

## ⚙️ Configuration

Copy `.env.example` to `.env`. Everything works with zero keys in demo mode.

### LLM Backends (auto-selected in order)

| Priority | Variable | Default Model |
|:---:|---|---|
| 1 | `ANTHROPIC_API_KEY` | `claude-sonnet-4-6` |
| 2 | `NVIDIA_API_KEY` | `nvidia/llama-3-nemotron-super-102b` |
| 3 | `OPENAI_API_KEY` | `gpt-4o-mini` |
| 4 | `GEMINI_API_KEY` | `gemini-2.5-flash` |

Override any model: `VBIO_MODEL=gpt-4o python frontend/server.py`

### Integrations

| Tool | What It Powers | Variables | Without It |
|---|---|---|---|
| **Prometheux** | Hosted Vadalog engine + PrimeKG | `PMTX_TOKEN` + `JARVISPY_URL` | In-process Datalog, same output |
| **Tavily** | Live literature search | `TAVILY_API_KEY` | Cached demo fixture |
| **Langfuse** | Hosted agent trace | `LANGFUSE_PUBLIC_KEY` + `LANGFUSE_SECRET_KEY` | Local `trace.jsonl` |
| **ClawBio** | All bioinformatics skill tools | `clawbio` CLI | `--demo` fixtures |

**Prometheux setup:**
```bash
PMTX_TOKEN=<token>
JARVISPY_URL=https://api.prometheux.ai/jarvispy/{org}/{username}
# Requires an active compute machine in the Prometheux dashboard
```

---

## 🔑 Key Features Explained

### Demo Mode — Any Query Works
Type any target-disease combination in demo mode and get a complete, customised report instantly. The system dynamically adapts the B7-H3 fixtures to match your query.

### Streaming Evidence in Real Time
Every agent event is streamed to the browser via Server-Sent Events. You can watch the knowledge graph build edge-by-edge as the loop runs.

### Persistent Knowledge Graph
Evidence accumulates across all queries in a session. Cross-target ranking explains *why* one target ranks over another on each axis using the Prometheux `differentiates` predicate.

### Human-in-the-Loop Gate
Enable `hitl=1` in the URL to pause the loop at each reviewer checkpoint for a human decision via `/api/decision`. Auto-approves after 3 minutes if no decision arrives.

### x402 Payment-Gated Cited Report
`/api/report` returns HTTP 402 on first access with payment terms. A retry carrying a valid `X-PAYMENT` header receives the full `cited.md` with a settlement receipt — demonstrating agent-economy IP monetisation.

### Non-Silenceable Safety Hard-Gate
A target with strong validity evidence but zero safety evidence is `unsafe_advance` — NO-GO regardless of total score. This is a formal logic rule, not an LLM opinion.

---

## 🧪 Testing

```bash
python -m pytest                    # 133 tests
python -m pytest -v                 # verbose
python -m pytest tests/test_prometheux_reason.py -v   # reasoning layer only
```

| Test file | Coverage |
|---|---|
| `test_cso.py` | Routing, evidence grading, plan validation, re-route logic |
| `test_harness.py` | Full loop, convergence, budget gating, deeper re-route |
| `test_prometheux_reason.py` | Vadalog rules, gap detector, decision tiers, safety hard-gate |
| `test_profiler.py` | Tau index, bimodality coefficient, cell-type ranking |
| `test_openfda_safety.py` | FDA adverse event parsing |
| `test_opentargets_*.py` | Open Targets GraphQL response parsing |
| `test_tcga_somatic_profiler.py` | TCGA mutation frequency computation |

---

## 📊 The B7-H3 Case Study

The default demo walks through **B7-H3 (CD276)** as an ADC target in **NSCLC**:

| Evidence Step | Skill | Finding |
|---|---|---|
| Genetic support (GWAS) | `gwas-lookup` | Limited genome-wide signal — expression target, not genetics target |
| Cell-type expression | `cellxgene-fetch` | High expression in lung adenocarcinoma tumour cells |
| Specificity (tau) | `celltype-specificity-profiler` | tau = 0.74 — moderately specific; fibroblast co-expression is primary liability |
| Off-target safety | `openfda-safety` | Moderate-low risk; no FAERS boxed warning for CD276-targeting agents |
| Clinical precedent | `clinical-trial-finder` | Multiple Phase I/II ADC programs active |
| Literature | `lit-synthesizer` | Strong competitive landscape; ADC modality validated |

**Verdict: CONDITIONAL GO** — Coverage 2.5/4.0. Safety covered, tractability strong. Genetics weak (expected for an ADC target). Recommend re-route to malignant-expression-profiler.

---

## 🏆 Prize Targeting

> 🎯 **Prometheux Intelligence Prize** — The entire verdict layer is a Vadalog program: recursive rules, `@model`/`@explain` annotations, structural gap-detector that forces re-work from deductive facts, `differentiates` predicate for explain-a-rank.

> 🔍 **Tavily Prize** — `lit-synthesizer` uses Tavily for three-angle live search (recent papers · competitive landscape · safety signals). Every result cited with source URL.

> 🧬 **ClawBio Prize** — All scientist agent tools run on ClawBio. We contribute two new skills: `phronesis-cso` and `celltype-specificity-profiler`.

---

## 📚 References

- **Paper:** [The Virtual Biotech](https://www.biorxiv.org/content/10.64898/2026.02.23.707551v1) — Zhang, Eckmann, Miao, Mahon & Zou, Stanford / PHD Biosciences, 2026
- **Platform:** [ClawBio](https://clawbio.ai/) · [Prometheux](https://prometheux.ai) · [Tavily](https://tavily.com)
- **Databases:** [Open Targets](https://platform.opentargets.org/) · [CELLxGENE](https://cellxgene.cziscience.com/) · [ClinicalTrials.gov](https://clinicaltrials.gov/) · [openFDA](https://open.fda.gov/) · [GWAS Catalog](https://www.ebi.ac.uk/gwas/)
- **Hackathon:** [Multiagents Hackathon](https://multiagents-hackathon.devpost.com/) — Tessl AI, London, 26 Jun 2026 · Sponsors: Google DeepMind · Prometheux · Tavily · ClawBio · Gensyn

---

<div align="center">
<sub>Phronesis CSO is a research and educational tool — not a medical device. Do not use for clinical decisions.</sub>
</div>
