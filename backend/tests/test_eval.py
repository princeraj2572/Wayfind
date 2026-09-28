from app.docs import service as docs
from app.eval.run_eval import recall_at_k
from app.ingest.pipeline import reindex_document
from tests.helpers import fake_embed


def test_recall_at_k_counts_expected_titles(conn, fake_embeddings):
    sid = docs.create_space(conn, "eval")["id"]
    for title, body in [("refunds", "# R\nrefund within thirty days"), ("vpn", "# V\ninstall vpn client")]:
        d = docs.create_document(conn, sid, title, body)
        reindex_document(conn, d["id"], embed=fake_embed)
    questions = [
        {"question": "refund thirty days", "doc": "refunds"},
        {"question": "install vpn", "doc": "vpn"},
        {"question": "refund", "doc": "vpn"},  # deliberately wrong
    ]
    assert abs(recall_at_k(conn, questions, [sid], "hybrid", 1) - 2 / 3) < 1e-9
    assert recall_at_k(conn, [], [sid], "hybrid", 1) == 0.0
