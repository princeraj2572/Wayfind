from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.auth import service
from app.auth.security import decode_token
from app.db import get_conn

_bearer = HTTPBearer(auto_error=False)


def current_user(creds: HTTPAuthorizationCredentials | None = Depends(_bearer), conn=Depends(get_conn)):
    user_id = decode_token(creds.credentials) if creds else None
    user = service.get_user(conn, user_id) if user_id is not None else None
    if not user:
        raise HTTPException(401, "invalid or missing token", headers={"WWW-Authenticate": "Bearer"})
    return user
