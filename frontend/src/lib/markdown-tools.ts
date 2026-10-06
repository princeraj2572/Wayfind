export type Edit = { text: string; start: number; end: number };

export function wrapSelection(
  text: string,
  start: number,
  end: number,
  before: string,
  after: string = before,
  placeholder = "text",
): Edit {
  const selected = text.slice(start, end) || placeholder;
  const next = text.slice(0, start) + before + selected + after + text.slice(end);
  return { text: next, start: start + before.length, end: start + before.length + selected.length };
}

function lineBounds(text: string, start: number, end: number) {
  const lineStart = start === 0 ? 0 : text.lastIndexOf("\n", start - 1) + 1;
  const effectiveEnd = end > start && text[end - 1] === "\n" ? end - 1 : end;
  const newline = text.indexOf("\n", effectiveEnd);
  return { lineStart, lineEnd: newline === -1 ? text.length : newline };
}

export function prefixLines(
  text: string,
  start: number,
  end: number,
  prefixFor: (index: number) => string,
  strip?: RegExp,
): Edit {
  const { lineStart, lineEnd } = lineBounds(text, start, end);
  const lines = text.slice(lineStart, lineEnd).split("\n");
  let n = 0;
  const out = lines.map((line) => {
    if (lines.length > 1 && line.trim() === "") return line;
    return prefixFor(n++) + (strip ? line.replace(strip, "") : line);
  });
  const replaced = out.join("\n");
  return {
    text: text.slice(0, lineStart) + replaced + text.slice(lineEnd),
    start: lineStart,
    end: lineStart + replaced.length,
  };
}

const LIST_MARKER = /^(?:[-*+]|\d+\.)\s+/;

export const bold = (t: string, s: number, e: number) => wrapSelection(t, s, e, "**");
export const italic = (t: string, s: number, e: number) => wrapSelection(t, s, e, "_");
export const inlineCode = (t: string, s: number, e: number) => wrapSelection(t, s, e, "`");
export const link = (t: string, s: number, e: number) => wrapSelection(t, s, e, "[", "](https://)", "link text");
export const heading = (t: string, s: number, e: number, level: 1 | 2 | 3) =>
  prefixLines(t, s, e, () => `${"#".repeat(level)} `, /^#{1,6}\s+/);
export const bulletList = (t: string, s: number, e: number) => prefixLines(t, s, e, () => "- ", LIST_MARKER);
export const numberedList = (t: string, s: number, e: number) =>
  prefixLines(t, s, e, (i) => `${i + 1}. `, LIST_MARKER);
