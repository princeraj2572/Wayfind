from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel

from app.db import get_conn
from app.docs import service

router = APIRouter()


class SpaceIn(BaseModel):
    name: str


class DocIn(BaseModel):
    title: str
    body_md: str = ""


class DocUpdate(BaseModel):
    title: str | None = None
    body_md: str | None = None


def _require_space(conn, space_id):
    if not service.get_space(conn, space_id):
        raise HTTPException(404, "space not found")


@router.post("/spaces", status_code=201)
def create_space(body: SpaceIn, conn=Depends(get_conn)):
    return service.create_space(conn, body.name)


@router.post("/spaces/{space_id}/documents", status_code=201)
def create_document(space_id: int, body: DocIn, conn=Depends(get_conn)):
    _require_space(conn, space_id)
    return service.create_document(conn, space_id, body.title, body.body_md)


@router.get("/spaces/{space_id}/documents")
def list_documents(space_id: int, conn=Depends(get_conn)):
    _require_space(conn, space_id)
    return service.list_documents(conn, space_id)


@router.get("/documents/{doc_id}")
def get_document(doc_id: int, conn=Depends(get_conn)):
    doc = service.get_document(conn, doc_id)
    if not doc:
        raise HTTPException(404, "document not found")
    return doc


@router.put("/documents/{doc_id}")
def update_document(doc_id: int, body: DocUpdate, conn=Depends(get_conn)):
    doc = service.update_document(conn, doc_id, body.title, body.body_md)
    if not doc:
        raise HTTPException(404, "document not found")
    return doc


@router.delete("/documents/{doc_id}", status_code=204)
def delete_document(doc_id: int, conn=Depends(get_conn)):
    if not service.delete_document(conn, doc_id):
        raise HTTPException(404, "document not found")
    return Response(status_code=204)
