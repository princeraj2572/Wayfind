import { cookies } from "next/headers";
import { DEFAULT_MAX_AGE, MAX_COOKIE_AGE, TOKEN_COOKIE } from "./config";

/** Cookie lifetime from the JWT exp claim (read only for the lifetime; FastAPI verifies the token). */
export function cookieMaxAge(token: string, nowSeconds = Math.floor(Date.now() / 1000)): number {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8"));
    if (typeof payload.exp === "number") return Math.min(MAX_COOKIE_AGE, Math.max(0, payload.exp - nowSeconds));
  } catch {
    /* fall through to the default */
  }
  return DEFAULT_MAX_AGE;
}

export async function setAuthCookie(token: string) {
  (await cookies()).set(TOKEN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: cookieMaxAge(token),
  });
}

export async function clearAuthCookie() {
  (await cookies()).delete(TOKEN_COOKIE);
}

export async function getAuthToken() {
  return (await cookies()).get(TOKEN_COOKIE)?.value;
}
