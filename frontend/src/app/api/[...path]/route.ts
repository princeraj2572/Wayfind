import { clearAuthCookie, getAuthToken } from "@/lib/server/auth-cookie";
import { unreachable } from "@/lib/server/auth-route";
import { API_URL, maxBodyBytes, UPSTREAM_TIMEOUT_MS } from "@/lib/server/config";
import { csrfGuard } from "@/lib/server/csrf";

type Ctx = { params: Promise<{ path: string[] }> };

async function forward(request: Request, ctx: Ctx): Promise<Response> {
  const isRead = request.method === "GET" || request.method === "HEAD";
  if (!isRead) {
    const blocked = csrfGuard(request);
    if (blocked) return blocked;
  }

  const { path } = await ctx.params;
  if (path.some((segment) => segment === "" || segment === "." || segment === ".." || segment.includes("/") || segment.includes("\\"))) {
    return Response.json({ detail: "Bad path" }, { status: 400 });
  }
  // login/register/logout have their own routes; only /auth/me may go through here.
  if (path[0] === "auth" && !(path.length === 2 && path[1] === "me")) {
    return Response.json({ detail: "Not found" }, { status: 404 });
  }

  let body: Uint8Array<ArrayBuffer> | undefined;
  if (!isRead) {
    const cap = maxBodyBytes();
    const tooLarge = () => Response.json({ detail: "Request body too large" }, { status: 413 });
    const declared = Number(request.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > cap) return tooLarge();
    if (request.body) {
      const reader = request.body.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > cap) {
          await reader.cancel().catch(() => undefined);
          return tooLarge();
        }
        chunks.push(value);
      }
      body = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) {
        body.set(chunk, offset);
        offset += chunk.byteLength;
      }
    }
  }

  const token = await getAuthToken();
  if (!token) return Response.json({ detail: "Not logged in" }, { status: 401 });

  // Only these headers are forwarded; the client's own Authorization/Cookie never are.
  const headers = new Headers({ authorization: `Bearer ${token}` });
  for (const name of ["content-type", "accept"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  const url = `${API_URL}/${path.map(encodeURIComponent).join("/")}${new URL(request.url).search}`;
  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: request.method,
      headers,
      body,
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      redirect: "manual",
    });
  } catch {
    return unreachable();
  }

  if (upstream.status === 401) await clearAuthCookie();

  const out = new Headers();
  const contentType = upstream.headers.get("content-type");
  if (contentType) out.set("content-type", contentType);
  const noBody = upstream.status === 204 || upstream.status === 304;
  return new Response(noBody ? null : upstream.body, { status: upstream.status, headers: out });
}

export { forward as GET, forward as POST, forward as PUT, forward as DELETE };
