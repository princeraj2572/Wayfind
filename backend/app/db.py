from pathlib import Path

import psycopg
from pgvector.psycopg import register_vector
from psycopg.rows import dict_row

from app import config

SCHEMA = Path(__file__).with_name("schema.sql")


def init_db():
    with psycopg.connect(config.DATABASE_URL, autocommit=True) as conn:
        conn.execute(SCHEMA.read_text())


def connect():
    conn = psycopg.connect(config.DATABASE_URL, row_factory=dict_row, autocommit=True)
    register_vector(conn)
    return conn


def get_conn():
    conn = connect()
    try:
        yield conn
    finally:
        conn.close()
