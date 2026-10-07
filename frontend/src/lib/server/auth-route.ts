import { setAuthCookie } from "./auth-cookie";
import { API_URL, UPSTREAM_TIMEOUT_MS } from "./config";
import { csrfGuard } from "./csrf";

export const unreachable = () => Response.json({ detail: "Cannot reach the Wayfind API." }, { status: 502 });

/** Log in or register upstream, keep the JWT in an httpOnly cookie, return only the user. */
export async function authRoute(request: Request, upstreamPath: "/auth/login" | "/auth/register"): Promise<Response> {
  const blocked = csrfGuard(request);
  if (blocked) return blocked;

  let upstream: Response;
  try {
    upstream = await fetch(`${API_URL}${upstreamPath}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: await request.text(),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch {
    return unreachable();
  }

  const data = await upstream.json().catch(() => null);
  if (!upstream.ok) return Response.json(data ?? { detail: "Request failed" }, { status: upstream.status });
  if (!data?.access_token) return Response.json({ detail: "Unexpected response from the API" }, { status: 502 });

  await setAuthCookie(data.access_token);
  return Response.json({ user: data.user }, { status: upstream.status });
}
