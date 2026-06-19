from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class EmbeddingResponse:
    vector: list[float]
    model: str


class BaseEmbedder(ABC):

    @abstractmethod
    async def embed(self, text: str) -> EmbeddingResponse:
        ...

    @property
    @abstractmethod
    def dimension(self) -> int:
        ...
