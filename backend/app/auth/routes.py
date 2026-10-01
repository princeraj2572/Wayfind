import re

import psycopg
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator

from app.auth import service
from app.auth.deps import current_user
from app.auth.security import burn_verify, create_token, hash_password, verify_password
from app.db import get_conn

router = APIRouter()

_EMAIL = re.compile(r"^[^@\s\x00]+@[^@\s\x00]+\.[^@\s\x00]+$")


class RegisterIn(BaseModel):
    email: str = Field(max_length=254)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("email", mode="after")
    @classmethod
    def _valid_email(cls, v: str) -> str:
        v = v.strip().lower()
        if not _EMAIL.match(v):
            raise ValueError("invalid email address")
        return v


class LoginIn(BaseModel):
    email: str = Field(max_length=254)
    password: str = Field(max_length=128)

    @field_validator("email", mode="after")
    @classmethod
    def _normalize(cls, v: str) -> str:
        return v.strip().lower()


def _token_response(user):
    return {
        "access_token": create_token(user["id"]),
        "token_type": "bearer",
        "user": {"id": user["id"], "email": user["email"]},
    }


@router.post("/auth/register", status_code=201)
def register(body: RegisterIn, conn=Depends(get_conn)):
    try:
        user = service.create_user(conn, body.email, hash_password(body.password))
    except psycopg.errors.UniqueViolation:
        raise HTTPException(409, "email already registered")
    return _token_response(user)


@router.post("/auth/login")
def login(body: LoginIn, conn=Depends(get_conn)):
    user = service.get_user_by_email(conn, body.email)
    ok = verify_password(body.password, user["password_hash"]) if user else burn_verify(body.password)
    if not ok:
        raise HTTPException(401, "invalid email or password", headers={"WWW-Authenticate": "Bearer"})
    return _token_response(user)


@router.get("/auth/me")
def me(user=Depends(current_user)):
    return {"id": user["id"], "email": user["email"]}
