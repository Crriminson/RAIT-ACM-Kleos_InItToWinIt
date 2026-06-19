from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional


@dataclass
class LLMResponse:
    text: str
    model: str
    tokens_used: Optional[int] = None


@dataclass
class EmbeddingResponse:
    vector: list[float]
    model: str


class BaseLLMProvider(ABC):

    @abstractmethod
    async def complete(
        self,
        prompt: str,
        system_prompt: str = "",
        max_tokens: int = 1024,
        temperature: float = 0.2,
    ) -> LLMResponse:
        ...

    @abstractmethod
    async def health_check(self) -> bool:
        ...


class BaseEmbedder(ABC):

    @abstractmethod
    async def embed(self, text: str) -> EmbeddingResponse:
        ...

    @property
    @abstractmethod
    def dimension(self) -> int:
        ...
