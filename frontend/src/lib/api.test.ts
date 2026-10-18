import { http, HttpResponse } from "msw";
import { server, setupMockServer } from "@/test/server";
import { ApiError, apiFetch, errorText, jsonBody, setUnauthorizedHandler } from "./api";

setupMockServer();

test("prefixes /api and parses JSON", async () => {
  server.use(http.get("*/api/spaces", () => HttpResponse.json([{ id: 1 }])));
  expect(await apiFetch("/spaces")).toEqual([{ id: 1 }]);
});

test("sends string bodies as JSON", async () => {
  let type: string | null = null;
  server.use(
    http.post("*/api/ask", async ({ request }) => {
      type = request.headers.get("content-type");
      return HttpResponse.json({ ok: true });
    }),
  );
  await apiFetch("/ask", { method: "POST", body: jsonBody({ question: "hi" }) });
  expect(type).toBe("application/json");
});

test("leaves FormData bodies to the browser", async () => {
  let type: string | null = null;
  server.use(
    http.post("*/api/upload", async ({ request }) => {
      type = request.headers.get("content-type");
      return HttpResponse.json({ ok: true });
    }),
  );
  const fd = new FormData();
  fd.append("file", new File(["x"], "a.md"));
  await apiFetch("/upload", { method: "POST", body: fd });
  expect(type).toMatch(/^multipart\/form-data; boundary=/);
});

test("returns undefined for 204", async () => {
  server.use(http.delete("*/api/documents/1", () => new HttpResponse(null, { status: 204 })));
  expect(await apiFetch("/documents/1", { method: "DELETE" })).toBeUndefined();
});

test("throws ApiError with the FastAPI detail string", async () => {
  server.use(http.get("*/api/documents/9", () => HttpResponse.json({ detail: "not found" }, { status: 404 })));
  await expect(apiFetch("/documents/9")).rejects.toMatchObject({ name: "ApiError", status: 404, message: "not found" });
});

test("joins validation messages from a 422 detail array", async () => {
  server.use(
    http.post("*/api/spaces", () =>
      HttpResponse.json({ detail: [{ msg: "Field required" }, { msg: "Too short" }] }, { status: 422 }),
    ),
  );
  await expect(apiFetch("/spaces", { method: "POST", body: "{}" })).rejects.toThrow("Field required; Too short");
});

test("falls back to a generic message when the error is not JSON", async () => {
  server.use(http.get("*/api/x", () => new HttpResponse("boom", { status: 500 })));
  await expect(apiFetch("/x")).rejects.toMatchObject({ status: 500, message: "Request failed (500)" });
});

test("a network failure becomes an ApiError with status 0", async () => {
  server.use(http.get("*/api/x", () => HttpResponse.error()));
  const error = (await apiFetch("/x").catch((e) => e)) as ApiError;
  expect(error).toBeInstanceOf(ApiError);
  expect(error.status).toBe(0);
  expect(error.message).toMatch(/cannot reach/i);
});

test("a 401 calls the unauthorized handler unless told not to", async () => {
  const handler = vi.fn();
  setUnauthorizedHandler(handler);
  server.use(http.get("*/api/auth/me", () => HttpResponse.json({ detail: "Not logged in" }, { status: 401 })));
  await expect(apiFetch("/auth/me")).rejects.toMatchObject({ status: 401 });
  expect(handler).toHaveBeenCalledTimes(1);
  await expect(apiFetch("/auth/me", { redirectOn401: false })).rejects.toMatchObject({ status: 401 });
  expect(handler).toHaveBeenCalledTimes(1);
});

test.each([
  ["plain", "plain"],
  [[{ msg: "a" }], "a"],
  [[], "fallback"],
  [undefined, "fallback"],
  [{ x: 1 }, "fallback"],
])("errorText(%j) reads %s", (detail, expected) => {
  expect(errorText(detail, "fallback")).toBe(expected);
});

test("errorMessage uses an ApiError's message and the fallback for anything else", async () => {
  const { ApiError, errorMessage } = await import("./api");
  expect(errorMessage(new ApiError(409, "a space must keep at least one admin"), "fallback")).toBe("a space must keep at least one admin");
  expect(errorMessage(new Error("internal detail"), "fallback")).toBe("fallback");
  expect(errorMessage("weird", "fallback")).toBe("fallback");
});
