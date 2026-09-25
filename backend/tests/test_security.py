import datetime as dt

import jwt

from app import config
from app.auth import security


def _future():
    return dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=1)


def test_hash_and_verify_roundtrip():
    h = security.hash_password("correct horse battery")
    assert h != "correct horse battery" and h.startswith("$argon2")
    assert security.verify_password("correct horse battery", h) is True
    assert security.verify_password("wrong", h) is False


def test_hashes_are_salted():
    assert security.hash_password("same") != security.hash_password("same")


def test_verify_against_malformed_hash_is_false_not_error():
    assert security.verify_password("x", "not-a-hash") is False


def test_burn_verify_returns_false():
    assert security.burn_verify("anything") is False


def test_token_roundtrip():
    assert security.decode_token(security.create_token(42)) == 42


def test_expired_token_is_rejected():
    token = security.create_token(1, expires_in=dt.timedelta(seconds=-5))
    assert security.decode_token(token) is None


def test_tampered_signature_is_rejected():
    token = security.create_token(1)
    tampered = token[:-3] + ("abc" if token[-3:] != "abc" else "xyz")
    assert security.decode_token(tampered) is None


def test_token_signed_with_other_secret_is_rejected():
    token = jwt.encode({"sub": "1", "exp": _future()}, "some-other-secret-0123456789012345", algorithm="HS256")
    assert security.decode_token(token) is None


def test_alg_none_token_is_rejected():
    token = jwt.encode({"sub": "1", "exp": _future()}, "", algorithm="none")
    assert security.decode_token(token) is None


def test_other_hmac_algorithm_is_rejected():
    token = jwt.encode({"sub": "1", "exp": _future()}, config.JWT_SECRET, algorithm="HS512")
    assert security.decode_token(token) is None


def test_token_without_exp_is_rejected():
    token = jwt.encode({"sub": "1"}, config.JWT_SECRET, algorithm="HS256")
    assert security.decode_token(token) is None


def test_non_numeric_subject_is_rejected():
    token = jwt.encode({"sub": "abc", "exp": _future()}, config.JWT_SECRET, algorithm="HS256")
    assert security.decode_token(token) is None


def test_garbage_is_rejected():
    for junk in ("", "not.a.token", "a.b.c", "x" * 500):
        assert security.decode_token(junk) is None


def test_missing_secret_cannot_mint_or_accept_tokens(monkeypatch):
    token = security.create_token(1)
    monkeypatch.setattr(config, "JWT_SECRET", "")
    try:
        security.create_token(1)
        raised = False
    except RuntimeError:
        raised = True
    assert raised
    assert security.decode_token(token) is None
