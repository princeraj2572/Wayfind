from app.ingest.embed import embed_texts
from app.search.fuse import rrf
from app.search.keyword import keyword_search
from app.search.vector import vector_search

CANDIDATES = 20


def search(conn, question, space_ids, mode="hybrid", top_k=5):
    if not question.strip() or not space_ids:
        return []
    by_id: dict[int, dict] = {}
    rankings: list[list[int]] = []

    if mode in ("hybrid", "vector"):
        rows = vector_search(conn, embed_texts([question])[0], space_ids, CANDIDATES)
        by_id.update({r["id"]: r for r in rows})
        rankings.append([r["id"] for r in rows])
    if mode in ("hybrid", "keyword"):
        rows = keyword_search(conn, question, space_ids, CANDIDATES)
        by_id.update({r["id"]: r for r in rows})
        rankings.append([r["id"] for r in rows])

    return [{**by_id[i], "score": score} for i, score in rrf(rankings)[:top_k]]
