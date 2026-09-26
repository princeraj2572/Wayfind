from contextlib import asynccontextmanager

from fastapi import FastAPI

from app import db


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init_db()
    yield


app = FastAPI(title="Wayfind", lifespan=lifespan)


@app.get("/health")
def health():
    return {"status": "ok"}
