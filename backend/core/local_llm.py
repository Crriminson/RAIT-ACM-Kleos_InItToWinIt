"""
core/local_llm.py — Local LLM client via Ollama (Qwen3 4B).

Used as a fallback when Gemini is unavailable or as the primary LLM.
Ollama exposes an OpenAI-compatible API at localhost:11434.

Every caller should wrap these in try/except — local LLM is best-effort.
"""
from __future__ import annotations

import json
import logging
import os
import re
import httpx

log = logging.getLogger(__name__)

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen3:4b")


def is_available() -> bool:
    """Check if Ollama is reachable and the model is loaded."""
    try:
        r = httpx.get(f"{OLLAMA_URL}/api/tags", timeout=2.0)
        if r.status_code != 200:
            return False
        models = [m.get("name", "") for m in r.json().get("models", [])]
        return any(OLLAMA_MODEL in m for m in models)
    except Exception:
        return False


def _strip_think(text: str) -> str:
    """Remove <think>...</think> blocks that Qwen3 emits for chain-of-thought."""
    return re.sub(r'<think>.*?</think>', '', text, flags=re.DOTALL).strip()


def _strip_fences(text: str) -> str:
    return text.replace("```json", "").replace("```", "").strip()


def generate_text(prompt: str, temperature: float = 0.7) -> str:
    """Plain-text generation via Ollama. Thinking mode disabled for speed."""
    r = httpx.post(
        f"{OLLAMA_URL}/api/chat",
        json={
            "model": OLLAMA_MODEL,
            "messages": [
                {"role": "user", "content": "/no_think\n" + prompt},
            ],
            "stream": False,
            "options": {"temperature": temperature, "num_predict": 1024},
        },
        timeout=60.0,
    )
    r.raise_for_status()
    msg = r.json().get("message", {})
    text = (msg.get("content", "") if isinstance(msg, dict) else "").strip()
    text = _strip_think(text)
    if not text:
        raise RuntimeError("Empty response from local LLM.")
    return text


def generate_json(prompt: str, temperature: float = 0.3) -> dict:
    """JSON generation via Ollama. Parses the response as JSON."""
    json_prompt = prompt + "\n\nRespond with ONLY valid JSON, no markdown fences, no explanation. Keep it concise."
    text = generate_text(json_prompt, temperature=temperature)
    text = _strip_fences(text)
    return json.loads(text)
