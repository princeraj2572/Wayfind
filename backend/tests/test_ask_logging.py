import pytest

from app import db
from app.search.answer import AnswerUnavailable


@pytest.fixture
def cite_first(monkeypatch):
    monkeypatch.setattr("app.search.routes.generate_answer", lambda q, chunks: "See [1].")


def _doc(client, space_id, title, body):
    r = client.post(f"/spaces/{space_id}/documents", json={"title": title, "body_md": body})
    assert r.status_code == 201, r.text
    return r.json()["id"]


def _last_query(conn):
    return conn.execute("SELECT * FROM queries ORDER BY id DESC LIMIT 1").fetchone()


def test_new_columns_exist_and_init_db_is_repeatable(conn):
    db.init_db()
    db.init_db()
    cols = {
        r["column_name"]
        for r in conn.execute(
            "SELECT column_name FROM information_schema.columns WHERE table_name = 'queries'"
        ).fetchall()
    }
    assert {"space_ids", "result_count", "cited_document_ids", "answer_generated"} <= cols


def test_ask_logs_spaces_hits_and_cited_documents(client, conn, cite_first):
    s1 = client.post("/spaces", json={"name": "One"}).json()["id"]
    s2 = client.post("/spaces", json={"name": "Two"}).json()["id"]
    doc = _doc(client, s1, "Refunds", "# Refunds\nRefund within 30 days of purchase.")
    r = client.post("/ask", json={"question": "refund days"})
    assert r.status_code == 200
    row = _last_query(conn)
    assert sorted(row["space_ids"]) == sorted([s1, s2])
    assert row["result_count"] == 1
    assert row["answer_generated"] is True
    assert row["cited_document_ids"] == [doc]
    assert row["cited_chunk_ids"] == [r.json()["sources"][0]["chunk_id"]]


def test_a_question_that_finds_nothing_logs_zero_results(client, conn, cite_first):
    empty = client.post("/spaces", json={"name": "Empty"}).json()["id"]
    body = client.post("/ask", json={"question": "anything", "space_ids": [empty]}).json()
    assert body["sources"] == []
    row = _last_query(conn)
    assert row["space_ids"] == [empty]
    assert row["result_count"] == 0 and row["answer_generated"] is False
    assert row["cited_document_ids"] == [] and row["cited_chunk_ids"] == []


def test_only_permitted_spaces_are_logged(new_client, conn, cite_first):
    alice, bob = new_client("alice@example.com"), new_client("bob@example.com")
    sid = alice.post("/spaces", json={"name": "Private"}).json()["id"]
    bob.post("/ask", json={"question": "hello", "space_ids": [sid]})
    row = _last_query(conn)
    assert row["space_ids"] == [] and row["result_count"] == 0


def test_cited_documents_are_deduplicated(client, conn, monkeypatch):
    monkeypatch.setattr("app.search.routes.generate_answer", lambda q, chunks: "First [1] and second [2].")
    sid = client.post("/spaces", json={"name": "S"}).json()["id"]
    doc = _doc(client, sid, "Notes", "# A\nrefund alpha\n\n# B\nrefund beta")
    client.post("/ask", json={"question": "refund", "space_ids": [sid]})
    row = _last_query(conn)
    assert row["result_count"] == 2
    assert len(row["cited_chunk_ids"]) == 2
    assert row["cited_document_ids"] == [doc]


def test_an_answer_without_citations_is_logged_as_generated_but_uncited(client, conn, monkeypatch):
    monkeypatch.setattr("app.search.routes.generate_answer", lambda q, chunks: "I could not find that.")
    sid = client.post("/spaces", json={"name": "S"}).json()["id"]
    _doc(client, sid, "Notes", "# A\nrefund alpha")
    client.post("/ask", json={"question": "tax rules", "space_ids": [sid]})
    row = _last_query(conn)
    assert row["result_count"] == 1
    assert row["answer_generated"] is True and row["cited_document_ids"] == []


def test_a_failing_answer_service_still_logs_the_search(client, conn, monkeypatch):
    def boom(question, chunks):
        raise AnswerUnavailable("no key")

    monkeypatch.setattr("app.search.routes.generate_answer", boom)
    sid = client.post("/spaces", json={"name": "S"}).json()["id"]
    _doc(client, sid, "Notes", "# A\nrefund alpha")
    r = client.post("/ask", json={"question": "refund", "space_ids": [sid]})
    assert r.status_code == 200 and r.json()["answer"] is None
    row = _last_query(conn)
    assert row["result_count"] == 1
    assert row["answer_generated"] is False and row["cited_document_ids"] == []
