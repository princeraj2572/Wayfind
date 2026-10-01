from fastapi import Depends, HTTPException

from app.auth import members
from app.auth.deps import current_user
from app.db import get_conn

RANK = {"viewer": 1, "editor": 2, "admin": 3}


def require_role(conn, user, space_id, min_role):
    role = members.get_role(conn, user["id"], space_id)
    if role is None:
        raise HTTPException(404, "not found")
    if RANK[role] < RANK[min_role]:
        raise HTTPException(403, "insufficient role")
    return role


def space_role(min_role):
    def dependency(space_id: int, user=Depends(current_user), conn=Depends(get_conn)):
        require_role(conn, user, space_id, min_role)
        return user

    return dependency
