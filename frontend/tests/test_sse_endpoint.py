"""Tests for the SSE streaming + rate-limit + CORS preflight in ``frontend/server.py``.

These tests spin the handler's BaseHTTPRequestHandler up via a real
ThreadingHTTPServer loopback bound on a random port, then talk to it with
``urllib.request`` (so we never add a network dep to the test suite). The
goal is not to validate the multi-agent loop — that's covered end-to-end by
``cso.py --demo`` — but to defend the *boundary contract* the frontend depends
on:

  * GET /api/run responds 200 with ``Content-Type: text/event-stream`` for a
    real run, and emits at least one ``event: ...\\ndata: ...\\n\\n`` frame.
  * GET /api/run responds 429 with ``Retry-After`` once the per-IP burst is
    consumed.
  * OPTIONS /api/run with a preflight request returns 200 with
    ``Access-Control-Allow-Origin: *``, ``Access-Control-Allow-Methods``,
    ``Access-Control-Allow-Headers`` (echoing the requested headers), and
    ``Access-Control-Max-Age`` greater than 0.
  * GET /api/ledger returns 200 with valid JSON.
"""
from __future__ import annotations

import json
import os
import socket
import sys
import urllib.error
import urllib.request
from pathlib import Path
from threading import Thread

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))                          # frontend/
sys.path.insert(0, str(HERE.parent.parent / "skills" / "phronesis-cso"))

# We import the module under test AFTER configuring the burst/mode knobs so the
# module-level globals land at the values the test exercises.
os.environ.setdefault("RATE_LIMIT_BURST", "2")
os.environ.setdefault("RATE_LIMIT_PER_MIN", "120")
os.environ.setdefault("RATE_LIMIT_CONCURRENT", "1")
os.environ.setdefault("CORS_MAX_AGE_S", "600")

import server  # noqa: E402


def _free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


class _LiveThread:
    """Run the real ``server.Handler`` against a loopback server on a thread.

    We bind a fresh ``ThreadingHTTPServer`` (rather than touching the module's
    global CONFIG["backend"]) so each test gets a clean in-process server. The
    server's ``KG.KnowledgeGraph`` is a module-level singleton — which is fine
    because we don't assert on graph contents here."""

    def __init__(self) -> None:
        self.port = _free_port()
        self.httpd = server.ThreadingHTTPServer(
            ("127.0.0.1", self.port), server.Handler)
        # Force the demo path — no LLM key, no network — so /api/run finishes
        # within a few hundred ms and the test isn't gated by an API quota.
        server.CONFIG["backend"] = "stub"
        server.CONFIG["model"] = None
        self._t = Thread(target=self.httpd.serve_forever, daemon=True)
        self._t.start()

    def stop(self) -> None:
        self.httpd.shutdown()
        self.httpd.server_close()
        self._t.join(timeout=2)

    def url(self, path: str, qs: str = "") -> str:
        return f"http://127.0.0.1:{self.port}{path}{('?' + qs) if qs else ''}"


def _http(method: str, url: str, headers: dict | None = None) -> tuple[int, dict, bytes]:
    """Plain (non-streaming) HTTP — read body to EOF."""
    req = urllib.request.Request(url, method=method, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status, dict(resp.headers), resp.read()
    except urllib.error.HTTPError as exc:  # 4xx/5xx carry headers + body
        return exc.code, dict(exc.headers), exc.read()


def _read_sse_partial(url: str, max_bytes: int = 8192, timeout: float = 8) -> tuple[int, dict, bytes]:
    """Open a streaming response and read up to ``max_bytes`` (SSE never ends
    on its own during a long run, so we don't try to drain it)."""
    req = urllib.request.Request(url, headers={"Connection": "close"})
    resp = urllib.request.urlopen(req, timeout=timeout)
    body = resp.read(max_bytes)
    status, headers = resp.status, dict(resp.headers)
    resp.close()
    return status, headers, body


# --------------------------------------------------------------------------- #
# happy path
# --------------------------------------------------------------------------- #
def test_sse_happy_path():
    s = _LiveThread()
    try:
        status, headers, body = _read_sse_partial(
            s.url("/api/run", "query=B7-H3%20in%20NSCLC&agents=0"))
        assert status == 200, status
        assert "text/event-stream" in headers.get("Content-Type", "")
        text = body.decode("utf-8", errors="replace")
        # At least one well-formed SSE frame
        assert "event: " in text and "data: " in text, text[:200]
        assert "\n\n" in text  # frames end with a blank line
    finally:
        s.stop()


def test_api_ledger_returns_json():
    s = _LiveThread()
    try:
        status, headers, body = _http("GET", s.url("/api/ledger"))
        assert status == 200
        assert "json" in headers.get("Content-Type", "")
        payload = json.loads(body)
        assert "rows" in payload and "kg_nodes" in payload
    finally:
        s.stop()


# --------------------------------------------------------------------------- #
# rate-limit
# --------------------------------------------------------------------------- #
def test_rate_limit_returns_429_after_burst():
    """Open ``_BURST + 1`` connections. The first N succeed (consume tokens);
    the next gets 429 with Retry-After. Each is read partially and closed so
    the test doesn't wait for the full run."""
    s = _LiveThread()
    try:
        statuses: list[int] = []
        for _ in range(server._BURST + 2):
            try:
                status, _, _ = _read_sse_partial(
                    s.url("/api/run", "query=B7-H3&agents=0"), max_bytes=64, timeout=2)
                statuses.append(status)
            except urllib.error.HTTPError as exc:
                statuses.append(exc.code)
                if exc.code == 429:
                    assert "Retry-After" in dict(exc.headers), dict(exc.headers)
        # The last few attempts should have hit 429 once the burst + cap are gone.
        # We allow some slop because of refill timing.
        assert any(st == 429 for st in statuses), statuses
    finally:
        s.stop()


# --------------------------------------------------------------------------- #
# CORS preflight
# --------------------------------------------------------------------------- #
def test_cors_preflight_returns_proper_headers():
    s = _LiveThread()
    try:
        status, headers, body = _http("OPTIONS", s.url("/api/run"), headers={
            "Origin": "https://example.com",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "content-type, x-custom",
        })
        assert status == 200, status
        assert headers.get("Access-Control-Allow-Origin") == "*"
        assert "GET" in headers.get("Access-Control-Allow-Methods", "")
        assert "POST" in headers.get("Access-Control-Allow-Methods", "")
        assert headers.get("Access-Control-Allow-Headers") == "content-type, x-custom"
        assert int(headers.get("Access-Control-Max-Age", "0")) > 0
        assert body == b""
    finally:
        s.stop()


def test_cors_preflight_on_uncached_path_still_responds():
    # A preflight to a non-existent path should still succeed (the handler
    # routes OPTIONS at the protocol level — same headers as the canonical path).
    s = _LiveThread()
    try:
        status, headers, _ = _http("OPTIONS", s.url("/api/some-other-route"), headers={
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "x-test",
        })
        assert status == 200
        assert headers.get("Access-Control-Allow-Origin") == "*"
        # The handler echoes the requested headers exactly.
        assert headers.get("Access-Control-Allow-Headers") == "x-test"
        assert int(headers.get("Access-Control-Max-Age", "0")) > 0
    finally:
        s.stop()


# --------------------------------------------------------------------------- #
# sanity: the rate-limit state is per-IP (no global leak between tests)
# --------------------------------------------------------------------------- #
def test_token_bucket_is_per_ip():
    """Two distinct buckets each start full and are drained independently."""
    a = server._TokenBucket(server._BURST, server._RATE_PER_S)
    b = server._TokenBucket(server._BURST, server._RATE_PER_S)
    # Drain A
    for _ in range(server._BURST):
        ok, _ = a.take()
        assert ok is True
    ok, retry = a.take()
    assert ok is False and retry >= 1
    # B is still at full burst, untouched by A's drain
    for _ in range(server._BURST):
        ok, _ = b.take()
        assert ok is True
