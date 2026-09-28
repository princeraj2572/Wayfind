from pgvector import Vector


def vector_search(conn, query_vec, space_ids, limit=20):
    if not space_ids:
        return []
    return conn.execute(
        """SELECT c.id, c.document_id, d.title, c.text
           FROM chunks c
           JOIN documents d ON d.id = c.document_id
           WHERE d.space_id = ANY(%s)
           ORDER BY c.embedding <=> %s, c.id
           LIMIT %s""",
        (list(space_ids), Vector(query_vec), limit),
    ).fetchall()
