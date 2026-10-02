import pytest


def _boom(question, chunks):
    raise AssertionError("Claude must not be called without permitted sources")


def _doc(client, sid, title, body):
    r = client.post(f"/spaces/{sid}/documents", json={"title": title, "body_md": body})
    assert r.status_code == 201, r.text


@pytest.fixture
def world(new_client, monkeypatch):
    monkeypatch.setattr("app.search.routes.generate_answer", lambda q, chunks: "ok [1]")
    alice, bob = new_client("alice@example.com"), new_client("bob@example.com")
    s1 = alice.post("/spaces", json={"name": "One"}).json()["id"]
    s2 = alice.post("/spaces", json={"name": "Two"}).json()["id"]
    _doc(alice, s1, "Refunds", "# Refunds\nRefund within 30 days of purchase.")
    _doc(alice, s2, "Payroll", "# Payroll\nPayroll refund of overpayment is deducted.")
    return {"alice": alice, "bob": bob, "s1": s1, "s2": s2}


def titles(response):
    return sorted({s["title"] for s in response.json()["sources"]})


def test_ask_requires_login(new_client):
    assert new_client().post("/ask", json={"question": "refund"}).status_code == 401


def test_omitted_space_ids_searches_all_my_spaces(world):
    r = world["alice"].post("/ask", json={"question": "refund"})
    assert r.status_code == 200
    assert titles(r) == ["Payroll", "Refunds"]


def test_listed_space_ids_restrict_the_search(world):
    r = world["alice"].post("/ask", json={"question": "refund", "space_ids": [world["s1"]]})
    assert titles(r) == ["Refunds"]


def test_outsider_gets_nothing_and_claude_is_not_called(world, monkeypatch):
    monkeypatch.setattr("app.search.routes.generate_answer", _boom)
    bob = world["bob"]
    for payload in (
        {"question": "refund"},
        {"question": "refund", "space_ids": [world["s1"], world["s2"]]},
        {"question": "refund", "space_ids": []},
    ):
        body = bob.post("/ask", json=payload).json()
        assert body["sources"] == [] and body["answer"] is None
        assert "Refund within 30 days" not in str(body)


def test_mixed_owned_and_foreign_ids_only_search_owned(world):
    alice, bob = world["alice"], world["bob"]
    s3 = bob.post("/spaces", json={"name": "Bobs"}).json()["id"]
    _doc(bob, s3, "BobNotes", "# Bob\nBob also has a refund opinion.")
    r = bob.post("/ask", json={"question": "refund", "space_ids": [world["s1"], s3]})
    assert titles(r) == ["BobNotes"]
    r = alice.post("/ask", json={"question": "refund", "space_ids": [s3]})
    assert r.json()["sources"] == []


def test_viewers_can_ask(world):
    world["alice"].put(f"/spaces/{world['s1']}/members", json={"email": "bob@example.com", "role": "viewer"})
    r = world["bob"].post("/ask", json={"question": "refund"})
    assert titles(r) == ["Refunds"]


def test_removed_member_loses_search_access_immediately(world):
    world["alice"].put(f"/spaces/{world['s1']}/members", json={"email": "bob@example.com", "role": "viewer"})
    assert titles(world["bob"].post("/ask", json={"question": "refund"})) == ["Refunds"]
    world["alice"].delete(f"/spaces/{world['s1']}/members/2")
    assert world["bob"].post("/ask", json={"question": "refund"}).json()["sources"] == []


def test_query_log_records_the_user(world, conn):
    world["bob"].post("/ask", json={"question": "refund"})
    world["alice"].post("/ask", json={"question": "refund"})
    rows = conn.execute("SELECT user_id FROM queries ORDER BY id").fetchall()
    assert [r["user_id"] for r in rows] == [2, 1]
