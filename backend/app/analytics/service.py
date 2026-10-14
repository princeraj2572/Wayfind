from datetime import datetime, time, timedelta, timezone

PERIODS = (7, 30, 90)

_NORMALIZED = r"lower(btrim(regexp_replace(q.text, '\s+', ' ', 'g')))"
_UNANSWERED = "(q.result_count = 0 OR (q.answer_generated AND cardinality(q.cited_document_ids) = 0))"
_SCOPE = "q.created_at >= %(since)s AND %(space_id)s = ANY(q.space_ids)"


def _ranked(conn, params, extra=""):
    return conn.execute(
        f"""SELECT {_NORMALIZED} AS text, count(*)::int AS count
            FROM queries q
            WHERE {_SCOPE} {extra}
            GROUP BY 1 ORDER BY 2 DESC, 1
            LIMIT 10""",
        params,
    ).fetchall()


def space_analytics(conn, space_id: int, days: int, now: datetime | None = None) -> dict:
    now = now or datetime.now(timezone.utc)
    today = now.astimezone(timezone.utc).date()
    start = today - timedelta(days=days - 1)
    params = {
        "space_id": space_id,
        "since": datetime.combine(start, time.min, tzinfo=timezone.utc),
        "start": start,
        "end": today,
    }

    totals = conn.execute(
        f"""SELECT count(*)::int AS questions,
                   count(*) FILTER (WHERE NOT {_UNANSWERED})::int AS answered,
                   count(*) FILTER (WHERE {_UNANSWERED})::int AS unanswered,
                   count(DISTINCT q.user_id)::int AS unique_askers,
                   count(*) FILTER (WHERE q.answer_generated)::int AS with_generated_answer
            FROM queries q WHERE {_SCOPE}""",
        params,
    ).fetchone()

    top_documents = conn.execute(
        f"""SELECT d.id AS document_id, d.title, count(*)::int AS citations
            FROM queries q
            CROSS JOIN LATERAL unnest(q.cited_document_ids) AS cited(doc_id)
            JOIN documents d ON d.id = cited.doc_id AND d.space_id = %(space_id)s
            WHERE {_SCOPE}
            GROUP BY d.id, d.title
            ORDER BY citations DESC, d.title
            LIMIT 10""",
        params,
    ).fetchall()

    daily = conn.execute(
        """SELECT g.day::date AS day, count(q.id)::int AS questions
           FROM generate_series(%(start)s::date, %(end)s::date, interval '1 day') AS g(day)
           LEFT JOIN queries q
             ON (q.created_at AT TIME ZONE 'UTC')::date = g.day::date
            AND q.created_at >= %(since)s
            AND %(space_id)s = ANY(q.space_ids)
           GROUP BY g.day ORDER BY g.day""",
        params,
    ).fetchall()

    return {
        "days": days,
        "totals": dict(totals),
        "top_questions": [dict(r) for r in _ranked(conn, params)],
        "gaps": [dict(r) for r in _ranked(conn, params, f"AND {_UNANSWERED}")],
        "top_documents": [dict(r) for r in top_documents],
        "daily": [{"date": r["day"].isoformat(), "questions": r["questions"]} for r in daily],
    }
