import pytest


@pytest.fixture
def world(new_client):
    alice = new_client("alice@example.com")  # admin
    bob = new_client("bob@example.com")  # editor
    carol = new_client("carol@example.com")  # viewer
    dave = new_client("dave@example.com")  # outsider
    anon = new_client()
    sid = alice.post("/spaces", json={"name": "S"}).json()["id"]
    for email, role in (("bob@example.com", "editor"), ("carol@example.com", "viewer")):
        assert alice.put(f"/spaces/{sid}/members", json={"email": email, "role": role}).status_code == 200
    doc = alice.post(f"/spaces/{sid}/documents", json={"title": "D", "body_md": "# D\nhello"}).json()
    return {
        "sid": sid,
        "doc": doc["id"],
        "clients": {"admin": alice, "editor": bob, "viewer": carol, "outsider": dave, "anon": anon},
    }


ACTIONS = {
    "list": lambda c, w: c.get(f"/spaces/{w['sid']}/documents"),
    "get": lambda c, w: c.get(f"/documents/{w['doc']}"),
    "create": lambda c, w: c.post(f"/spaces/{w['sid']}/documents", json={"title": "N", "body_md": "x"}),
    "upload": lambda c, w: c.post(f"/spaces/{w['sid']}/documents/upload", files={"file": ("n.md", b"# n\nx")}),
    "update": lambda c, w: c.put(f"/documents/{w['doc']}", json={"title": "U"}),
    "delete": lambda c, w: c.delete(f"/documents/{w['doc']}"),
}

_WRITER = dict(list=200, get=200, create=201, upload=201, update=200, delete=204)
EXPECTED = {
    "admin": _WRITER,
    "editor": _WRITER,
    "viewer": dict(list=200, get=200, create=403, upload=403, update=403, delete=403),
    "outsider": {a: 404 for a in ACTIONS},
    "anon": {a: 401 for a in ACTIONS},
}


@pytest.mark.parametrize("role", list(EXPECTED))
@pytest.mark.parametrize("action", list(ACTIONS))
def test_role_matrix(world, role, action):
    response = ACTIONS[action](world["clients"][role], world)
    assert response.status_code == EXPECTED[role][action], response.text


def test_outsider_cannot_tell_a_hidden_document_from_a_missing_one(world):
    dave = world["clients"]["outsider"]
    hidden = dave.get(f"/documents/{world['doc']}")
    missing = dave.get("/documents/99999")
    assert hidden.status_code == missing.status_code == 404
    assert hidden.json() == missing.json()


def test_forbidden_update_and_delete_leave_the_document_untouched(world):
    carol, alice = world["clients"]["viewer"], world["clients"]["admin"]
    assert carol.put(f"/documents/{world['doc']}", json={"title": "HACKED"}).status_code == 403
    assert carol.delete(f"/documents/{world['doc']}").status_code == 403
    assert alice.get(f"/documents/{world['doc']}").json()["title"] == "D"


def test_promoting_a_viewer_takes_effect_with_the_same_token(world):
    carol, alice = world["clients"]["viewer"], world["clients"]["admin"]
    assert carol.put(f"/documents/{world['doc']}", json={"title": "V"}).status_code == 403
    alice.put(f"/spaces/{world['sid']}/members", json={"email": "carol@example.com", "role": "editor"})
    assert carol.put(f"/documents/{world['doc']}", json={"title": "V"}).status_code == 200
