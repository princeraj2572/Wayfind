import pytest

from app.docs import service as docs
from app.ingest.pipeline import reindex_document
from app.search.service import search
from tests.helpers import fake_embed


@pytest.fixture
def corpus(conn, fake_embeddings):
    s1 = docs.create_space(conn, "Support")["id"]
    s2 = docs.create_space(conn, "Finance")["id"]
    items = [
        (s1, "Refunds", "# Refunds\nEnterprise customers may request a refund within 60 days of invoice."),
        (s1, "VPN", "# VPN\nInstall the client and sign in with your SSO account."),
        (s2, "Payroll", "# Payroll\nPayroll runs on the last business day. Refund of overpayment is deducted."),
    ]
    for space_id, title, body in items:
        d = docs.create_document(conn, space_id, title, body)
        reindex_document(conn, d["id"], embed=fake_embed)
    return s1, s2


def titles(hits):
    return [h["title"] for h in hits]


def test_hybrid_finds_the_relevant_document(conn, corpus):
    s1, s2 = corpus
    hits = search(conn, "refund for enterprise customers", [s1, s2])
    assert titles(hits)[0] == "Refunds"
    assert all("score" in h for h in hits)


def test_modes_all_return_results(conn, corpus):
    s1, s2 = corpus
    for mode in ("hybrid", "vector", "keyword"):
        assert titles(search(conn, "VPN sso", [s1, s2], mode=mode))[0] == "VPN"


def test_only_requested_spaces_are_searched(conn, corpus):
    s1, s2 = corpus
    hits = search(conn, "refund payroll", [s1])
    assert "Payroll" not in titles(hits)
    hits = search(conn, "refund payroll", [s2])
    assert set(titles(hits)) == {"Payroll"}


def test_empty_space_ids_returns_nothing(conn, corpus):
    assert search(conn, "refund", []) == []


def test_special_characters_do_not_break_keyword_search(conn, corpus):
    s1, s2 = corpus
    for q in ["what's the refund & policy?", "refund: (60) days!", "'; DROP TABLE chunks; --", "a | b & !c"]:
        search(conn, q, [s1, s2], mode="keyword")  # must not raise
    assert conn.execute("SELECT count(*) AS n FROM chunks").fetchone()["n"] == 3


def test_stopword_only_question_keyword_is_empty(conn, corpus):
    s1, s2 = corpus
    assert search(conn, "what is the", [s1, s2], mode="keyword") == []


def test_blank_question_returns_nothing(conn, corpus):
    s1, s2 = corpus
    assert search(conn, "   ", [s1, s2]) == []


def test_top_k_limits_results(conn, corpus):
    s1, s2 = corpus
    assert len(search(conn, "refund", [s1, s2], top_k=1)) == 1
