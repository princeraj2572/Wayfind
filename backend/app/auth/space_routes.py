from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field, field_validator

from app.auth import members, service
from app.auth.deps import current_user
from app.auth.roles import space_role
from app.db import get_conn

router = APIRouter()


class SpaceIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)

    @field_validator("name", mode="after")
    @classmethod
    def _clean(cls, v: str) -> str:
        v = v.replace("\x00", "").strip()
        if not v:
            raise ValueError("name must not be blank")
        return v


class MemberIn(BaseModel):
    email: str = Field(max_length=254)
    role: Literal["viewer", "editor", "admin"]

    @field_validator("email", mode="after")
    @classmethod
    def _normalize(cls, v: str) -> str:
        return v.strip().lower()


@router.post("/spaces", status_code=201)
def create_space(body: SpaceIn, user=Depends(current_user), conn=Depends(get_conn)):
    return members.create_space_with_admin(conn, body.name, user["id"])


@router.get("/spaces")
def my_spaces(user=Depends(current_user), conn=Depends(get_conn)):
    return members.list_my_spaces(conn, user["id"])


@router.get("/spaces/{space_id}/members")
def get_members(space_id: int, user=Depends(space_role("viewer")), conn=Depends(get_conn)):
    return members.list_members(conn, space_id)


@router.put("/spaces/{space_id}/members")
def put_member(space_id: int, body: MemberIn, user=Depends(space_role("admin")), conn=Depends(get_conn)):
    target = service.get_user_by_email(conn, body.email)
    if not target:
        raise HTTPException(404, "user not found")
    try:
        row = members.set_member_role(conn, space_id, target["id"], body.role)
    except members.LastAdminError:
        raise HTTPException(409, "a space must keep at least one admin")
    return {"user_id": row["user_id"], "email": target["email"], "role": row["role"]}


@router.delete("/spaces/{space_id}/members/{user_id}", status_code=204)
def delete_member(space_id: int, user_id: int, user=Depends(space_role("admin")), conn=Depends(get_conn)):
    try:
        removed = members.remove_member(conn, space_id, user_id)
    except members.LastAdminError:
        raise HTTPException(409, "a space must keep at least one admin")
    if not removed:
        raise HTTPException(404, "member not found")
    return Response(status_code=204)
