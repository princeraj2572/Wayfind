from contextlib import asynccontextmanager

from fastapi import FastAPI

from app import db
from app.docs.routes import router as docs_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init_db()
    yield


app = FastAPI(title="Wayfind", lifespan=lifespan)
app.include_router(docs_router)


@app.get("/health")
def health():
    return {"status": "ok"}
