import os

from .base import BaseEmbedder, EmbeddingResponse


class GeminiEmbedder(BaseEmbedder):
    def __init__(self, api_key: str | None = None):
        self.api_key = api_key or os.environ.get("GEMINI_API_KEY", "")
        self.model = "text-embedding-004"
        self._dim = 768
        self._client = None

    def _get_client(self):
        if self._client is None:
            from google import genai
            self._client = genai.Client(api_key=self.api_key)
        return self._client

    async def embed(self, text: str) -> EmbeddingResponse:
        client = self._get_client()
        result = client.models.embed_content(
            model=self.model,
            contents=text,
        )
        return EmbeddingResponse(
            vector=list(result.embeddings[0].values),
            model=self.model,
        )

    @property
    def dimension(self) -> int:
        return self._dim
