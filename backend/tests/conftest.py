import os

os.environ.setdefault("DATABASE_URL", "postgresql://wayfind:wayfind@localhost:5433/wayfind_test")
os.environ.setdefault("JWT_SECRET", "test-secret-not-for-production-use-0123456789-0123456789-0123456789")
assert os.environ["DATABASE_URL"].rsplit("/", 1)[-1].endswith("_test"), "tests must use a *_test database"

import pytest
from fastapi.testclient import TestClient

from app import db
from tests.helpers import fake_embed


@pytest.fixture(scope="session", autouse=True)
def _schema():
    db.init_db()


@pytest.fixture
def conn():
    c = db.connect()
    c.execute("TRUNCATE users, spaces, documents, chunks, queries RESTART IDENTITY CASCADE")
    yield c
    c.close()


@pytest.fixture
def fake_embeddings(monkeypatch):
    """Replace the real model everywhere it is imported by name."""
    for target in ("app.ingest.pipeline.embed_texts", "app.search.service.embed_texts"):
        monkeypatch.setattr(target, fake_embed)


@pytest.fixture
def client(conn, fake_embeddings):
    from app.main import app
    return TestClient(app)
