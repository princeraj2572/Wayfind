def make_space(client, name="Handbook"):
    return client.post("/spaces", json={"name": name}).json()


def test_create_and_get_document(client):
    space = make_space(client)
    r = client.post(f"/spaces/{space['id']}/documents", json={"title": "Refunds", "body_md": "# Refunds\nWithin 30 days."})
    assert r.status_code == 201
    doc = r.json()
    assert doc["title"] == "Refunds"
    got = client.get(f"/documents/{doc['id']}").json()
    assert got["body_md"].startswith("# Refunds")


def test_create_document_in_missing_space_is_404(client):
    r = client.post("/spaces/999/documents", json={"title": "x"})
    assert r.status_code == 404


def test_list_update_delete(client):
    space = make_space(client)
    doc = client.post(f"/spaces/{space['id']}/documents", json={"title": "A", "body_md": "one"}).json()
    assert [d["title"] for d in client.get(f"/spaces/{space['id']}/documents").json()] == ["A"]

    updated = client.put(f"/documents/{doc['id']}", json={"title": "B"}).json()
    assert updated["title"] == "B" and updated["body_md"] == "one"

    assert client.delete(f"/documents/{doc['id']}").status_code == 204
    assert client.get(f"/documents/{doc['id']}").status_code == 404
    assert client.delete(f"/documents/{doc['id']}").status_code == 404


def test_update_missing_document_is_404(client):
    assert client.put("/documents/999", json={"title": "x"}).status_code == 404
