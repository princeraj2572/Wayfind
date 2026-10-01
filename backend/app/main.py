from contextlib import asynccontextmanager

from fastapi import FastAPI

from app import config, db
from app.auth.routes import router as auth_router
from app.auth.space_routes import router as space_router
from app.docs.routes import router as docs_router
from app.search.routes import router as search_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    if not config.JWT_SECRET:
        raise RuntimeError("JWT_SECRET must be set")
    db.init_db()
    yield


app = FastAPI(title="Wayfind", lifespan=lifespan)
app.include_router(auth_router)
app.include_router(space_router)
app.include_router(docs_router)
app.include_router(search_router)


@app.get("/health")
def health():
    return {"status": "ok"}
