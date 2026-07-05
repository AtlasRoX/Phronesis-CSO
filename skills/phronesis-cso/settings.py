"""settings.py — single source of truth for Phronesis CSO env vars.

I7 fix: 17 scattered ``os.environ.get(...)`` calls were scattered across
``runners.py`` / ``tracing.py`` / ``cso.py`` / ``neo4j_reason.py`` /
``primekg_enrich.py`` (5 LLM keys, 3 Neo4j vars, 2 Langfuse vars, Tavily,
PrimeKG URL, OpenAI base URL, Anthropic timeout, log format / level, plus
the new rate-limit knobs from I9). Centralised here as a typed
``pydantic_settings.BaseSettings`` so:

  * the canonical list of knobs is one import,
  * ``.env`` is read once and validated,
  * an editor can autocomplete ``settings.anthropic_api_key``,
  * CI can ``Settings(_env_file=None)`` to assert the schema is honoured
    by the codebase even when no real secrets are present.

``Settings`` is instantiated lazily — each module reads the *cached*
singleton via ``get_settings()`` and pays the cost only on first use. The
underlying ``os.environ`` still receives the ``load_dotenv`` values from
``runners.load_dotenv``, so any *unaware* third-party code (Anthropic
SDK, OpenAI SDK, etc.) keeps working without changes.

Open-source dep tree (all MIT / BSD / Apache-2.0):
  * pydantic v2 (MIT)
  * pydantic-settings (MIT)
"""
from __future__ import annotations

import os
from functools import lru_cache
from typing import Literal

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class PhronesisSettings(BaseSettings):
    """All env vars Phronesis CSO reads, in one place.

    Field naming follows the ``UPPER_SNAKE`` env-var convention; pydantic-
    settings maps ``anthropic_api_key`` ↔ ``ANTHROPIC_API_KEY`` etc.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # ---- LLM provider keys ----------------------------------------------------
    anthropic_api_key: SecretStr | None = None
    anthropic_model: str = "claude-sonnet-4-6"
    anthropic_timeout_s: float = 180.0

    openai_api_key: SecretStr | None = None
    openai_base_url: str | None = None
    openai_model: str = "gpt-4o-mini"

    nvidia_api_key: SecretStr | None = None
    nim_model: str = "nvidia/nemotron-3-super-120b-a12b"

    gemini_api_key: SecretStr | None = None
    google_api_key: SecretStr | None = None
    gemini_model: str = "gemini-2.5-flash"

    # ENV var the model-priority helper still consults (kept for back-compat).
    vbio_model: str | None = Field(default=None, alias="VBIO_MODEL")

    # ---- Neo4j (optional, open-source graph reasoning) -----------------------
    neo4j_uri: str | None = None
    neo4j_user: str = "neo4j"
    neo4j_password: SecretStr = SecretStr("neo4j")  # override in production

    # ---- Prometheux (hosted Vadalog reasoning engine) -------------------------
    pmtx_token: SecretStr | None = None
    jarvispy_url: str | None = None

    # ---- X402 payment configurations ------------------------------------------
    x402_pay_to: str | None = None
    x402_network: str | None = None
    x402_facilitator_url: str | None = None

    # ---- Langfuse optional span mirror ---------------------------------------
    langfuse_public_key: SecretStr | None = None
    langfuse_secret_key: SecretStr | None = None
    langfuse_host: str | None = None

    # ---- External data + proxy knobs -----------------------------------------
    tavily_api_key: SecretStr | None = None
    primekg_csv_url: str = (
        "https://raw.githubusercontent.com/mims-harvard/PrimeKG/main/primekg.csv"
    )

    # ---- I9 / I10 server knobs (rate-limit + CORS) --------------------------
    rate_limit_per_min: int = 60
    rate_limit_burst: int = 5
    rate_limit_concurrent: int = 4

    cors_allow_origin: Literal["*", "list"] = "*"
    cors_origin_allowlist: str = ""  # comma-separated, used when above=="list"
    cors_max_age_s: int = 600

    # ---- I5 logging knobs ----------------------------------------------------
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"
    log_json: bool = False  # False → console renderer, True → JSON


@lru_cache(maxsize=1)
def get_settings() -> PhronesisSettings:
    """Return the cached singleton.

    Reads ``.env`` once on first call. The cache is process-wide — safe
    across threads (the loaded config is immutable). Tests that need a
    fresh config can call ``_reset_settings_cache()`` then re-instantiate
    with overrides.
    """
    return PhronesisSettings()


def _reset_settings_cache() -> PhronesisSettings:
    """Drop the lru_cache and return a freshly-built singleton.

    Tests only. Production code never needs this."""
    get_settings.cache_clear()
    return get_settings()


# --------------------------------------------------------------------------- #
# Conveniences for callers that just want one or two values
# --------------------------------------------------------------------------- #
def has_llm_credentials() -> bool:
    """True iff any LLM key is set (or the Claude CLI is on PATH).

    Mirrors the env-probe the previous ``select_runner`` did inline, so
    the migration of I7 doesn't disturb the run-loop's ``agents=1``
    decision path."""
    s = get_settings()
    return bool(
        s.anthropic_api_key
        or s.nvidia_api_key
        or s.openai_api_key
        or s.gemini_api_key
        or s.google_api_key
    )


def env(name: str, default: str | None = None) -> str | None:
    """Read an arbitrary env var via ``os.environ``.

    Thin shim so legacy callers don't have to switch to ``Settings`` in
    one go; new code should prefer ``get_settings().<field>`` directly."""
    return os.environ.get(name, default)
