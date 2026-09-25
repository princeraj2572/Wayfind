// @vitest-environment node
import { NextRequest } from "next/server";
import { config, proxy } from "./proxy";

const req = (path: string, cookie?: string) =>
  new NextRequest(`http://localhost:3000${path}`, { headers: cookie ? { cookie } : {} });

test("visitors with a session cookie continue", () => {
  const res = proxy(req("/ask", "wayfind_token=abc"));
  expect(res.headers.get("x-middleware-next")).toBe("1");
});

test("visitors without a cookie are sent to login with a return path", () => {
  const res = proxy(req("/s/3/d/7?tab=1"));
  expect(res.status).toBe(307);
  const location = new URL(res.headers.get("location")!);
  expect(location.pathname).toBe("/login");
  expect(location.searchParams.get("next")).toBe("/s/3/d/7?tab=1");
});

test("the home page redirects to login without a return path", () => {
  const location = new URL(proxy(req("/")).headers.get("location")!);
  expect(location.pathname).toBe("/login");
  expect(location.searchParams.has("next")).toBe(false);
});

test("the matcher leaves public and asset paths alone", () => {
  const matcher = new RegExp(`^${config.matcher[0]}$`);
  for (const p of ["/api/spaces", "/login", "/register", "/_next/static/x.js", "/icon.svg"]) {
    expect(matcher.test(p)).toBe(false);
  }
  for (const p of ["/", "/ask", "/s/1", "/d/2"]) expect(matcher.test(p)).toBe(true);
});

test("the matcher protects paths that merely start with api, login or register", () => {
  const matcher = new RegExp(`^${config.matcher[0]}$`);
  for (const p of ["/apiary", "/login-help", "/registered"]) expect(matcher.test(p)).toBe(true);
  for (const p of ["/api", "/api/x", "/login", "/register"]) expect(matcher.test(p)).toBe(false);
});
