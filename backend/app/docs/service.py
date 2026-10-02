_DOCUMENT_SELECT = """
SELECT d.id, d.space_id, d.title, d.body_md, d.source_type, d.updated_at,
       d.updated_by, u.email AS updated_by_email,
       d.index_status, d.indexed_at,
       (SELECT count(*) FROM chunks c WHERE c.document_id = d.id)::int AS chunk_count
FROM documents d
LEFT JOIN users u ON u.id = d.updated_by
"""


def create_space(conn, name):
    return conn.execute("INSERT INTO spaces (name) VALUES (%s) RETURNING *", (name,)).fetchone()


def get_space(conn, space_id):
    return conn.execute("SELECT * FROM spaces WHERE id = %s", (space_id,)).fetchone()


def create_document(conn, space_id, title, body_md="", source_type="markdown", user_id=None):
    row = conn.execute(
        """INSERT INTO documents (space_id, title, body_md, source_type, updated_by)
           VALUES (%s, %s, %s, %s, %s) RETURNING id""",
        (space_id, title, body_md, source_type, user_id),
    ).fetchone()
    return get_document(conn, row["id"])


def get_document(conn, doc_id):
    return conn.execute(_DOCUMENT_SELECT + " WHERE d.id = %s", (doc_id,)).fetchone()


def list_documents(conn, space_id):
    return conn.execute(_DOCUMENT_SELECT + " WHERE d.space_id = %s ORDER BY d.id", (space_id,)).fetchall()


def update_document(conn, doc_id, title=None, body_md=None, user_id=None):
    row = conn.execute(
        """UPDATE documents
           SET title = COALESCE(%s, title),
               body_md = COALESCE(%s, body_md),
               updated_at = now(),
               updated_by = COALESCE(%s, updated_by),
               index_status = CASE WHEN %s::text IS NOT NULL THEN 'pending' ELSE index_status END
           WHERE id = %s RETURNING id""",
        (title, body_md, user_id, body_md, doc_id),
    ).fetchone()
    return get_document(conn, row["id"]) if row else None


def delete_document(conn, doc_id):
    return conn.execute("DELETE FROM documents WHERE id = %s", (doc_id,)).rowcount > 0
