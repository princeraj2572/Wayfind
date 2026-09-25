import os

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://wayfind:wayfind@localhost:5433/wayfind")
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
ANSWER_MODEL = os.environ.get("ANSWER_MODEL", "claude-sonnet-5")
EMBED_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
EMBED_DIM = 384
