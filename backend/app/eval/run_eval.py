import json
from pathlib import Path

from app import db
from app.docs import service as docs
from app.ingest.pipeline import reindex_document
from app.search.service import search

HERE = Path(__file__).parent
SPACE_NAME = "eval-corpus"


def recall_at_k(conn, questions, space_ids, mode, k) -> float:
    if not questions:
        return 0.0
    hits = 0
    for q in questions:
        results = search(conn, q["question"], space_ids, mode=mode, top_k=k)
        if q["doc"] in {r["title"] for r in results}:
            hits += 1
    return hits / len(questions)


def load_corpus(conn) -> int:
    conn.execute("DELETE FROM spaces WHERE name = %s", (SPACE_NAME,))
    space_id = docs.create_space(conn, SPACE_NAME)["id"]
    for path in sorted((HERE / "corpus").glob("*.txt")):
        doc = docs.create_document(conn, space_id, path.stem, path.read_text(encoding="utf-8"), "txt")
        reindex_document(conn, doc["id"])
    return space_id


def main():
    db.init_db()
    conn = db.connect()
    space_id = load_corpus(conn)
    questions = json.loads((HERE / "questions.json").read_text(encoding="utf-8"))
    print(f"{len(questions)} questions\n")
    print(f"{'mode':<10}{'recall@1':>10}{'recall@3':>10}{'recall@5':>10}")
    for mode in ("vector", "keyword", "hybrid"):
        row = [recall_at_k(conn, questions, [space_id], mode, k) for k in (1, 3, 5)]
        print(f"{mode:<10}" + "".join(f"{r:>10.2f}" for r in row))
    conn.close()


if __name__ == "__main__":
    main()
