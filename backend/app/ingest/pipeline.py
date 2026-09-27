import logging

from pgvector import Vector

from app.db import connect
from app.docs.service import get_document
from app.ingest.chunk import chunk_markdown
from app.ingest.embed import embed_texts

log = logging.getLogger(__name__)


def reindex_document(conn, doc_id, embed=None) -> int:
    embed = embed or embed_texts
    doc = get_document(conn, doc_id)
    if not doc:
        return 0
    chunks = chunk_markdown(doc["body_md"])
    vectors = embed(chunks) if chunks else []
    with conn.transaction():
        conn.execute("DELETE FROM chunks WHERE document_id = %s", (doc_id,))
        for position, (text, vec) in enumerate(zip(chunks, vectors)):
            conn.execute(
                "INSERT INTO chunks (document_id, position, text, embedding) VALUES (%s, %s, %s, %s)",
                (doc_id, position, text, Vector(vec)),
            )
    return len(chunks)


def reindex_in_background(doc_id: int) -> None:
    conn = connect()
    try:
        reindex_document(conn, doc_id)
    except Exception:
        log.exception("reindex failed for document %s", doc_id)
    finally:
        conn.close()
