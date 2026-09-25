import datetime as dt

import argon2
import jwt

from app import config

_hasher = argon2.PasswordHasher()
_DUMMY_HASH = _hasher.hash("wayfind-dummy-password")
_ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except (argon2.exceptions.VerificationError, argon2.exceptions.InvalidHashError):
        return False


def burn_verify(password: str) -> bool:
    """Spend the time of a real verify so unknown emails are not distinguishable by latency."""
    verify_password(password, _DUMMY_HASH)
    return False


def create_token(user_id: int, expires_in: dt.timedelta | None = None) -> str:
    if not config.JWT_SECRET:
        raise RuntimeError("JWT_SECRET is not set")
    now = dt.datetime.now(dt.timezone.utc)
    lifetime = expires_in if expires_in is not None else dt.timedelta(minutes=config.JWT_EXPIRE_MINUTES)
    payload = {"sub": str(user_id), "iat": now, "exp": now + lifetime}
    return jwt.encode(payload, config.JWT_SECRET, algorithm=_ALGORITHM)


def decode_token(token: str) -> int | None:
    if not config.JWT_SECRET:
        return None
    try:
        payload = jwt.decode(
            token, config.JWT_SECRET, algorithms=[_ALGORITHM], options={"require": ["exp", "sub"]}
        )
        return int(payload["sub"])
    except (jwt.PyJWTError, ValueError, KeyError):
        return None
