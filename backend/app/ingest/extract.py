import io
import re
from pathlib import Path


def extract_text(filename: str, data: bytes) -> str:
    ext = Path(filename).suffix.lower()
    if ext in (".md", ".txt"):
        try:
            return data.decode("utf-8")
        except UnicodeDecodeError:
            raise ValueError("file is not valid UTF-8 text")
    if ext == ".pdf":
        return _pdf(data)
    if ext == ".docx":
        return _docx(data)
    raise ValueError(f"unsupported file type: {ext or 'none'}")


def _pdf(data: bytes) -> str:
    from pypdf import PdfReader

    try:
        pages = [(p.extract_text() or "") for p in PdfReader(io.BytesIO(data)).pages]
    except Exception:
        raise ValueError("could not read PDF")
    text = "\n\n".join(p.strip() for p in pages if p.strip())
    if not text:
        raise ValueError("PDF has no extractable text (scanned?)")
    return text


def _docx(data: bytes) -> str:
    from docx import Document

    try:
        doc = Document(io.BytesIO(data))
    except Exception:
        raise ValueError("could not read DOCX")
    blocks = []
    for p in doc.paragraphs:
        text = p.text.strip()
        if not text:
            continue
        m = re.match(r"Heading (\d)", p.style.name or "")
        blocks.append(f"{'#' * int(m.group(1))} {text}" if m else text)
    text = "\n\n".join(blocks)
    if not text:
        raise ValueError("DOCX has no extractable text")
    return text
