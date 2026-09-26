from app.ingest.chunk import chunk_markdown


def test_empty_and_whitespace_give_no_chunks():
    assert chunk_markdown("") == []
    assert chunk_markdown("  \n\n ") == []


def test_short_doc_is_one_chunk():
    assert chunk_markdown("Just a note.") == ["Just a note."]


def test_splits_on_headings_and_keeps_heading_with_body():
    md = "# Refunds\nWithin 30 days.\n\n## Enterprise\nNet 60 terms."
    assert chunk_markdown(md) == ["# Refunds\nWithin 30 days.", "## Enterprise\nNet 60 terms."]


def test_text_before_first_heading_is_kept():
    md = "Intro line.\n# Title\nBody."
    assert chunk_markdown(md) == ["Intro line.", "# Title\nBody."]


def test_long_section_is_windowed_with_overlap():
    words = [f"w{i}" for i in range(500)]
    chunks = chunk_markdown(" ".join(words), max_words=200, overlap=50)
    assert len(chunks) == 3
    assert all(len(c.split()) <= 200 for c in chunks)
    first, second = chunks[0].split(), chunks[1].split()
    assert first[-50:] == second[:50]
    assert chunks[-1].split()[-1] == "w499"
