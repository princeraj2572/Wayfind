from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, field_validator

from app.db import get_conn
from app.search.answer import AnswerUnavailable, cited_indices, generate_answer
from app.search.service import search

router = APIRouter()


class AskIn(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    space_ids: list[int]

    @field_validator("question", mode="after")
    @classmethod
    def _strip_nul(cls, v: str) -> str:
        return v.replace("\x00", "")


@router.post("/ask")
def ask(body: AskIn, conn=Depends(get_conn)):
    hits = search(conn, body.question, body.space_ids, mode="hybrid", top_k=5)
    sources = [
        {"n": i, "chunk_id": h["id"], "document_id": h["document_id"], "title": h["title"], "text": h["text"]}
        for i, h in enumerate(hits, start=1)
    ]
    answer, error = None, None
    if not hits:
        error = "no matching documents found"
    else:
        try:
            answer = generate_answer(body.question, hits)
        except AnswerUnavailable as e:
            error = str(e)

    cited = [sources[k - 1]["chunk_id"] for k in cited_indices(answer or "", len(sources))]
    conn.execute(
        "INSERT INTO queries (text, cited_chunk_ids) VALUES (%s, %s)",
        (body.question, cited),
    )
    return {"answer": answer, "answer_error": error, "sources": sources}
