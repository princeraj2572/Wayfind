export type AnswerPart = { kind: "text"; text: string } | { kind: "cite"; n: number };

/** Split an answer into text and [n] citation chips; only 1..maxN become chips. */
export function splitCitations(answer: string, maxN: number): AnswerPart[] {
  const parts: AnswerPart[] = [];
  let last = 0;
  let buffer = "";
  for (const match of answer.matchAll(/\[(\d+)\]/g)) {
    const n = Number(match[1]);
    const index = match.index ?? 0;
    buffer += answer.slice(last, index);
    last = index + match[0].length;
    if (n >= 1 && n <= maxN) {
      if (buffer) parts.push({ kind: "text", text: buffer });
      buffer = "";
      parts.push({ kind: "cite", n });
    } else {
      buffer += match[0];
    }
  }
  buffer += answer.slice(last);
  if (buffer) parts.push({ kind: "text", text: buffer });
  return parts;
}
