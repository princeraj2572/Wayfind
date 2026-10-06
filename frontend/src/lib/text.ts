export function snippet(text: string, max = 180): string {
  const clean = text.replace(/^#{1,6}\s+/gm, "").replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max).trimEnd()}…` : clean;
}
