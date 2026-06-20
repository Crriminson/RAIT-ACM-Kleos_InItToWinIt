"""
api/auth.py — API key authentication for all non-public endpoints.

Every route that mutates state or touches the pipeline should depend on
`require_api_key`.  Health-check and webhook-verification (GET) are exempt.

The key is read from the KLEOS_API_KEY env var.  If unset, a random key is
generated on first import and printed to the console — so local dev "just
works" but nothing is silently open.
"""
from __future__ import annotations

import os
import secrets
import logging

from fastapi import Depends, HTTPException, Security
from fastapi.security import APIKeyHeader

log = logging.getLogger(__name__)

_header_scheme = APIKeyHeader(name="X-API-Key", auto_error=False)

_api_key: str | None = os.getenv("KLEOS_API_KEY")

if not _api_key:
    _api_key = secrets.token_urlsafe(32)
    log.warning(
        "KLEOS_API_KEY not set — generated ephemeral key for this session:\n"
        "  X-API-Key: %s\n"
        "Set KLEOS_API_KEY in backend/.env to make it persistent.",
        _api_key,
    )


def get_api_key() -> str:
    """Return the active API key (for tests or internal use)."""
    assert _api_key is not None
    return _api_key


async def require_api_key(
    key: str | None = Security(_header_scheme),
) -> str:
    """FastAPI dependency — rejects requests without a valid X-API-Key header."""
    if not key or key != _api_key:
        raise HTTPException(status_code=401, detail="Missing or invalid API key")
    return key
