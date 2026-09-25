def create_space(conn, name):
    return conn.execute("INSERT INTO spaces (name) VALUES (%s) RETURNING *", (name,)).fetchone()


def get_space(conn, space_id):
    return conn.execute("SELECT * FROM spaces WHERE id = %s", (space_id,)).fetchone()


def create_document(conn, space_id, title, body_md="", source_type="markdown"):
    return conn.execute(
        "INSERT INTO documents (space_id, title, body_md, source_type) VALUES (%s, %s, %s, %s) RETURNING *",
        (space_id, title, body_md, source_type),
    ).fetchone()


def get_document(conn, doc_id):
    return conn.execute("SELECT * FROM documents WHERE id = %s", (doc_id,)).fetchone()


def list_documents(conn, space_id):
    return conn.execute(
        "SELECT * FROM documents WHERE space_id = %s ORDER BY id", (space_id,)
    ).fetchall()


def update_document(conn, doc_id, title=None, body_md=None):
    return conn.execute(
        """UPDATE documents
           SET title = COALESCE(%s, title), body_md = COALESCE(%s, body_md), updated_at = now()
           WHERE id = %s RETURNING *""",
        (title, body_md, doc_id),
    ).fetchone()


def delete_document(conn, doc_id):
    return conn.execute("DELETE FROM documents WHERE id = %s", (doc_id,)).rowcount > 0
