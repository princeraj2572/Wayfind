from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Response, UploadFile
from pydantic import BaseModel, field_validator

from app.auth.deps import current_user
from app.auth.roles import require_role
from app.db import get_conn
from app.docs import service
from app.ingest.extract import extract_text
from app.ingest.pipeline import reindex_in_background

router = APIRouter()


class DocIn(BaseModel):
    title: str
    body_md: str = ""

    @field_validator("title", "body_md", mode="after")
    @classmethod
    def _strip_nul(cls, v: str) -> str:
        return v.replace("\x00", "")


class DocUpdate(BaseModel):
    title: str | None = None
    body_md: str | None = None
    # The updated_at the editor last saw; if the document moved on since, the save is refused (409).
    base_updated_at: datetime | None = None

    @field_validator("title", "body_md", mode="after")
    @classmethod
    def _strip_nul(cls, v: str | None) -> str | None:
        return v.replace("\x00", "") if v is not None else v


def _doc_for(conn, user, doc_id, min_role):
    """A document in a space the caller cannot see looks exactly like a missing one."""
    doc = service.get_document(conn, doc_id)
    if not doc:
        raise HTTPException(404, "not found")
    require_role(conn, user, doc["space_id"], min_role)
    return doc


@router.post("/spaces/{space_id}/documents", status_code=201)
def create_document(
    space_id: int, body: DocIn, background: BackgroundTasks, user=Depends(current_user), conn=Depends(get_conn)
):
    require_role(conn, user, space_id, "editor")
    doc = service.create_document(conn, space_id, body.title, body.body_md, user_id=user["id"])
    background.add_task(reindex_in_background, doc["id"])
    return doc


@router.get("/spaces/{space_id}/documents")
def list_documents(space_id: int, user=Depends(current_user), conn=Depends(get_conn)):
    require_role(conn, user, space_id, "viewer")
    return service.list_documents(conn, space_id)


@router.post("/spaces/{space_id}/documents/upload", status_code=201)
def upload_document(
    space_id: int, file: UploadFile, background: BackgroundTasks, user=Depends(current_user), conn=Depends(get_conn)
):
    require_role(conn, user, space_id, "editor")
    try:
        text = extract_text(file.filename or "", file.file.read())
    except ValueError as e:
        raise HTTPException(400, str(e))
    path = Path(file.filename)
    title = path.stem.replace("\x00", "").strip() or "untitled"
    doc = service.create_document(
        conn, space_id, title, text, path.suffix.lstrip(".").lower(), user_id=user["id"]
    )
    background.add_task(reindex_in_background, doc["id"])
    return doc


@router.get("/documents/{doc_id}")
def get_document(doc_id: int, user=Depends(current_user), conn=Depends(get_conn)):
    return _doc_for(conn, user, doc_id, "viewer")


@router.put("/documents/{doc_id}")
def update_document(
    doc_id: int, body: DocUpdate, background: BackgroundTasks, user=Depends(current_user), conn=Depends(get_conn)
):
    _doc_for(conn, user, doc_id, "editor")
    try:
        doc = service.update_document(
            conn, doc_id, body.title, body.body_md, user_id=user["id"], expected_updated_at=body.base_updated_at
        )
    except service.StaleDocument:
        raise HTTPException(409, "This document was changed by someone else since you opened it.")
    if not doc:
        raise HTTPException(404, "not found")
    if body.body_md is not None:
        background.add_task(reindex_in_background, doc_id)
    return doc


@router.delete("/documents/{doc_id}", status_code=204)
def delete_document(doc_id: int, user=Depends(current_user), conn=Depends(get_conn)):
    _doc_for(conn, user, doc_id, "editor")
    if not service.delete_document(conn, doc_id):
        raise HTTPException(404, "not found")
    return Response(status_code=204)
