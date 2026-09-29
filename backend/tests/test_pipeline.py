from app.docs import service
from app.ingest.pipeline import reindex_document
from tests.helpers import fake_embed


def _doc(conn, body):
    space = service.create_space(conn, "S")
    return service.create_document(conn, space["id"], "T", body)


def test_reindex_writes_chunks_with_embeddings(conn):
    doc = _doc(conn, "# A\nalpha beta.\n\n# B\ngamma delta.")
    n = reindex_document(conn, doc["id"], embed=fake_embed)
    assert n == 2
    rows = conn.execute("SELECT position, text FROM chunks WHERE document_id=%s ORDER BY position", (doc["id"],)).fetchall()
    assert [r["position"] for r in rows] == [0, 1]
    assert rows[0]["text"].startswith("# A")


def test_reindex_replaces_old_chunks(conn):
    doc = _doc(conn, "# A\none")
    reindex_document(conn, doc["id"], embed=fake_embed)
    service.update_document(conn, doc["id"], body_md="# X\ntwo\n\n# Y\nthree\n\n# Z\nfour")
    assert reindex_document(conn, doc["id"], embed=fake_embed) == 3
    assert conn.execute("SELECT count(*) AS n FROM chunks").fetchone()["n"] == 3


def test_empty_body_gives_zero_chunks_and_clears_old(conn):
    doc = _doc(conn, "# A\none")
    reindex_document(conn, doc["id"], embed=fake_embed)
    service.update_document(conn, doc["id"], body_md="")
    assert reindex_document(conn, doc["id"], embed=fake_embed) == 0
    assert conn.execute("SELECT count(*) AS n FROM chunks").fetchone()["n"] == 0


def test_missing_document_is_a_noop(conn):
    assert reindex_document(conn, 999, embed=fake_embed) == 0


def test_deleting_document_removes_chunks(conn):
    doc = _doc(conn, "# A\none")
    reindex_document(conn, doc["id"], embed=fake_embed)
    service.delete_document(conn, doc["id"])
    assert conn.execute("SELECT count(*) AS n FROM chunks").fetchone()["n"] == 0


def test_reindex_skips_write_when_document_changed_during_embedding(conn):
    doc = _doc(conn, "# A\none")

    def racing_embed(texts):
        service.update_document(conn, doc["id"], body_md="# B\ntwo")
        return fake_embed(texts)

    assert reindex_document(conn, doc["id"], embed=racing_embed) == 0
    assert conn.execute("SELECT count(*) AS n FROM chunks").fetchone()["n"] == 0
