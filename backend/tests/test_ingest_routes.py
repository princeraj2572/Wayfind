def _space(client):
    return client.post("/spaces", json={"name": "S"}).json()["id"]


def _chunk_count(conn):
    return conn.execute("SELECT count(*) AS n FROM chunks").fetchone()["n"]


def test_creating_a_document_indexes_it(client, conn):
    sid = _space(client)
    client.post(f"/spaces/{sid}/documents", json={"title": "A", "body_md": "# A\nhello world"})
    assert _chunk_count(conn) == 1


def test_updating_body_reindexes(client, conn):
    sid = _space(client)
    doc = client.post(f"/spaces/{sid}/documents", json={"title": "A", "body_md": "# A\none"}).json()
    client.put(f"/documents/{doc['id']}", json={"body_md": "# A\none\n\n# B\ntwo"})
    assert _chunk_count(conn) == 2


def test_updating_only_title_does_not_break_index(client, conn):
    sid = _space(client)
    doc = client.post(f"/spaces/{sid}/documents", json={"title": "A", "body_md": "# A\none"}).json()
    client.put(f"/documents/{doc['id']}", json={"title": "New"})
    assert _chunk_count(conn) == 1


def test_upload_text_file_creates_and_indexes(client, conn):
    sid = _space(client)
    r = client.post(f"/spaces/{sid}/documents/upload", files={"file": ("vpn.md", b"# VPN\nInstall the client.", "text/markdown")})
    assert r.status_code == 201
    assert r.json()["title"] == "vpn"
    assert r.json()["source_type"] == "md"
    assert _chunk_count(conn) == 1


def test_upload_unsupported_and_bad_files_are_400(client):
    sid = _space(client)
    r = client.post(f"/spaces/{sid}/documents/upload", files={"file": ("a.exe", b"x")})
    assert r.status_code == 400 and "unsupported" in r.json()["detail"]
    r = client.post(f"/spaces/{sid}/documents/upload", files={"file": ("a.txt", b"\xff\xfe\x00")})
    assert r.status_code == 400


def test_upload_to_missing_space_is_404(client):
    r = client.post("/spaces/999/documents/upload", files={"file": ("a.md", b"x")})
    assert r.status_code == 404
