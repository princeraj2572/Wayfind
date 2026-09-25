import pytest


@pytest.fixture
def world(new_client, monkeypatch):
    monkeypatch.setattr("app.search.routes.generate_answer", lambda q, chunks: "See [1].")
    alice, bob, carol, dave = (new_client(f"{n}@example.com") for n in ("alice", "bob", "carol", "dave"))
    anon = new_client()
    sid = alice.post("/spaces", json={"name": "S"}).json()["id"]
    for email, role in (("bob@example.com", "editor"), ("carol@example.com", "viewer")):
        assert alice.put(f"/spaces/{sid}/members", json={"email": email, "role": role}).status_code == 200
    return {"sid": sid, "clients": {"admin": alice, "editor": bob, "viewer": carol, "outsider": dave, "anon": anon}}


EXPECTED = {"admin": 200, "editor": 403, "viewer": 403, "outsider": 404, "anon": 401}


@pytest.mark.parametrize("role", list(EXPECTED))
def test_only_admins_can_read_analytics(world, role):
    r = world["clients"][role].get(f"/spaces/{world['sid']}/analytics")
    assert r.status_code == EXPECTED[role], r.text


def test_unknown_space_looks_like_a_missing_space(world):
    assert world["clients"]["admin"].get("/spaces/99999/analytics").status_code == 404


def test_default_period_is_30_days_and_shape_is_stable(world):
    body = world["clients"]["admin"].get(f"/spaces/{world['sid']}/analytics").json()
    assert body["days"] == 30 and len(body["daily"]) == 30
    assert set(body) == {"days", "totals", "top_questions", "gaps", "top_documents", "daily"}
    assert set(body["totals"]) == {"questions", "answered", "unanswered", "unique_askers", "with_generated_answer"}


@pytest.mark.parametrize("days", [7, 30, 90])
def test_allowed_periods(world, days):
    body = world["clients"]["admin"].get(f"/spaces/{world['sid']}/analytics", params={"days": days}).json()
    assert body["days"] == days and len(body["daily"]) == days


@pytest.mark.parametrize("days", [0, 1, 14, 91, -5, 365])
def test_other_periods_are_rejected(world, days):
    r = world["clients"]["admin"].get(f"/spaces/{world['sid']}/analytics", params={"days": days})
    assert r.status_code == 422


def test_a_non_admin_gets_the_role_error_before_validation_details(world):
    r = world["clients"]["viewer"].get(f"/spaces/{world['sid']}/analytics", params={"days": 99})
    assert r.status_code == 403
    r = world["clients"]["outsider"].get(f"/spaces/{world['sid']}/analytics", params={"days": 99})
    assert r.status_code == 404


def test_analytics_reflect_real_questions(world, monkeypatch):
    alice, bob, sid = world["clients"]["admin"], world["clients"]["editor"], world["sid"]
    doc = alice.post(
        f"/spaces/{sid}/documents", json={"title": "Refunds", "body_md": "# Refunds\nRefund within 30 days of purchase."}
    ).json()["id"]

    alice.post("/ask", json={"question": "Refund days?", "space_ids": [sid]})
    bob.post("/ask", json={"question": "  refund   DAYS? ", "space_ids": [sid]})
    monkeypatch.setattr("app.search.routes.generate_answer", lambda q, chunks: "I could not find that.")
    alice.post("/ask", json={"question": "tax rules", "space_ids": [sid]})

    body = alice.get(f"/spaces/{sid}/analytics").json()
    assert body["totals"] == {
        "questions": 3, "answered": 2, "unanswered": 1, "unique_askers": 2, "with_generated_answer": 3,
    }
    assert body["top_questions"][0] == {"text": "refund days?", "count": 2}
    assert body["gaps"] == [{"text": "tax rules", "count": 1}]
    assert body["top_documents"] == [{"document_id": doc, "title": "Refunds", "citations": 2}]
    assert sum(d["questions"] for d in body["daily"]) == 3
    text = repr(body)
    assert "alice@example.com" not in text and "bob@example.com" not in text


def test_questions_about_other_spaces_do_not_leak_into_this_one(world):
    alice = world["clients"]["admin"]
    other = alice.post("/spaces", json={"name": "Other"}).json()["id"]
    alice.post(f"/spaces/{other}/documents", json={"title": "Secret Plans", "body_md": "# Secret\nlayoffs plan"})
    alice.post("/ask", json={"question": "what are the layoffs plans", "space_ids": [other]})
    body = alice.get(f"/spaces/{world['sid']}/analytics").json()
    assert body["totals"]["questions"] == 0
    assert "layoffs" not in repr(body) and "Secret Plans" not in repr(body)


def test_citations_survive_a_reindex_of_the_document(world):
    alice, sid = world["clients"]["admin"], world["sid"]
    doc = alice.post(
        f"/spaces/{sid}/documents", json={"title": "Refunds", "body_md": "# Refunds\nRefund within 30 days of purchase."}
    ).json()["id"]
    alice.post("/ask", json={"question": "Refund days?", "space_ids": [sid]})
    r = alice.put(f"/documents/{doc}", json={"title": "Refunds", "body_md": "# Refunds\nRefund within 14 days."})
    assert r.status_code == 200
    body = alice.get(f"/spaces/{sid}/analytics").json()
    assert body["top_documents"] == [{"document_id": doc, "title": "Refunds", "citations": 1}]
