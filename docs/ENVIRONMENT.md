# Phronesis CSO Environment Configuration Guide

This document lists and explains all environment variables available in the **Phronesis CSO** project. These variables configure model backends, external search/lit-synthesis APIs, reasoning engines (Prometheux/Neo4j), Langfuse trace mirroring, logging, rate limiting, and the payment gateway.

All keys should be configured in a `.env` file in the root directory.

---

## 1. LLM Backend API Keys (Multi-Agent Loop)

The system is plug-in ready for 4 major model providers. When running in `--backend auto` (default), the harness auto-selects the first available provider key in this order:

| Order | Key | Default Model | Runner Class |
|:---:|---|---|---|
| **1** | `ANTHROPIC_API_KEY` | `claude-sonnet-4-6` | `AnthropicRunner` |
| **2** | `NVIDIA_API_KEY` | `nvidia/nemotron-3-super-120b-a12b` | `NIMRunner` |
| **3** | `OPENAI_API_KEY` | `gpt-4o-mini` | `OpenAIRunner` |
| **4** | `GEMINI_API_KEY` / `GOOGLE_API_KEY` | `gemini-2.5-flash` | `GeminiRunner` |

### Provider Configuration Details

### `ANTHROPIC_API_KEY`
* **Purpose**: Primary backend provider key for running Anthropic's Claude models.
* **Where to get**: [Anthropic Console](https://console.anthropic.com/).

### `NVIDIA_API_KEY`
* **Purpose**: Access NVIDIA NIM hosted LLMs (e.g. Nemotron-3-Super-120B).
* **Where to get**: [NVIDIA Build Inference Platform](https://build.nvidia.com).

### `OPENAI_API_KEY`
* **Purpose**: Access OpenAI's models or custom OpenAI-compatible gateways.
* **Where to get**: [OpenAI Platform](https://platform.openai.com/).

### `GEMINI_API_KEY` / `GOOGLE_API_KEY`
* **Purpose**: Access Google's Gemini models via Google AI Studio's compatible OpenAI endpoint.
* **Where to get**: [Google AI Studio](https://aistudio.google.com/).

---

## 2. Model Override Options

The system supports granular model name overrides and timeouts via environment variables:

### `VBIO_MODEL`
* **Purpose**: Explicitly forces the agent loop runners to use a specific model identifier instead of their default.
* **Examples**:
  * `VBIO_MODEL=nvidia/nemotron-3-super-120b-a12b`
  * `VBIO_MODEL=claude-opus-4-5`
  * `VBIO_MODEL=gpt-4o`
  * `VBIO_MODEL=gemini-2.5-pro`

### `ANTHROPIC_MODEL`
* **Purpose**: Override default Anthropic model name (default: `claude-sonnet-4-6`).

### `ANTHROPIC_TIMEOUT_S`
* **Purpose**: Timeout in seconds for Anthropic API calls (default: `180.0`).

### `OPENAI_MODEL`
* **Purpose**: Override default OpenAI model name (default: `gpt-4o-mini`).

### `OPENAI_BASE_URL`
* **Purpose**: Point to self-hosted LLM endpoints or local proxies for OpenAI-compatible runners.

### `NIM_MODEL`
* **Purpose**: Override default NVIDIA NIM model name (default: `nvidia/nemotron-3-super-120b-a12b`).

### `GEMINI_MODEL`
* **Purpose**: Override default Gemini model name (default: `gemini-2.5-flash`).

---

## 3. Prometheux (Hosted Vadalog Reasoning Engine)

By default, the evidence-graph reasoning rules fall back to a local in-process reasoner (offline, no network). To run the reasoning rules over the live hosted Prometheux engine (joining against PrimeKG), configure both variables:

### `PMTX_TOKEN`
* **Purpose**: Authentication token to connect to your Prometheux account.
* **Where to get**: Prometheux Web App.

### `JARVISPY_URL`
* **Purpose**: Endpoint routing URL matching your hosted Prometheux organization and username.
* **Format**: `https://api.prometheux.ai/jarvispy/{org}/{username}`
* **Note**: Requires an active, running compute machine in your Prometheux compute management panel.

---

## 4. Neo4j Local Graph Database Engine (Alternative Reasoning Engine)

A local-first alternative graph reasoning stack built on Neo4j and Cypher query patterns. The four recursive reasoning rules (`co_niche`, `shares_axis`, `strong_claim`, `differentiates`) are executed directly on your local Neo4j instance. Degrades to the local in-process Python reasoner if Neo4j is unreachable.

### `NEO4J_URI`
* **Purpose**: Bolt/connection URI for the local or remote Neo4j instance.
* **Default**: `bolt://localhost:7687`

### `NEO4J_USER`
* **Purpose**: Username for the Neo4j database.
* **Default**: `neo4j`

### `NEO4J_PASSWORD`
* **Purpose**: Password for the Neo4j database (strongly recommended to change in production).
* **Default**: `neo4j`

---

## 5. Search API & Datasets

### `TAVILY_API_KEY`
* **Purpose**: Powers live web/literature search for target-disease evidence in the `lit-synthesizer` skill.
* **Where to get**: [Tavily AI](https://tavily.com).
* **Fallback**: When not set (or when running with the `--demo` flag), the skill bypasses the API and returns cached demo search mock data, keeping the loop functional.

### `PRIMEKG_CSV_URL`
* **Purpose**: The source URL pointing to the PrimeKG (Prime Knowledge Graph) CSV file for mapping biomedical relationships.
* **Default**: `https://raw.githubusercontent.com/mims-harvard/PrimeKG/main/primekg.csv`

---

## 6. Langfuse Tracing

Tracing is completely local by default (`trace.jsonl` files). To mirror agent execution traces to Langfuse Cloud/self-hosted console, both keys must be set:

### `LANGFUSE_PUBLIC_KEY` & `LANGFUSE_SECRET_KEY`
* **Purpose**: Public and secret keys for authenticating to Langfuse.
* **Where to get**: [Langfuse Console](https://cloud.langfuse.com/).

### `LANGFUSE_HOST`
* **Purpose**: API host endpoint for self-hosted instances (omit to default to Langfuse Cloud).

---

## 7. X402 Payment System

The payment gate is configured via these variables:

### `X402_PAY_TO`
* **Purpose**: The wallet address to receive the payment.

### `X402_NETWORK`
* **Purpose**: The target blockchain/payment network (e.g. `XRPL`, `Solana`).

### `X402_FACILITATOR_URL`
* **Purpose**: Settle payment requests live using an external facilitator (leaves the payment gateway mock-mode when unset).

---

## 8. Server Rate-Limit + CORS (frontend `server.py`)

Read at boot from `PhronesisSettings` (the same Pydantic singleton every other module uses; see `skills/phronesis-cso/settings.py`). Defaults are picked for local dev; tighten in production.

### `RATE_LIMIT_BURST`
* **Purpose**: Per-IP token bucket capacity for `/api/run`. The bucket refills at `RATE_LIMIT_PER_MIN / 60` tokens per second; exceeding `BURST` causes the next request to return `429` with `Retry-After`.
* **Default**: `5`.

### `RATE_LIMIT_PER_MIN`
* **Purpose**: Steady-state per-IP request rate; together with `RATE_LIMIT_BURST` defines the token-bucket refill rate.
* **Default**: `60`.

### `RATE_LIMIT_CONCURRENT`
* **Purpose**: Global cap on in-flight `/api/run` streams. A request beyond this cap replies `429` (with `Retry-After`) before the SSE handshake — protects the multi-agent loop from concurrent LLM-heavy runs.
* **Default**: `4`.

### `CORS_MAX_AGE_S`
* **Purpose**: `Access-Control-Max-Age` value returned by the `OPTIONS` preflight handler so a browser can cache preflight responses for the configured window.
* **Default**: `600`.

---

## 9. Logging (structlog)

The `Trace` class in `harness.py` and the `frontend/server.py` boot path emit structured events via `structlog`. The log format is chosen based on whether stdout is a TTY (developer console formatting on a TTY, JSON format when stdout is redirected).

### `LOG_JSON`
* **Purpose**: Force the JSON renderer even on a TTY. Set `LOG_JSON=1` for CI / docker logs / journalctl so the events land in your log shipper.
* **Default**: unset → Console renderer on a TTY, JSON renderer when stdout is redirected.

### `LOG_LEVEL`
* **Purpose**: Filter events below this level. `DEBUG` is chatty (every reroute step). `WARNING` keeps only errors.
* **Default**: `INFO`.
