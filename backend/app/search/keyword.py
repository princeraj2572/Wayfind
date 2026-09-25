import re


def _or_query(question: str) -> str | None:
    words = re.findall(r"[A-Za-z0-9]+", question.lower())
    return " | ".join(words) or None


def keyword_search(conn, question, space_ids, limit=20):
    tsq = _or_query(question)
    if not tsq or not space_ids:
        return []
    return conn.execute(
        """SELECT c.id, c.document_id, d.title, c.text
           FROM chunks c
           JOIN documents d ON d.id = c.document_id,
                to_tsquery('english', %s) q
           WHERE d.space_id = ANY(%s) AND c.tsv @@ q
           ORDER BY ts_rank_cd(c.tsv, q) DESC, c.id
           LIMIT %s""",
        (tsq, list(space_ids), limit),
    ).fetchall()
