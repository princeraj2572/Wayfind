import re

_HEADING = re.compile(r"^#{1,6}\s", re.MULTILINE)


def _sections(md: str) -> list[str]:
    starts = [m.start() for m in _HEADING.finditer(md)]
    if not starts or starts[0] != 0:
        starts.insert(0, 0)
    ends = starts[1:] + [len(md)]
    parts = (md[s:e].strip() for s, e in zip(starts, ends))
    return [p for p in parts if p]


def chunk_markdown(md: str, max_words: int = 220, overlap: int = 40) -> list[str]:
    chunks: list[str] = []
    step = max_words - overlap
    for section in _sections(md):
        words = section.split()
        if len(words) <= max_words:
            chunks.append(section)
            continue
        for start in range(0, len(words), step):
            chunks.append(" ".join(words[start:start + max_words]))
            if start + max_words >= len(words):
                break
    return chunks
