import os

import httpx

from .base import BaseLLMProvider, LLMResponse


class OpenAICompatProvider(BaseLLMProvider):

    def __init__(
        self,
        api_key: str | None = None,
        model: str = "gpt-3.5-turbo",
        base_url: str | None = None,
    ):
        self.api_key = api_key or os.environ.get("OPENAI_API_KEY", "")
        self.model = model
        self.base_url = base_url or os.environ.get(
            "OPENAI_BASE_URL", "https://api.openai.com/v1"
        )

    async def complete(self, prompt, system_prompt="", max_tokens=1024, temperature=0.2) -> LLMResponse:
        messages: list[dict] = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(
                f"{self.base_url}/chat/completions",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json={
                    "model": self.model,
                    "messages": messages,
                    "max_tokens": max_tokens,
                    "temperature": temperature,
                },
            )
            r.raise_for_status()
            data = r.json()

        text = data["choices"][0]["message"]["content"]
        tokens = data.get("usage", {}).get("total_tokens")
        return LLMResponse(text=text, model=self.model, tokens_used=tokens)

    async def health_check(self) -> bool:
        try:
            r = await self.complete("ping", max_tokens=5)
            return bool(r.text)
        except Exception:
            return False
