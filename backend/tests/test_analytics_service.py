from datetime import datetime, timezone

from app.analytics.service import PERIODS, space_analytics
from app.docs import service as docs

NOW = datetime(2026, 9, 25, 12, 0, tzinfo=timezone.utc)


def _user(conn, email):
    return conn.execute(
        "INSERT INTO users (email, password_hash) VALUES (%s, 'x') RETURNING id", (email,)
    ).fetchone()["id"]


def _space(conn, name="S"):
    return docs.create_space(conn, name)["id"]


def _doc(conn, space_id, title="Doc"):
    return docs.create_document(conn, space_id, title, "body")["id"]


def _q(conn, text, spaces, hits=1, cited=(), generated=True, user=None, when=NOW):
    conn.execute(
        """INSERT INTO queries (user_id, text, space_ids, result_count, cited_document_ids, answer_generated, created_at)
           VALUES (%s, %s, %s, %s, %s, %s, %s)""",
        (user, text, list(spaces), hits, list(cited), generated, when),
    )


def test_empty_space_reports_zeros_and_a_zero_filled_series(conn):
    sid = _space(conn)
    r = space_analytics(conn, sid, 30, now=NOW)
    assert r["days"] == 30
    assert r["totals"] == {
        "questions": 0, "answered": 0, "unanswered": 0, "unique_askers": 0, "with_generated_answer": 0,
    }
    assert r["top_questions"] == [] and r["gaps"] == [] and r["top_documents"] == []
    assert len(r["daily"]) == 30
    assert r["daily"][0]["date"] == "2026-08-27" and r["daily"][-1]["date"] == "2026-09-25"
    assert all(d["questions"] == 0 for d in r["daily"])


def test_unanswered_means_no_hits_or_a_generated_answer_that_cited_nothing(conn):
    sid = _space(conn)
    d = _doc(conn, sid)
    _q(conn, "no hits", [sid], hits=0, generated=False)
    _q(conn, "claude found nothing useful", [sid], hits=3, cited=[], generated=True)
    _q(conn, "claude cited a document", [sid], hits=3, cited=[d], generated=True)
    _q(conn, "no claude key, has hits", [sid], hits=3, cited=[], generated=False)
    t = space_analytics(conn, sid, 30, now=NOW)["totals"]
    assert t["questions"] == 4
    assert t["unanswered"] == 2 and t["answered"] == 2
    assert t["with_generated_answer"] == 2


def test_gaps_list_only_unanswered_questions(conn):
    sid = _space(conn)
    d = _doc(conn, sid)
    _q(conn, "missing topic", [sid], hits=0, generated=False)
    _q(conn, "Missing  Topic", [sid], hits=2, cited=[], generated=True)
    _q(conn, "well covered", [sid], hits=2, cited=[d])
    gaps = space_analytics(conn, sid, 30, now=NOW)["gaps"]
    assert gaps == [{"text": "missing topic", "count": 2}]


def test_totals_count_only_this_space_and_window(conn):
    a, b = _user(conn, "a@x.com"), _user(conn, "b@x.com")
    s1, s2 = _space(conn, "One"), _space(conn, "Two")
    _q(conn, "q1", [s1], user=a)
    _q(conn, "q2", [s1], user=a)
    _q(conn, "q3", [s1], hits=0, generated=False, user=b)
    _q(conn, "other space", [s2], user=a)
    _q(conn, "legacy row without a space", [], user=a)
    _q(conn, "too old", [s1], user=a, when=datetime(2026, 8, 1, tzinfo=timezone.utc))
    t = space_analytics(conn, s1, 30, now=NOW)["totals"]
    assert t["questions"] == 3 and t["unique_askers"] == 2


def test_multi_space_questions_count_in_each_space(conn):
    s1, s2 = _space(conn, "One"), _space(conn, "Two")
    _q(conn, "both", [s1, s2])
    assert space_analytics(conn, s1, 30, now=NOW)["totals"]["questions"] == 1
    assert space_analytics(conn, s2, 30, now=NOW)["totals"]["questions"] == 1


def test_similar_questions_are_grouped_and_ordered(conn):
    sid = _space(conn)
    _q(conn, "How long for refunds?", [sid])
    _q(conn, "  how long   for REFUNDS? ", [sid])
    _q(conn, "Something else", [sid])
    top = space_analytics(conn, sid, 30, now=NOW)["top_questions"]
    assert top[0] == {"text": "how long for refunds?", "count": 2}
    assert top[1] == {"text": "something else", "count": 1}


def test_only_the_top_ten_are_returned(conn):
    sid = _space(conn)
    for i in range(12):
        _q(conn, f"question {i:02d}", [sid])
    assert len(space_analytics(conn, sid, 30, now=NOW)["top_questions"]) == 10


def test_top_documents_only_lists_this_spaces_documents(conn):
    s1, s2 = _space(conn, "One"), _space(conn, "Two")
    refunds, sla = _doc(conn, s1, "Refunds"), _doc(conn, s1, "SLA")
    secret = _doc(conn, s2, "Secret Plans")
    _q(conn, "a", [s1, s2], cited=[refunds, secret])
    _q(conn, "b", [s1], cited=[refunds])
    _q(conn, "c", [s1], cited=[sla])
    top = space_analytics(conn, s1, 30, now=NOW)["top_documents"]
    assert top == [
        {"document_id": refunds, "title": "Refunds", "citations": 2},
        {"document_id": sla, "title": "SLA", "citations": 1},
    ]
    assert "Secret Plans" not in repr(top)


def test_deleted_documents_are_skipped(conn):
    sid = _space(conn)
    d = _doc(conn, sid, "Gone")
    _q(conn, "a", [sid], cited=[d])
    docs.delete_document(conn, d)
    assert space_analytics(conn, sid, 30, now=NOW)["top_documents"] == []


def test_window_start_is_inclusive_and_days_are_utc_buckets(conn):
    sid = _space(conn)
    _q(conn, "at the start", [sid], when=datetime(2026, 8, 27, 0, 0, tzinfo=timezone.utc))
    _q(conn, "just before", [sid], when=datetime(2026, 8, 26, 23, 59, 59, tzinfo=timezone.utc))
    _q(conn, "late yesterday", [sid], when=datetime(2026, 9, 24, 23, 30, tzinfo=timezone.utc))
    _q(conn, "early today", [sid], when=datetime(2026, 9, 25, 0, 30, tzinfo=timezone.utc))
    r = space_analytics(conn, sid, 30, now=NOW)
    assert r["totals"]["questions"] == 3
    days = {d["date"]: d["questions"] for d in r["daily"]}
    assert days["2026-08-27"] == 1 and days["2026-09-24"] == 1 and days["2026-09-25"] == 1
    assert sum(days.values()) == 3


def test_periods_control_the_series_length(conn):
    sid = _space(conn)
    for days in PERIODS:
        r = space_analytics(conn, sid, days, now=NOW)
        assert len(r["daily"]) == days and r["days"] == days


def test_the_result_contains_no_user_identifiers(conn):
    sid = _space(conn)
    person = _user(conn, "secret.person@example.com")
    _q(conn, "a question", [sid], user=person)
    r = space_analytics(conn, sid, 30, now=NOW)
    assert set(r) == {"days", "totals", "top_questions", "gaps", "top_documents", "daily"}
    assert "secret.person" not in repr(r)


def test_the_default_clock_is_the_current_time(conn):
    sid = _space(conn)
    _q(conn, "just now", [sid], when=datetime.now(timezone.utc))
    assert space_analytics(conn, sid, 7)["totals"]["questions"] == 1


def test_rows_dated_after_today_are_excluded_so_the_daily_series_matches_the_total(conn):
    sid = _space(conn)
    _q(conn, "today", [sid], when=datetime(2026, 9, 25, 11, 0, tzinfo=timezone.utc))
    _q(conn, "clock skew", [sid], when=datetime(2026, 9, 26, 0, 0, 1, tzinfo=timezone.utc))
    r = space_analytics(conn, sid, 30, now=NOW)
    assert r["totals"]["questions"] == 1
    assert sum(d["questions"] for d in r["daily"]) == 1
    assert [q["text"] for q in r["top_questions"]] == ["today"]


def test_a_question_is_answered_in_a_space_only_if_it_cited_a_document_there(conn):
    s1, s2 = _space(conn, "One"), _space(conn, "Two")
    other = _doc(conn, s2, "Elsewhere")
    _q(conn, "cited only in two", [s1, s2], hits=3, cited=[other])
    a, b = space_analytics(conn, s1, 30, now=NOW), space_analytics(conn, s2, 30, now=NOW)
    assert a["totals"]["unanswered"] == 1 and a["gaps"] == [{"text": "cited only in two", "count": 1}]
    assert b["totals"]["unanswered"] == 0 and b["gaps"] == []


def test_equally_cited_documents_with_the_same_title_have_a_stable_order(conn):
    sid = _space(conn)
    first, second = _doc(conn, sid, "Same"), _doc(conn, sid, "Same")
    _q(conn, "a", [sid], cited=[second, first])
    top = space_analytics(conn, sid, 30, now=NOW)["top_documents"]
    assert [d["document_id"] for d in top] == sorted([first, second])
