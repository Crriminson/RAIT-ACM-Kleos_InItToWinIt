import os

import httpx

from .base import BaseLLMProvider, LLMResponse


class OllamaProvider(BaseLLMProvider):

    def __init__(self, base_url: str | None = None, model: str = "llama3.2:3b"):
        self.base_url = base_url or os.environ.get("OLLAMA_HOST", "http://localhost:11434")
        self.model = model

    async def complete(self, prompt, system_prompt="", max_tokens=1024, temperature=0.2) -> LLMResponse:
        full_prompt = f"{system_prompt}\n\n{prompt}" if system_prompt else prompt
        payload = {
            "model": self.model,
            "prompt": full_prompt,
            "stream": False,
            "options": {"num_predict": max_tokens, "temperature": temperature},
        }
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post(f"{self.base_url}/api/generate", json=payload)
            r.raise_for_status()
            data = r.json()

        return LLMResponse(text=data["response"], model=self.model)

    async def health_check(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                r = await client.get(f"{self.base_url}/api/tags")
                return r.status_code == 200
        except Exception:
            return False
