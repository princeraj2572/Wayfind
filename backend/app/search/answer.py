import re

import anthropic

from app import config


class AnswerUnavailable(Exception):
    pass


SYSTEM = (
    "You answer questions for employees using ONLY the numbered sources provided. "
    "Cite every claim with its source number in square brackets, like [1]. "
    "If the sources do not contain the answer, say you could not find it in the knowledge base. "
    "Never use outside knowledge."
)


def build_prompt(question: str, chunks: list[dict]) -> str:
    sources = "\n\n".join(f"[{i}] {c['title']}\n{c['text']}" for i, c in enumerate(chunks, start=1))
    return f"Sources:\n\n{sources}\n\nQuestion: {question}"


def cited_indices(answer: str, n: int) -> list[int]:
    seen: list[int] = []
    for m in re.finditer(r"\[(\d+)\]", answer):
        k = int(m.group(1))
        if 1 <= k <= n and k not in seen:
            seen.append(k)
    return seen


def generate_answer(question: str, chunks: list[dict], client=None) -> str:
    if client is None:
        if not config.ANTHROPIC_API_KEY:
            raise AnswerUnavailable("ANTHROPIC_API_KEY is not set")
        client = anthropic.Anthropic(api_key=config.ANTHROPIC_API_KEY, timeout=30.0)
    try:
        resp = client.messages.create(
            model=config.ANSWER_MODEL,
            max_tokens=800,
            system=SYSTEM,
            messages=[{"role": "user", "content": build_prompt(question, chunks)}],
        )
    except anthropic.APIError as e:
        raise AnswerUnavailable(f"answer service error: {e.__class__.__name__}")
    return "".join(b.text for b in resp.content if b.type == "text")
