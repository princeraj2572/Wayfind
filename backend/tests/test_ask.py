import pytest

from app.search.answer import AnswerUnavailable


@pytest.fixture
def space(client):
    sid = client.post("/spaces", json={"name": "S"}).json()["id"]
    client.post(f"/spaces/{sid}/documents", json={"title": "Refunds", "body_md": "# Refunds\nRefund within 30 days of purchase."})
    return sid


def test_ask_returns_answer_sources_and_logs_citations(client, conn, space, monkeypatch):
    monkeypatch.setattr("app.search.routes.generate_answer", lambda q, chunks: "Within 30 days [1].")
    r = client.post("/ask", json={"question": "refund days", "space_ids": [space]})
    body = r.json()
    assert r.status_code == 200
    assert body["answer"] == "Within 30 days [1]."
    assert body["sources"][0]["title"] == "Refunds" and body["sources"][0]["n"] == 1
    row = conn.execute("SELECT text, cited_chunk_ids FROM queries").fetchone()
    assert row["text"] == "refund days"
    assert row["cited_chunk_ids"] == [body["sources"][0]["chunk_id"]]


def test_ask_still_returns_sources_when_claude_is_down(client, conn, space, monkeypatch):
    def boom(q, chunks):
        raise AnswerUnavailable("no key")

    monkeypatch.setattr("app.search.routes.generate_answer", boom)
    body = client.post("/ask", json={"question": "refund days", "space_ids": [space]}).json()
    assert body["answer"] is None
    assert body["answer_error"] == "no key"
    assert len(body["sources"]) == 1
    assert conn.execute("SELECT cited_chunk_ids FROM queries").fetchone()["cited_chunk_ids"] == []


def test_ask_with_no_matches_skips_claude(client, conn, space, monkeypatch):
    def fail(q, chunks):
        raise AssertionError("must not call Claude without sources")

    monkeypatch.setattr("app.search.routes.generate_answer", fail)
    empty_id = client.post("/spaces", json={"name": "Empty"}).json()["id"]
    body = client.post("/ask", json={"question": "refund days", "space_ids": [empty_id]}).json()
    assert body["sources"] == [] and body["answer"] is None
    assert "no matching" in body["answer_error"]


def test_ask_with_no_spaces_returns_no_sources(client):
    body = client.post("/ask", json={"question": "refund", "space_ids": []}).json()
    assert body["sources"] == []
