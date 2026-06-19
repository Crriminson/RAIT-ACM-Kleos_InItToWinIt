from __future__ import annotations

import re


def chunk_text(
    text: str,
    chunk_size: int = 500,
    overlap: int = 50,
) -> list[str]:
    sentences = re.split(r"(?<=[.!?])\s+", text.strip())
    chunks: list[str] = []
    current: list[str] = []
    length = 0

    for sentence in sentences:
        slen = len(sentence)
        if length + slen > chunk_size and current:
            chunks.append(" ".join(current))
            overlap_tokens = []
            overlap_len = 0
            for s in reversed(current):
                if overlap_len + len(s) > overlap:
                    break
                overlap_tokens.insert(0, s)
                overlap_len += len(s)
            current = overlap_tokens
            length = overlap_len
        current.append(sentence)
        length += slen

    if current:
        chunks.append(" ".join(current))

    return chunks
