from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, field_validator

from app.auth import members
from app.auth.deps import current_user
from app.db import get_conn
from app.search.answer import AnswerUnavailable, cited_indices, generate_answer
from app.search.service import search

router = APIRouter()


class AskIn(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    space_ids: list[int] | None = None

    @field_validator("question", mode="after")
    @classmethod
    def _strip_nul(cls, v: str) -> str:
        return v.replace("\x00", "")


@router.post("/ask")
def ask(body: AskIn, user=Depends(current_user), conn=Depends(get_conn)):
    mine = [s["id"] for s in members.list_my_spaces(conn, user["id"])]
    allowed = set(mine)
    space_ids = mine if body.space_ids is None else [i for i in body.space_ids if i in allowed]

    hits = search(conn, body.question, space_ids, mode="hybrid", top_k=5)
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

    cited_numbers = cited_indices(answer or "", len(sources))
    cited = [sources[k - 1]["chunk_id"] for k in cited_numbers]
    cited_documents = sorted({sources[k - 1]["document_id"] for k in cited_numbers})
    conn.execute(
        """INSERT INTO queries (user_id, text, cited_chunk_ids, space_ids, result_count, cited_document_ids, answer_generated)
           VALUES (%s, %s, %s, %s, %s, %s, %s)""",
        (user["id"], body.question, cited, space_ids, len(hits), cited_documents, answer is not None),
    )
    return {"answer": answer, "answer_error": error, "sources": sources}
