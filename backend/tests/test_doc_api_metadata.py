from tests.helpers import fake_embed


def _world(new_client):
    alice = new_client("alice@example.com")
    bob = new_client("bob@example.com")
    carol = new_client("carol@example.com")
    sid = alice.post("/spaces", json={"name": "S"}).json()["id"]
    assert alice.put(f"/spaces/{sid}/members", json={"email": "bob@example.com", "role": "editor"}).status_code == 200
    assert alice.put(f"/spaces/{sid}/members", json={"email": "carol@example.com", "role": "viewer"}).status_code == 200
    return alice, bob, carol, sid


def test_create_reports_pending_then_get_reports_indexed(new_client):
    alice, _, _, sid = _world(new_client)
    created = alice.post(f"/spaces/{sid}/documents", json={"title": "D", "body_md": "# D\nhello"}).json()
    assert created["index_status"] == "pending" and created["chunk_count"] == 0
    assert created["updated_by_email"] == "alice@example.com"
    got = alice.get(f"/documents/{created['id']}").json()
    assert got["index_status"] == "indexed" and got["chunk_count"] == 1 and got["indexed_at"]


def test_editing_records_the_last_editor(new_client):
    alice, bob, _, sid = _world(new_client)
    doc = alice.post(f"/spaces/{sid}/documents", json={"title": "D", "body_md": "# D\nhello"}).json()
    r = bob.put(f"/documents/{doc['id']}", json={"title": "Renamed"})
    assert r.status_code == 200 and r.json()["updated_by_email"] == "bob@example.com"
    assert alice.get(f"/documents/{doc['id']}").json()["updated_by_email"] == "bob@example.com"


def test_title_only_edit_keeps_indexed_and_body_edit_goes_pending_then_indexed(new_client):
    alice, _, _, sid = _world(new_client)
    doc = alice.post(f"/spaces/{sid}/documents", json={"title": "D", "body_md": "# D\nhello"}).json()
    assert alice.put(f"/documents/{doc['id']}", json={"title": "T2"}).json()["index_status"] == "indexed"
    assert alice.put(f"/documents/{doc['id']}", json={"body_md": "# D\nhello\n\n# E\nmore"}).json()["index_status"] == "pending"
    got = alice.get(f"/documents/{doc['id']}").json()
    assert got["index_status"] == "indexed" and got["chunk_count"] == 2


def test_list_and_viewer_see_the_metadata(new_client):
    alice, _, carol, sid = _world(new_client)
    alice.post(f"/spaces/{sid}/documents", json={"title": "One", "body_md": "# One\na"})
    alice.post(f"/spaces/{sid}/documents", json={"title": "Two", "body_md": ""})
    rows = carol.get(f"/spaces/{sid}/documents").json()
    assert [r["title"] for r in rows] == ["One", "Two"]
    assert all(r["updated_by_email"] == "alice@example.com" and r["index_status"] == "indexed" for r in rows)
    assert [r["chunk_count"] for r in rows] == [1, 0]


def test_upload_records_the_editor_and_indexes(new_client):
    alice, bob, _, sid = _world(new_client)
    r = bob.post(f"/spaces/{sid}/documents/upload", files={"file": ("vpn.md", b"# VPN\nInstall the client.")})
    assert r.status_code == 201
    assert r.json()["updated_by_email"] == "bob@example.com" and r.json()["index_status"] == "pending"
    got = alice.get(f"/documents/{r.json()['id']}").json()
    assert got["index_status"] == "indexed" and got["chunk_count"] == 1


def test_failed_index_is_reported_without_details_and_recovers_on_the_next_save(new_client, monkeypatch):
    alice, _, _, sid = _world(new_client)

    def boom(texts):
        raise RuntimeError("model exploded: secret detail")

    monkeypatch.setattr("app.ingest.pipeline.embed_texts", boom)
    created = alice.post(f"/spaces/{sid}/documents", json={"title": "D", "body_md": "# D\nhello"}).json()
    got = alice.get(f"/documents/{created['id']}")
    assert got.json()["index_status"] == "failed"
    assert "secret detail" not in got.text and "index_error" not in got.json()

    monkeypatch.setattr("app.ingest.pipeline.embed_texts", fake_embed)
    alice.put(f"/documents/{created['id']}", json={"body_md": "# D\nhello again"})
    assert alice.get(f"/documents/{created['id']}").json()["index_status"] == "indexed"
