export type ApiInit = RequestInit & { redirectOn401?: boolean };

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

let onUnauthorized: () => void = () => {
  if (typeof window === "undefined") return;
  const next = window.location.pathname + window.location.search;
  const target = `/login?next=${encodeURIComponent(next)}`;
  // Deliberate full-page navigation: drops all client state and works outside React.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign(target);
};

export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

export function errorText(detail: unknown, fallback: string): string {
  if (typeof detail === "string" && detail) return detail;
  if (Array.isArray(detail)) {
    const messages = detail
      .map((d) => (d && typeof d === "object" && "msg" in d ? String((d as { msg: unknown }).msg) : ""))
      .filter(Boolean);
    if (messages.length) return messages.join("; ");
  }
  return fallback;
}

/** The API's message for an ApiError; any other error gets the fallback (never leak internals). */
export const errorMessage = (err: unknown, fallback: string): string => (err instanceof ApiError ? err.message : fallback);

export const jsonBody = (value: unknown) => JSON.stringify(value);

export async function apiFetch<T>(path: string, init: ApiInit = {}): Promise<T> {
  const { redirectOn401 = true, headers, body, ...rest } = init;
  const merged = new Headers(headers);
  if (typeof body === "string" && !merged.has("content-type")) merged.set("content-type", "application/json");

  let res: Response;
  try {
    res = await fetch(`/api${path}`, { credentials: "same-origin", ...rest, headers: merged, body });
  } catch {
    throw new ApiError(0, "Cannot reach the server. Check your connection and try again.");
  }

  if (res.status === 401 && redirectOn401) onUnauthorized();
  if (!res.ok) {
    let detail: unknown;
    try {
      detail = (await res.json()).detail;
    } catch {
      /* not JSON */
    }
    throw new ApiError(res.status, errorText(detail, `Request failed (${res.status})`));
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
