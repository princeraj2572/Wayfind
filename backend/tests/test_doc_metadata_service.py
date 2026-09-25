from app import db
from app.docs import service
from app.ingest.pipeline import reindex_document
from tests.helpers import fake_embed


def _user(conn, email="alice@example.com"):
    return conn.execute(
        "INSERT INTO users (email, password_hash) VALUES (%s, 'x') RETURNING id", (email,)
    ).fetchone()["id"]


def _space(conn):
    return service.create_space(conn, "S")["id"]


def test_init_db_can_run_repeatedly(conn):
    db.init_db()
    db.init_db()
    cols = {
        r["column_name"]
        for r in conn.execute(
            "SELECT column_name FROM information_schema.columns WHERE table_name = 'documents'"
        ).fetchall()
    }
    assert {"updated_by", "index_status", "indexed_at"} <= cols


def test_new_document_is_pending_and_carries_the_editor(conn):
    uid = _user(conn)
    doc = service.create_document(conn, _space(conn), "T", "# T\nbody", user_id=uid)
    assert doc["index_status"] == "pending" and doc["indexed_at"] is None
    assert doc["updated_by"] == uid and doc["updated_by_email"] == "alice@example.com"
    assert doc["chunk_count"] == 0


def test_document_without_an_editor_has_null_author(conn):
    doc = service.create_document(conn, _space(conn), "T")
    assert doc["updated_by"] is None and doc["updated_by_email"] is None
    assert doc["index_status"] == "pending"


def test_deleting_the_editor_keeps_the_document_and_clears_the_author(conn):
    uid = _user(conn)
    doc = service.create_document(conn, _space(conn), "T", user_id=uid)
    conn.execute("DELETE FROM users WHERE id = %s", (uid,))
    got = service.get_document(conn, doc["id"])
    assert got is not None and got["updated_by"] is None and got["updated_by_email"] is None


def test_update_records_the_new_editor_and_keeps_it_when_none_is_given(conn):
    alice, bob = _user(conn, "alice@example.com"), _user(conn, "bob@example.com")
    doc = service.create_document(conn, _space(conn), "T", user_id=alice)
    assert service.update_document(conn, doc["id"], title="New", user_id=bob)["updated_by_email"] == "bob@example.com"
    assert service.update_document(conn, doc["id"], title="Newer")["updated_by_email"] == "bob@example.com"


def test_body_change_resets_status_but_title_change_does_not(conn):
    doc = service.create_document(conn, _space(conn), "T", "# A\none")
    conn.execute("UPDATE documents SET index_status = 'indexed', indexed_at = now() WHERE id = %s", (doc["id"],))
    assert service.update_document(conn, doc["id"], title="X")["index_status"] == "indexed"
    assert service.update_document(conn, doc["id"], body_md="# new")["index_status"] == "pending"


def test_update_of_missing_document_is_none(conn):
    assert service.update_document(conn, 999, title="x") is None


def test_chunk_count_counts_the_documents_chunks(conn):
    doc = service.create_document(conn, _space(conn), "T", "# A\none\n\n# B\ntwo")
    reindex_document(conn, doc["id"], embed=fake_embed)
    assert service.get_document(conn, doc["id"])["chunk_count"] == 2


def test_list_documents_includes_the_metadata(conn):
    sid = _space(conn)
    uid = _user(conn)
    service.create_document(conn, sid, "One", "a", user_id=uid)
    service.create_document(conn, sid, "Two", "b")
    rows = service.list_documents(conn, sid)
    assert [r["title"] for r in rows] == ["One", "Two"]
    assert rows[0]["updated_by_email"] == "alice@example.com" and rows[1]["updated_by_email"] is None
    assert all({"index_status", "indexed_at", "chunk_count"} <= set(r) for r in rows)


def test_migration_backfills_existing_documents_exactly_once(conn):
    sid = _space(conn)
    with_chunks = service.create_document(conn, sid, "Indexed", "# A\none")
    empty = service.create_document(conn, sid, "Empty", "")
    unindexed = service.create_document(conn, sid, "Unindexed", "# B\ntwo")
    reindex_document(conn, with_chunks["id"], embed=fake_embed)

    conn.execute("ALTER TABLE documents DROP COLUMN index_status, DROP COLUMN indexed_at")
    db.init_db()  # re-adds the columns and backfills
    status = {
        r["id"]: (r["index_status"], r["indexed_at"])
        for r in conn.execute("SELECT id, index_status, indexed_at FROM documents").fetchall()
    }
    assert status[with_chunks["id"]][0] == "indexed" and status[with_chunks["id"]][1] is not None
    assert status[empty["id"]][0] == "indexed"
    assert status[unindexed["id"]] == ("pending", None)

    # A document that becomes pending later must NOT be flipped by another startup.
    conn.execute("UPDATE documents SET index_status = 'pending', indexed_at = NULL WHERE id = %s", (with_chunks["id"],))
    db.init_db()
    assert service.get_document(conn, with_chunks["id"])["index_status"] == "pending"
