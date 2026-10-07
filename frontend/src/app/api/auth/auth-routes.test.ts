// @vitest-environment node
import { http, HttpResponse } from "msw";
import { beforeEach, expect, test, vi } from "vitest";

vi.mock("next/headers", async () => (await import("@/test/fake-cookies")).headersMock);

import { cookieJar } from "@/test/fake-cookies";
import { server, setupMockServer } from "@/test/server";
import { POST as login } from "./login/route";
import { POST as logout } from "./logout/route";
import { POST as register } from "./register/route";

setupMockServer();
beforeEach(() => cookieJar.clear());

const exp = Math.floor(Date.now() / 1000) + 3600;
const TOKEN = ["e30", Buffer.from(JSON.stringify({ sub: "1", exp })).toString("base64url"), "sig"].join(".");
const USER = { id: 1, email: "a@b.co" };
const call = (fn: typeof login, body: unknown, headers: Record<string, string> = { origin: "http://localhost:3000" }) =>
  fn(
    new Request("http://localhost:3000/api/auth/x", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    }),
  );

test("login sets an httpOnly cookie and never returns the token", async () => {
  let forwarded = "";
  server.use(
    http.post("http://localhost:8000/auth/login", async ({ request }) => {
      forwarded = await request.text();
      return HttpResponse.json({ access_token: TOKEN, token_type: "bearer", user: USER });
    }),
  );
  const res = await call(login, { email: "a@b.co", password: "password123" });
  expect(res.status).toBe(200);
  const text = await res.text();
  expect(JSON.parse(text)).toEqual({ user: USER });
  expect(text).not.toContain(TOKEN);
  expect(JSON.parse(forwarded)).toEqual({ email: "a@b.co", password: "password123" });

  const cookie = cookieJar.get("wayfind_token");
  expect(cookie?.value).toBe(TOKEN);
  expect(cookie?.options).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
  expect(cookie?.options?.secure).toBe(false);
  expect(cookie?.options?.maxAge).toBeGreaterThan(3590);
});

test("register passes the upstream status through and sets the cookie", async () => {
  server.use(
    http.post("http://localhost:8000/auth/register", () =>
      HttpResponse.json({ access_token: TOKEN, token_type: "bearer", user: USER }, { status: 201 }),
    ),
  );
  const res = await call(register, { email: "a@b.co", password: "password123" });
  expect(res.status).toBe(201);
  expect(cookieJar.has("wayfind_token")).toBe(true);
});

test("wrong credentials pass the error through and set no cookie", async () => {
  server.use(
    http.post("http://localhost:8000/auth/login", () =>
      HttpResponse.json({ detail: "invalid email or password" }, { status: 401 }),
    ),
  );
  const res = await call(login, { email: "a@b.co", password: "nope" });
  expect(res.status).toBe(401);
  expect(await res.json()).toEqual({ detail: "invalid email or password" });
  expect(cookieJar.size).toBe(0);
});

test("an unreachable API gives a 502 with a readable message", async () => {
  server.use(http.post("http://localhost:8000/auth/login", () => HttpResponse.error()));
  const res = await call(login, { email: "a@b.co", password: "password123" });
  expect(res.status).toBe(502);
  expect((await res.json()).detail).toMatch(/cannot reach/i);
});

test("a success response without a token is treated as a bad gateway", async () => {
  server.use(http.post("http://localhost:8000/auth/login", () => HttpResponse.json({ user: USER })));
  const res = await call(login, { email: "a@b.co", password: "password123" });
  expect(res.status).toBe(502);
  expect(cookieJar.size).toBe(0);
});

test("cross-origin login attempts are blocked before reaching the API", async () => {
  const res = await call(login, { email: "a@b.co", password: "password123" }, { origin: "https://evil.example" });
  expect(res.status).toBe(403);
  expect(cookieJar.size).toBe(0);
});

test("logout clears the cookie", async () => {
  cookieJar.set("wayfind_token", { value: TOKEN });
  const res = await logout(
    new Request("http://localhost:3000/api/auth/logout", { method: "POST", headers: { origin: "http://localhost:3000" } }),
  );
  expect(res.status).toBe(204);
  expect(cookieJar.has("wayfind_token")).toBe(false);
});

test("cross-site logout is blocked", async () => {
  cookieJar.set("wayfind_token", { value: TOKEN });
  const res = await logout(
    new Request("http://localhost:3000/api/auth/logout", { method: "POST", headers: { "sec-fetch-site": "cross-site" } }),
  );
  expect(res.status).toBe(403);
  expect(cookieJar.has("wayfind_token")).toBe(true);
});
