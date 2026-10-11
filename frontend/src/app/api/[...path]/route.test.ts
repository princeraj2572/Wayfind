// @vitest-environment node
import { http, HttpResponse } from "msw";
import { beforeEach, expect, test, vi } from "vitest";

vi.mock("next/headers", async () => (await import("@/test/fake-cookies")).headersMock);

import { cookieJar } from "@/test/fake-cookies";
import { server, setupMockServer } from "@/test/server";
import { DELETE, GET, POST } from "./route";

setupMockServer();
beforeEach(() => {
  cookieJar.clear();
  cookieJar.set("wayfind_token", { value: "tok" });
});

const ctx = (...path: string[]) => ({ params: Promise.resolve({ path }) });
const same = { origin: "http://localhost:3000" };

test("forwards a GET with its query string and the bearer token", async () => {
  server.use(
    http.get("http://localhost:8000/spaces/1/documents", ({ request }) =>
      HttpResponse.json({ auth: request.headers.get("authorization"), q: new URL(request.url).search }),
    ),
  );
  const res = await GET(new Request("http://localhost:3000/api/spaces/1/documents?limit=2"), ctx("spaces", "1", "documents"));
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ auth: "Bearer tok", q: "?limit=2" });
});

test("never forwards a client-supplied Authorization or Cookie header", async () => {
  server.use(
    http.get("http://localhost:8000/auth/me", ({ request }) =>
      HttpResponse.json({ auth: request.headers.get("authorization"), cookie: request.headers.get("cookie") }),
    ),
  );
  const res = await GET(
    new Request("http://localhost:3000/api/auth/me", { headers: { authorization: "Bearer attacker", cookie: "a=b" } }),
    ctx("auth", "me"),
  );
  expect(await res.json()).toEqual({ auth: "Bearer tok", cookie: null });
});

test("forwards a JSON POST with its body and content type", async () => {
  server.use(
    http.post("http://localhost:8000/ask", async ({ request }) =>
      HttpResponse.json({ type: request.headers.get("content-type"), body: await request.json() }, { status: 200 }),
    ),
  );
  const res = await POST(
    new Request("http://localhost:3000/api/ask", {
      method: "POST",
      headers: { "content-type": "application/json", ...same },
      body: JSON.stringify({ question: "hi" }),
    }),
    ctx("ask"),
  );
  expect(await res.json()).toEqual({ type: "application/json", body: { question: "hi" } });
});

test("forwards multipart uploads byte for byte", async () => {
  server.use(
    http.post("http://localhost:8000/spaces/1/documents/upload", async ({ request }) => {
      const file = (await request.formData()).get("file") as File;
      return HttpResponse.json({ name: file.name, size: file.size }, { status: 201 });
    }),
  );
  const fd = new FormData();
  fd.append("file", new File(["# hi"], "a.md", { type: "text/markdown" }));
  const res = await POST(
    new Request("http://localhost:3000/api/spaces/1/documents/upload", { method: "POST", body: fd, headers: same }),
    ctx("spaces", "1", "documents", "upload"),
  );
  expect(res.status).toBe(201);
  expect(await res.json()).toEqual({ name: "a.md", size: 4 });
});

test("passes error statuses and bodies through", async () => {
  server.use(http.get("http://localhost:8000/documents/9", () => HttpResponse.json({ detail: "not found" }, { status: 404 })));
  const res = await GET(new Request("http://localhost:3000/api/documents/9"), ctx("documents", "9"));
  expect(res.status).toBe(404);
  expect(await res.json()).toEqual({ detail: "not found" });
});

test("a 204 response has no body", async () => {
  server.use(http.delete("http://localhost:8000/documents/9", () => new HttpResponse(null, { status: 204 })));
  const res = await DELETE(
    new Request("http://localhost:3000/api/documents/9", { method: "DELETE", headers: same }),
    ctx("documents", "9"),
  );
  expect(res.status).toBe(204);
  expect(await res.text()).toBe("");
});

test("an upstream 401 clears the session cookie", async () => {
  server.use(http.get("http://localhost:8000/auth/me", () => HttpResponse.json({ detail: "invalid or missing token" }, { status: 401 })));
  const res = await GET(new Request("http://localhost:3000/api/auth/me"), ctx("auth", "me"));
  expect(res.status).toBe(401);
  expect(cookieJar.has("wayfind_token")).toBe(false);
});

test("without a cookie no request reaches the API", async () => {
  cookieJar.clear();
  const res = await GET(new Request("http://localhost:3000/api/spaces"), ctx("spaces"));
  expect(res.status).toBe(401);
  expect(await res.json()).toEqual({ detail: "Not logged in" });
});

test("cross-site state-changing requests are blocked", async () => {
  const crossSite: Record<string, string>[] = [{ origin: "https://evil.example" }, { "sec-fetch-site": "cross-site" }];
  for (const headers of crossSite) {
    const res = await POST(
      new Request("http://localhost:3000/api/ask", { method: "POST", headers, body: "{}" }),
      ctx("ask"),
    );
    expect(res.status).toBe(403);
  }
});

test("GET requests need no origin header", async () => {
  server.use(http.get("http://localhost:8000/spaces", () => HttpResponse.json([])));
  const res = await GET(new Request("http://localhost:3000/api/spaces", { headers: { "sec-fetch-site": "same-origin" } }), ctx("spaces"));
  expect(res.status).toBe(200);
});

test.each([[".."], ["."], [""]])("refuses the path segment %j", async (segment) => {
  const res = await GET(new Request("http://localhost:3000/api/x"), ctx("documents", segment));
  expect(res.status).toBe(400);
});

test("upstream headers such as set-cookie are not leaked to the browser", async () => {
  server.use(
    http.get("http://localhost:8000/spaces", () =>
      HttpResponse.json([], { headers: { "set-cookie": "evil=1", "x-secret": "1" } }),
    ),
  );
  const res = await GET(new Request("http://localhost:3000/api/spaces"), ctx("spaces"));
  expect(res.headers.get("set-cookie")).toBeNull();
  expect(res.headers.get("x-secret")).toBeNull();
  expect(res.headers.get("content-type")).toContain("application/json");
});

test("an unreachable API gives a 502", async () => {
  server.use(http.get("http://localhost:8000/spaces", () => HttpResponse.error()));
  const res = await GET(new Request("http://localhost:3000/api/spaces"), ctx("spaces"));
  expect(res.status).toBe(502);
  expect((await res.json()).detail).toMatch(/cannot reach/i);
});

test("refuses a segment containing an encoded slash or a backslash", async () => {
  const a = await GET(new Request("http://localhost:3000/api/x"), ctx("auth/login"));
  expect(a.status).toBe(400);
  const b = await GET(new Request("http://localhost:3000/api/x"), ctx("documents", "a\\b"));
  expect(b.status).toBe(400);
});

test("the static auth routes are not reachable through the catch-all", async () => {
  let called = false;
  server.use(
    http.all("http://localhost:8000/auth/*", () => {
      called = true;
      return HttpResponse.json({ access_token: "x" });
    }),
  );
  for (const last of ["login", "register", "logout"]) {
    const res = await GET(new Request("http://localhost:3000/api/x"), ctx("auth", last));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ detail: "Not found" });
  }
  expect(called).toBe(false);
});

test("auth/me still goes through the catch-all", async () => {
  server.use(http.get("http://localhost:8000/auth/me", () => HttpResponse.json({ id: 1 })));
  const res = await GET(new Request("http://localhost:3000/api/auth/me"), ctx("auth", "me"));
  expect(res.status).toBe(200);
});

test("a declared content-length above the cap gets a 413 without reaching the API", async () => {
  vi.stubEnv("MAX_REQUEST_BYTES", "1024");
  let called = false;
  server.use(
    http.post("http://localhost:8000/ask", () => {
      called = true;
      return HttpResponse.json({});
    }),
  );
  const res = await POST(
    new Request("http://localhost:3000/api/ask", {
      method: "POST",
      headers: { "content-length": "5000", "content-type": "application/json", ...same },
      body: "{}",
    }),
    ctx("ask"),
  );
  vi.unstubAllEnvs();
  expect(res.status).toBe(413);
  expect(await res.json()).toEqual({ detail: "Request body too large" });
  expect(called).toBe(false);
});

test("a streamed body over the cap without a content-length gets a 413", async () => {
  vi.stubEnv("MAX_REQUEST_BYTES", "1024");
  let called = false;
  server.use(
    http.post("http://localhost:8000/ask", () => {
      called = true;
      return HttpResponse.json({});
    }),
  );
  const chunk = new Uint8Array(600);
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(chunk);
      controller.enqueue(chunk);
      controller.enqueue(chunk);
      controller.close();
    },
  });
  const req = new Request("http://localhost:3000/api/ask", {
    method: "POST",
    headers: { "content-type": "application/octet-stream", ...same },
    body,
    // @ts-expect-error duplex is required for stream bodies in Node
    duplex: "half",
  });
  req.headers.delete("content-length");
  const res = await POST(req, ctx("ask"));
  vi.unstubAllEnvs();
  expect(res.status).toBe(413);
  expect(called).toBe(false);
});

test("a body under the cap passes through", async () => {
  vi.stubEnv("MAX_REQUEST_BYTES", "1024");
  server.use(http.post("http://localhost:8000/ask", async ({ request }) => HttpResponse.json(await request.json())));
  const res = await POST(
    new Request("http://localhost:3000/api/ask", {
      method: "POST",
      headers: { "content-type": "application/json", ...same },
      body: JSON.stringify({ q: "small" }),
    }),
    ctx("ask"),
  );
  vi.unstubAllEnvs();
  expect(await res.json()).toEqual({ q: "small" });
});
