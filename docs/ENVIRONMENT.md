# Phronesis CSO Environment Configuration Guide

This document lists and explains all environment variables available in the **Phronesis CSO** project. These variables configure model backends, external search/lit-synthesis APIs, Prometheux reasoning engine, Langfuse trace mirroring, and the payment gateway.

All keys should be configured in a `.env` file in the root directory.

---

## 1. LLM Backend API Keys (Multi-Agent Loop)

The system is plug-in ready for 4 major model providers. When running in `--backend auto` (default), the harness auto-selects the first available provider key in this order:

| Order | Key | Default Model | Runner Class |
|:---:|---|---|---|
| **1** | `ANTHROPIC_API_KEY` | `claude-sonnet-4-6` | `AnthropicRunner` |
| **2** | `NVIDIA_API_KEY` | `nvidia/llama-3.1-nemotron-ultra-253b-v1` | `NIMRunner` |
| **3** | `OPENAI_API_KEY` | `gpt-4o-mini` | `OpenAIRunner` |
| **4** | `GEMINI_API_KEY` / `GOOGLE_API_KEY` | `gemini-2.5-flash` | `GeminiRunner` |

### Provider Configuration Details

### `ANTHROPIC_API_KEY`
* **Purpose**: Primary backend provider key for running Anthropic's Claude models.
* **Where to get**: [Anthropic Console](https://console.anthropic.com/).

### `NVIDIA_API_KEY`
* **Purpose**: Access NVIDIA NIM hosted LLMs (e.g. Llama-3.1-Nemotron-Ultra-253B).
* **Where to get**: [NVIDIA Build Inference Platform](https://build.nvidia.com).
* **Note**: Overridable to smaller NIM models (like `nvidia/llama-3.1-nemotron-70b-instruct`) using `VBIO_MODEL`.

### `OPENAI_API_KEY`
* **Purpose**: Access OpenAI's models or custom OpenAI-compatible gateways.
* **Where to get**: [OpenAI Platform](https://platform.openai.com/).
* **Optional**: Configure `OPENAI_BASE_URL` to point to self-hosted LLM endpoints or local proxies.

### `GEMINI_API_KEY` / `GOOGLE_API_KEY`
* **Purpose**: Access Google's Gemini models via Google AI Studio's compatible OpenAI endpoint.
* **Where to get**: [Google AI Studio](https://aistudio.google.com/).

---

## 2. Model Override Options

### `VBIO_MODEL`
* **Purpose**: Explicitly forces the agent loop runners to use a specific model identifier instead of their default.
* **Examples**:
  * `VBIO_MODEL=nvidia/llama-3.1-nemotron-ultra-253b-v1` (NVIDIA NIM)
  * `VBIO_MODEL=claude-opus-4-5` (Anthropic Flagship)
  * `VBIO_MODEL=gpt-4o` (OpenAI Flagship)
  * `VBIO_MODEL=gemini-2.5-pro` (Gemini Pro)

---

## 3. Prometheux (Hosted Vadalog Reasoning Engine)

By default, the evidence-graph Datalog rules fall back to a local in-process reasoner (offline, no network). To run the reasoning rules over the live hosted Prometheux engine (joining against PrimeKG), configure both variables:

### `PMTX_TOKEN`
* **Purpose**: Authentication token to connect to your Prometheux account.
* **Where to get**: Prometheux Web App.

### `JARVISPY_URL`
* **Purpose**: Endpoint routing URL matching your hosted Prometheux organization and username.
* **Format**: `https://api.prometheux.ai/jarvispy/{org}/{username}`
* **Note**: Requires an active, running compute machine in your Prometheux compute management panel.

---

## 4. Search API (Lit-Synthesizer)

### `TAVILY_API_KEY`
* **Purpose**: Powers live web/literature search for target-disease evidence in the `lit-synthesizer` skill.
* **Where to get**: [Tavily AI](https://tavily.com).
* **Fallback**: When not set (or when running with the `--demo` flag), the skill bypasses the API and returns cached demo search mock data, keeping the loop functional.

---

## 5. Langfuse Tracing

Tracing is completely local by default (`trace.jsonl` files). To mirror agent execution traces to Langfuse Cloud/self-hosted console, both keys must be set:

### `LANGFUSE_PUBLIC_KEY` & `LANGFUSE_SECRET_KEY`
* **Purpose**: public and secret keys for authenticating to Langfuse.
* **Where to get**: [Langfuse Console](https://cloud.langfuse.com/).

### `LANGFUSE_HOST`
* **Purpose**: API host endpoint for self-hosted instances (omit to default to Langfuse Cloud).

---

## 6. X402 payment system

The payment gate is configured via these variables:

### `X402_PAY_TO`
* **Purpose**: The wallet address to receive the payment.

### `X402_NETWORK`
* **Purpose**: The target blockchain/payment network (e.g. `XRPL`, `Solana`).

### `X402_FACILITATOR_URL`
* **Purpose**: Settle payment requests live using an external facilitator (leaves the payment gateway mock-mode when unset).
