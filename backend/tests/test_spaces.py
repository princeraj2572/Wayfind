import pytest


def _add(admin, sid, email, role):
    return admin.put(f"/spaces/{sid}/members", json={"email": email, "role": role})


def test_creating_a_space_makes_the_creator_admin(client):
    r = client.post("/spaces", json={"name": "Handbook"})
    assert r.status_code == 201
    assert r.json() == {"id": 1, "name": "Handbook", "role": "admin"}
    assert client.get("/spaces").json() == [{"id": 1, "name": "Handbook", "role": "admin"}]


def test_spaces_require_login(anon_client):
    assert anon_client.post("/spaces", json={"name": "X"}).status_code == 401
    assert anon_client.get("/spaces").status_code == 401


@pytest.mark.parametrize("name", ["", "   ", "\u0000", "x" * 201])
def test_bad_space_names_are_422(client, name):
    assert client.post("/spaces", json={"name": name}).status_code == 422


def test_space_name_is_cleaned(client):
    assert client.post("/spaces", json={"name": "  A\u0000b "}).json()["name"] == "Ab"


def test_my_spaces_only_lists_mine(new_client):
    alice, bob = new_client("alice@example.com"), new_client("bob@example.com")
    alice.post("/spaces", json={"name": "A"})
    bob.post("/spaces", json={"name": "B"})
    assert [s["name"] for s in alice.get("/spaces").json()] == ["A"]
    assert [s["name"] for s in bob.get("/spaces").json()] == ["B"]


def test_admin_adds_and_changes_members(new_client):
    alice, bob = new_client("alice@example.com"), new_client("bob@example.com")
    sid = alice.post("/spaces", json={"name": "S"}).json()["id"]

    r = _add(alice, sid, "bob@example.com", "editor")
    assert r.status_code == 200
    assert r.json() == {"user_id": 2, "email": "bob@example.com", "role": "editor"}
    assert bob.get("/spaces").json() == [{"id": sid, "name": "S", "role": "editor"}]

    assert _add(alice, sid, "bob@example.com", "viewer").json()["role"] == "viewer"
    members = alice.get(f"/spaces/{sid}/members").json()
    assert members == [
        {"user_id": 1, "email": "alice@example.com", "role": "admin"},
        {"user_id": 2, "email": "bob@example.com", "role": "viewer"},
    ]


def test_member_email_lookup_is_case_insensitive(new_client):
    alice = new_client("alice@example.com")
    new_client("bob@example.com")
    sid = alice.post("/spaces", json={"name": "S"}).json()["id"]
    assert _add(alice, sid, "  BOB@Example.com ", "viewer").status_code == 200


def test_adding_unregistered_user_is_404(client):
    sid = client.post("/spaces", json={"name": "S"}).json()["id"]
    assert _add(client, sid, "ghost@example.com", "viewer").status_code == 404


def test_invalid_role_is_422(new_client):
    alice = new_client("alice@example.com")
    new_client("bob@example.com")
    sid = alice.post("/spaces", json={"name": "S"}).json()["id"]
    assert _add(alice, sid, "bob@example.com", "owner").status_code == 422


def test_only_admins_manage_members_and_non_members_see_404(new_client):
    alice, bob, carol, dave = (new_client(f"{n}@example.com") for n in ("alice", "bob", "carol", "dave"))
    sid = alice.post("/spaces", json={"name": "S"}).json()["id"]
    _add(alice, sid, "bob@example.com", "editor")
    _add(alice, sid, "carol@example.com", "viewer")

    assert bob.put(f"/spaces/{sid}/members", json={"email": "dave@example.com", "role": "viewer"}).status_code == 403
    assert bob.delete(f"/spaces/{sid}/members/3").status_code == 403
    assert carol.get(f"/spaces/{sid}/members").status_code == 200
    assert dave.get(f"/spaces/{sid}/members").status_code == 404
    assert dave.put(f"/spaces/{sid}/members", json={"email": "dave@example.com", "role": "admin"}).status_code == 404
    assert dave.get("/spaces/999/members").status_code == 404


def test_last_admin_cannot_be_demoted_or_removed(new_client):
    alice, bob = new_client("alice@example.com"), new_client("bob@example.com")
    sid = alice.post("/spaces", json={"name": "S"}).json()["id"]

    assert _add(alice, sid, "alice@example.com", "editor").status_code == 409
    assert alice.delete(f"/spaces/{sid}/members/1").status_code == 409

    assert _add(alice, sid, "bob@example.com", "admin").status_code == 200
    assert _add(bob, sid, "alice@example.com", "editor").status_code == 200  # two admins: allowed
    assert bob.delete(f"/spaces/{sid}/members/2").status_code == 409  # bob is now the last admin
    assert _add(bob, sid, "bob@example.com", "viewer").status_code == 409


def test_removing_a_member_takes_effect_immediately(new_client):
    alice, bob = new_client("alice@example.com"), new_client("bob@example.com")
    sid = alice.post("/spaces", json={"name": "S"}).json()["id"]
    _add(alice, sid, "bob@example.com", "viewer")
    assert bob.get(f"/spaces/{sid}/members").status_code == 200

    assert alice.delete(f"/spaces/{sid}/members/2").status_code == 204
    assert bob.get(f"/spaces/{sid}/members").status_code == 404  # same token, no role any more
    assert alice.delete(f"/spaces/{sid}/members/2").status_code == 404


def test_role_change_takes_effect_immediately(new_client):
    alice, bob = new_client("alice@example.com"), new_client("bob@example.com")
    sid = alice.post("/spaces", json={"name": "S"}).json()["id"]
    _add(alice, sid, "bob@example.com", "viewer")
    assert bob.put(f"/spaces/{sid}/members", json={"email": "bob@example.com", "role": "admin"}).status_code == 403
    _add(alice, sid, "bob@example.com", "admin")
    assert bob.put(f"/spaces/{sid}/members", json={"email": "bob@example.com", "role": "admin"}).status_code == 200


@pytest.mark.parametrize("email", ["a\u0000@x.com", "bob@example.com\u0000", "\u0000"])
def test_nul_in_member_email_is_422(client, email):
    sid = client.post("/spaces", json={"name": "S"}).json()["id"]
    assert _add(client, sid, email, "viewer").status_code == 422
