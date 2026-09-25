export function isSameOrigin(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return false;
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).host === new URL(request.url).host;
    } catch {
      return false;
    }
  }
  return true;
}

export function csrfGuard(request: Request): Response | null {
  return isSameOrigin(request) ? null : Response.json({ detail: "Cross-site request blocked" }, { status: 403 });
}
