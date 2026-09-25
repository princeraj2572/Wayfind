/** Accept only same-site relative paths (used for the post-login redirect). */
export function safeNext(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  if (value.includes("\\") || /[\u0000-\u001f\u007f\s]/.test(value)) return null;
  return value;
}
