"""
core/gemini.py — Gemini client wrapper (google-genai SDK)

Centralises all Gemini access for the AI endpoints (Ask-a-CA, advisory,
tax planning, invoice comparison, and vision-based invoice extraction).

Mirrors the behaviour of the earlier Node/Express AI server it replaced:
  - Lazily constructs a single client.
  - `has_key()` reports whether a usable key is configured (so /api/health
    and each route can decide between "gemini" and "fallback" mode).
  - `generate_text()` / `generate_json()` wrap generate_content with a small
    retry on transient 429/503 spikes.
  - `generate_json_from_image()` handles the vision (OCR) path.

Every caller is expected to wrap these in try/except and fall back to the
offline responses — Gemini is an enhancement, never a hard dependency.
"""
from __future__ import annotations

import json
import logging
import os
import re
import time
from typing import Any

log = logging.getLogger(__name__)

MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

_PLACEHOLDER = "YOUR_GEMINI_API_KEY"
_client = None  # lazily created google.genai.Client


def _api_key() -> str:
    return (os.getenv("GEMINI_API_KEY") or "").strip()


def has_key() -> bool:
    """True when a non-placeholder Gemini key is configured."""
    k = _api_key()
    return bool(k) and k != _PLACEHOLDER


def _get_client():
    """Return a shared google.genai.Client, creating it on first use."""
    global _client
    if _client is None:
        if not has_key():
            raise RuntimeError("GEMINI_API_KEY is not configured.")
        from google import genai  # imported lazily so the app boots without the SDK
        _client = genai.Client(api_key=_api_key())
    return _client


# ---------------------------------------------------------------------------
# Retry wrapper (transient 429/503 spikes) — mirrors the Node retryGenerate
# ---------------------------------------------------------------------------

_TRANSIENT = re.compile(
    r"(503|429|UNAVAILABLE|high demand|temporary|Too Many Requests)", re.IGNORECASE
)


def _generate(contents: Any, *, json_mode: bool, retries: int = 3, delay: float = 1.2):
    client = _get_client()
    from google.genai import types

    config = (
        types.GenerateContentConfig(response_mime_type="application/json")
        if json_mode
        else None
    )

    attempt = 0
    while True:
        try:
            return client.models.generate_content(
                model=MODEL, contents=contents, config=config
            )
        except Exception as exc:  # noqa: BLE001 — classify then re-raise
            attempt += 1
            if _TRANSIENT.search(str(exc)) and attempt < retries:
                time.sleep(delay)
                delay *= 2.2
                continue
            raise


# ---------------------------------------------------------------------------
# Public helpers
# ---------------------------------------------------------------------------

def _strip_fences(text: str) -> str:
    return text.replace("```json", "").replace("```", "").strip()


def generate_text(prompt: str) -> str:
    """Plain-text generation. Raises on empty output or API error."""
    resp = _generate(prompt, json_mode=False)
    text = (resp.text or "").strip()
    if not text:
        raise RuntimeError("Empty response from Gemini.")
    return text


def generate_json(prompt: str) -> dict:
    """JSON generation. Raises on empty/invalid output or API error."""
    resp = _generate(prompt, json_mode=True)
    text = resp.text or ""
    if not text.strip():
        raise RuntimeError("Empty response from Gemini.")
    return json.loads(_strip_fences(text))


def generate_json_from_image(prompt: str, image_bytes: bytes, mime_type: str) -> dict:
    """Vision generation (invoice OCR). Raises on empty/invalid output or API error."""
    from google.genai import types

    contents = [
        types.Part.from_bytes(data=image_bytes, mime_type=mime_type or "image/jpeg"),
        prompt,
    ]
    resp = _generate(contents, json_mode=True)
    text = resp.text or ""
    if not text.strip():
        raise RuntimeError("Empty response from Gemini.")
    return json.loads(_strip_fences(text))
