from app.docs import service
from app.ingest import pipeline
from tests.helpers import fake_embed


def _doc(conn, body="# A\none"):
    space = service.create_space(conn, "S")
    return service.create_document(conn, space["id"], "T", body)


def _boom(texts):
    raise RuntimeError("model exploded: secret detail")


def test_reindex_marks_the_document_indexed(conn):
    doc = _doc(conn)
    assert pipeline.reindex_document(conn, doc["id"], embed=fake_embed) == 1
    got = service.get_document(conn, doc["id"])
    assert got["index_status"] == "indexed" and got["indexed_at"] is not None and got["chunk_count"] == 1


def test_empty_document_is_indexed_with_zero_chunks(conn):
    doc = _doc(conn, body="")
    assert pipeline.reindex_document(conn, doc["id"], embed=fake_embed) == 0
    got = service.get_document(conn, doc["id"])
    assert got["index_status"] == "indexed" and got["chunk_count"] == 0


def test_stale_reindex_leaves_the_newer_pending_status(conn):
    doc = _doc(conn)

    def racing_embed(texts):
        service.update_document(conn, doc["id"], body_md="# B\ntwo")
        return fake_embed(texts)

    assert pipeline.reindex_document(conn, doc["id"], embed=racing_embed) == 0
    got = service.get_document(conn, doc["id"])
    assert got["index_status"] == "pending" and got["indexed_at"] is None and got["chunk_count"] == 0


def test_a_new_edit_goes_pending_and_the_next_reindex_marks_it_indexed_again(conn):
    doc = _doc(conn)
    pipeline.reindex_document(conn, doc["id"], embed=fake_embed)
    assert service.update_document(conn, doc["id"], body_md="# new\ntext")["index_status"] == "pending"
    pipeline.reindex_document(conn, doc["id"], embed=fake_embed)
    assert service.get_document(conn, doc["id"])["index_status"] == "indexed"


def test_background_failure_marks_the_document_failed(conn, monkeypatch):
    doc = _doc(conn)
    monkeypatch.setattr("app.ingest.pipeline.embed_texts", _boom)
    pipeline.reindex_in_background(doc["id"])
    got = service.get_document(conn, doc["id"])
    assert got["index_status"] == "failed" and got["chunk_count"] == 0


def test_a_late_failure_never_overwrites_a_completed_reindex(conn):
    doc = _doc(conn)
    pipeline.reindex_document(conn, doc["id"], embed=fake_embed)
    pipeline._mark_failed(conn, doc["id"])
    assert service.get_document(conn, doc["id"])["index_status"] == "indexed"


def test_failed_document_recovers_on_the_next_successful_reindex(conn, monkeypatch):
    doc = _doc(conn)
    monkeypatch.setattr("app.ingest.pipeline.embed_texts", _boom)
    pipeline.reindex_in_background(doc["id"])
    assert service.get_document(conn, doc["id"])["index_status"] == "failed"
    monkeypatch.setattr("app.ingest.pipeline.embed_texts", fake_embed)
    pipeline.reindex_in_background(doc["id"])
    assert service.get_document(conn, doc["id"])["index_status"] == "indexed"


def test_marking_a_missing_document_failed_is_harmless(conn):
    pipeline._mark_failed(conn, 999)  # must not raise
