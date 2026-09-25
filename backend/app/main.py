from contextlib import asynccontextmanager

from fastapi import FastAPI

from app import db
from app.docs.routes import router as docs_router
from app.search.routes import router as search_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init_db()
    yield


app = FastAPI(title="Wayfind", lifespan=lifespan)
app.include_router(docs_router)
app.include_router(search_router)


@app.get("/health")
def health():
    return {"status": "ok"}
