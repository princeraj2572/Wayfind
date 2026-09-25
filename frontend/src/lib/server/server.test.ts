// @vitest-environment node
import { cookieMaxAge } from "./auth-cookie";
import { csrfGuard, isSameOrigin } from "./csrf";

const tokenWith = (payload: object) =>
  ["e30", Buffer.from(JSON.stringify(payload)).toString("base64url"), "sig"].join(".");

test("cookie lifetime follows the JWT exp claim", () => {
  expect(cookieMaxAge(tokenWith({ exp: 5000 }), 1400)).toBe(3600);
});

test("an already expired token gets a zero lifetime", () => {
  expect(cookieMaxAge(tokenWith({ exp: 100 }), 1400)).toBe(0);
});

test.each(["garbage", "a.b.c", tokenWith({}), tokenWith({ exp: "soon" })])("falls back to one hour for %s", (t) => {
  expect(cookieMaxAge(t, 1400)).toBe(3600);
});

const req = (headers: Record<string, string>, url = "http://localhost:3000/api/x") =>
  new Request(url, { method: "POST", headers });

test("same-origin requests pass", () => {
  expect(isSameOrigin(req({ origin: "http://localhost:3000" }))).toBe(true);
  expect(isSameOrigin(req({ origin: "http://localhost:3000", "sec-fetch-site": "same-origin" }))).toBe(true);
  expect(isSameOrigin(req({ "sec-fetch-site": "none" }))).toBe(true);
});

test("non-browser clients without origin headers pass", () => {
  expect(isSameOrigin(req({}))).toBe(true);
});

test("cross-origin or cross-site requests are refused", () => {
  expect(isSameOrigin(req({ origin: "https://evil.example" }))).toBe(false);
  expect(isSameOrigin(req({ "sec-fetch-site": "cross-site" }))).toBe(false);
  expect(isSameOrigin(req({ "sec-fetch-site": "same-site" }))).toBe(false);
  expect(isSameOrigin(req({ origin: "not a url" }))).toBe(false);
});

test("csrfGuard returns a 403 response only when blocked", async () => {
  expect(csrfGuard(req({ origin: "http://localhost:3000" }))).toBeNull();
  const blocked = csrfGuard(req({ origin: "https://evil.example" }));
  expect(blocked?.status).toBe(403);
  expect(await blocked?.json()).toEqual({ detail: "Cross-site request blocked" });
});

test("the cookie lifetime is capped at 30 days", () => {
  expect(cookieMaxAge(tokenWith({ exp: 1400 + 10 * 365 * 24 * 3600 }), 1400)).toBe(30 * 24 * 3600);
});

test.each([["-5"], ["0"], ["abc"], [""]])("MAX_REQUEST_BYTES=%j falls back to 25 MB", async (value) => {
  vi.stubEnv("MAX_REQUEST_BYTES", value);
  const { maxBodyBytes } = await import("./config");
  expect(maxBodyBytes()).toBe(25 * 1024 * 1024);
  vi.unstubAllEnvs();
});
