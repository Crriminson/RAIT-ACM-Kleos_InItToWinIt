import os

import httpx

from .base import BaseLLMProvider, LLMResponse

GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta"


class GeminiProvider(BaseLLMProvider):
    def __init__(self, api_key: str | None = None, model: str = "gemini-1.5-flash"):
        self.api_key = api_key or os.environ.get("GEMINI_API_KEY", "")
        self.model = model

    async def complete(self, prompt, system_prompt="", max_tokens=1024, temperature=0.2) -> LLMResponse:
        url = f"{GEMINI_BASE}/models/{self.model}:generateContent?key={self.api_key}"
        payload: dict = {
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {"maxOutputTokens": max_tokens, "temperature": temperature},
        }
        if system_prompt:
            payload["systemInstruction"] = {"parts": [{"text": system_prompt}]}

        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(url, json=payload)
            r.raise_for_status()
            data = r.json()

        text = data["candidates"][0]["content"]["parts"][0]["text"]
        tokens = data.get("usageMetadata", {}).get("totalTokenCount")
        return LLMResponse(text=text, model=self.model, tokens_used=tokens)

    async def health_check(self) -> bool:
        try:
            r = await self.complete("ping", max_tokens=5)
            return bool(r.text)
        except Exception:
            return False
