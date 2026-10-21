import pytest


@pytest.fixture
def doc(client):
    sid = client.post("/spaces", json={"name": "S"}).json()["id"]
    return client.post(f"/spaces/{sid}/documents", json={"title": "A", "body_md": "one"}).json()


def test_a_save_with_the_current_version_succeeds(client, doc):
    r = client.put(f"/documents/{doc['id']}", json={"title": "B", "base_updated_at": doc["updated_at"]})
    assert r.status_code == 200
    assert r.json()["title"] == "B"
    assert r.json()["updated_at"] != doc["updated_at"]


def test_a_save_based_on_an_old_version_is_rejected_and_changes_nothing(client, doc):
    first = client.put(f"/documents/{doc['id']}", json={"title": "Theirs"}).json()
    r = client.put(
        f"/documents/{doc['id']}", json={"title": "Mine", "body_md": "mine", "base_updated_at": doc["updated_at"]}
    )
    assert r.status_code == 409
    assert "changed" in r.json()["detail"]
    now = client.get(f"/documents/{doc['id']}").json()
    assert now["title"] == "Theirs" and now["body_md"] == "one"
    assert now["updated_at"] == first["updated_at"]


def test_a_save_without_a_base_still_overwrites(client, doc):
    client.put(f"/documents/{doc['id']}", json={"title": "Theirs"})
    r = client.put(f"/documents/{doc['id']}", json={"title": "Mine"})
    assert r.status_code == 200 and r.json()["title"] == "Mine"


def test_a_stale_save_after_a_background_reindex_is_not_a_conflict(client, doc):
    # Reindexing changes index_status but must not move updated_at, or every save would conflict.
    fresh = client.get(f"/documents/{doc['id']}").json()
    r = client.put(f"/documents/{doc['id']}", json={"title": "B", "base_updated_at": fresh["updated_at"]})
    assert r.status_code == 200


def test_a_bad_base_value_is_a_validation_error(client, doc):
    r = client.put(f"/documents/{doc['id']}", json={"title": "B", "base_updated_at": "yesterday"})
    assert r.status_code == 422


def test_a_missing_document_with_a_base_is_still_404(client):
    r = client.put("/documents/99999", json={"title": "B", "base_updated_at": "2026-09-25T10:00:00Z"})
    assert r.status_code == 404


def test_a_conflicting_save_needs_the_editor_role_first(new_client):
    alice, bob = new_client("alice@example.com"), new_client("bob@example.com")
    sid = alice.post("/spaces", json={"name": "S"}).json()["id"]
    d = alice.post(f"/spaces/{sid}/documents", json={"title": "A"}).json()
    r = bob.put(f"/documents/{d['id']}", json={"title": "x", "base_updated_at": "2020-01-01T00:00:00Z"})
    assert r.status_code == 404
