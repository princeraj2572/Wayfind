from types import SimpleNamespace

import anthropic
import httpx
import pytest

from app.search.answer import AnswerUnavailable, build_prompt, cited_indices, generate_answer

CHUNKS = [
    {"id": 10, "title": "Refunds", "text": "Refund within 30 days."},
    {"id": 11, "title": "SLA", "text": "99.9 percent uptime."},
]


def test_prompt_numbers_sources_and_includes_question():
    p = build_prompt("How long?", CHUNKS)
    assert "[1] Refunds" in p and "[2] SLA" in p
    assert "Question: How long?" in p


def test_cited_indices_valid_unique_in_order():
    assert cited_indices("See [2] and [1], again [2]; ignore [7] and [0].", 2) == [2, 1]
    assert cited_indices("no citations", 2) == []


class FakeClient:
    def __init__(self, text=None, error=None):
        self.text, self.error = text, error
        self.messages = SimpleNamespace(create=self._create)

    def _create(self, **kwargs):
        self.kwargs = kwargs
        if self.error:
            raise self.error
        return SimpleNamespace(content=[SimpleNamespace(type="text", text=self.text)])


def test_generate_answer_returns_text_and_sends_prompt():
    client = FakeClient(text="30 days [1].")
    assert generate_answer("How long?", CHUNKS, client=client) == "30 days [1]."
    assert "Refund within 30 days." in client.kwargs["messages"][0]["content"]


def test_api_error_becomes_answer_unavailable():
    err = anthropic.APIConnectionError(request=httpx.Request("POST", "https://x"))
    with pytest.raises(AnswerUnavailable):
        generate_answer("q", CHUNKS, client=FakeClient(error=err))


def test_missing_api_key_is_unavailable(monkeypatch):
    monkeypatch.setattr("app.search.answer.config.ANTHROPIC_API_KEY", "")
    with pytest.raises(AnswerUnavailable):
        generate_answer("q", CHUNKS)
