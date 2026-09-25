from fastapi import APIRouter, Depends, HTTPException, Query

from app.analytics import service
from app.auth.roles import space_role
from app.db import get_conn

router = APIRouter()


@router.get("/spaces/{space_id}/analytics")
def get_space_analytics(
    space_id: int,
    days: int = Query(30),
    user=Depends(space_role("admin")),
    conn=Depends(get_conn),
):
    if days not in service.PERIODS:
        raise HTTPException(422, "days must be one of 7, 30, 90")
    return service.space_analytics(conn, space_id, days)
