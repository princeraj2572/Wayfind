from functools import lru_cache

from app import config


@lru_cache(maxsize=1)
def _model():
    from sentence_transformers import SentenceTransformer

    return SentenceTransformer(config.EMBED_MODEL)


def embed_texts(texts: list[str]) -> list[list[float]]:
    if not texts:
        return []
    return _model().encode(texts, normalize_embeddings=True).tolist()
