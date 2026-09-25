import datetime as dt

import pytest

from app.auth import security


def _reg(c, email="alice@example.com", password="password123"):
    return c.post("/auth/register", json={"email": email, "password": password})


def _bearer(token):
    return {"Authorization": f"Bearer {token}"}


def test_register_returns_token_and_user_without_hash(anon_client):
    r = _reg(anon_client)
    assert r.status_code == 201
    body = r.json()
    assert body["token_type"] == "bearer"
    assert body["user"] == {"id": 1, "email": "alice@example.com"}
    assert "password" not in r.text and "argon2" not in r.text


def test_password_is_stored_as_argon2_hash(anon_client, conn):
    _reg(anon_client, password="password123")
    stored = conn.execute("SELECT password_hash FROM users").fetchone()["password_hash"]
    assert stored.startswith("$argon2") and "password123" not in stored


def test_email_is_normalized_and_duplicates_collide_case_insensitively(anon_client):
    r = _reg(anon_client, email="  Alice@Example.COM ")
    assert r.status_code == 201 and r.json()["user"]["email"] == "alice@example.com"
    assert _reg(anon_client, email="ALICE@example.com").status_code == 409
    assert _reg(anon_client, email="alice@example.com ").status_code == 409


@pytest.mark.parametrize("email", ["nope", "a@b", "a b@c.com", "@x.com", "a@.com", "a\u0000@x.com", ""])
def test_bad_emails_are_422(anon_client, email):
    assert _reg(anon_client, email=email).status_code == 422


def test_password_length_limits(anon_client):
    assert _reg(anon_client, password="short").status_code == 422
    assert _reg(anon_client, password="x" * 129).status_code == 422
    assert _reg(anon_client, password="x" * 128).status_code == 201


def test_login_success_and_case_insensitive_email(anon_client):
    _reg(anon_client)
    r = anon_client.post("/auth/login", json={"email": "ALICE@example.com", "password": "password123"})
    assert r.status_code == 200
    assert security.decode_token(r.json()["access_token"]) == 1


def test_wrong_password_and_unknown_email_look_identical(anon_client):
    _reg(anon_client)
    wrong = anon_client.post("/auth/login", json={"email": "alice@example.com", "password": "nope-nope"})
    unknown = anon_client.post("/auth/login", json={"email": "ghost@example.com", "password": "nope-nope"})
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json() == unknown.json()
    assert wrong.headers["www-authenticate"] == "Bearer"


def test_unknown_email_login_still_spends_hash_time(anon_client, monkeypatch):
    calls = []
    monkeypatch.setattr("app.auth.routes.burn_verify", lambda pw: calls.append(pw) or False)
    anon_client.post("/auth/login", json={"email": "ghost@example.com", "password": "whatever1"})
    assert calls == ["whatever1"]


def test_login_with_oversized_password_is_422(anon_client):
    r = anon_client.post("/auth/login", json={"email": "a@b.co", "password": "x" * 129})
    assert r.status_code == 422


def test_me_with_valid_token(anon_client):
    token = _reg(anon_client).json()["access_token"]
    r = anon_client.get("/auth/me", headers=_bearer(token))
    assert r.status_code == 200 and r.json() == {"id": 1, "email": "alice@example.com"}


@pytest.mark.parametrize(
    "headers",
    [
        {},
        {"Authorization": "Bearer garbage"},
        {"Authorization": "Basic YTpi"},
        {"Authorization": "Bearer "},
    ],
)
def test_me_rejects_missing_or_bad_credentials(anon_client, headers):
    r = anon_client.get("/auth/me", headers=headers)
    assert r.status_code == 401
    assert r.headers["www-authenticate"] == "Bearer"


def test_me_rejects_expired_token(anon_client):
    _reg(anon_client)
    token = security.create_token(1, expires_in=dt.timedelta(seconds=-5))
    assert anon_client.get("/auth/me", headers=_bearer(token)).status_code == 401


def test_token_for_deleted_user_is_rejected(anon_client, conn):
    token = _reg(anon_client).json()["access_token"]
    conn.execute("DELETE FROM users WHERE id = 1")
    assert anon_client.get("/auth/me", headers=_bearer(token)).status_code == 401
