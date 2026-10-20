import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { makeDoc, makeSpace } from "@/test/fixtures";
import { resetNav, router } from "@/test/nav";
import { renderWithClient } from "@/test/render";
import { server, setupMockServer } from "@/test/server";
import { DocEditor } from "./doc-editor";

vi.mock("next/navigation", async () => (await import("@/test/nav")).navigationMock);

setupMockServer();
beforeEach(resetNav);

function mockApi(opts: { role?: "admin" | "editor" | "viewer"; doc?: ReturnType<typeof makeDoc> } = {}) {
  const { role = "admin", doc = makeDoc() } = opts;
  server.use(
    http.get("*/api/spaces", () => HttpResponse.json([makeSpace({ role })])),
    http.get("*/api/documents/10", () => HttpResponse.json(doc)),
  );
}

const title = () => screen.findByRole("textbox", { name: "Title" });
const body = () => screen.getByRole("textbox", { name: "Document body" });
const save = () => screen.getByRole("button", { name: "Save" });

test("shows the title, body, last editor and index status", async () => {
  mockApi();
  renderWithClient(<DocEditor spaceId={1} docId={10} />);
  expect(await title()).toHaveValue("Refund Policy");
  expect(body()).toHaveValue("# Refund Policy\nWithin 30 days.");
  expect(screen.getByText(/Edited .* by alice@example.com/)).toBeInTheDocument();
  expect(screen.getByText("Indexed ✓ · 2 chunks")).toBeInTheDocument();
  expect(save()).toBeDisabled();
});

test("typing marks the document dirty and enables Save and Discard", async () => {
  mockApi();
  renderWithClient(<DocEditor spaceId={1} docId={10} />);
  await userEvent.type(await title(), " v2");
  expect(screen.getByText(/Unsaved changes/)).toBeInTheDocument();
  expect(save()).toBeEnabled();
  await userEvent.click(screen.getByRole("button", { name: "Discard" }));
  expect(await title()).toHaveValue("Refund Policy");
  expect(screen.queryByText(/Unsaved changes/)).not.toBeInTheDocument();
});

test("Save always sends the body together with the title", async () => {
  // Stateful server: after the PUT, GET returns the saved document (still pending, so the editor keeps polling it).
  let current = makeDoc();
  let sent: unknown;
  server.use(
    http.get("*/api/spaces", () => HttpResponse.json([makeSpace()])),
    http.get("*/api/documents/10", () => HttpResponse.json(current)),
    http.put("*/api/documents/10", async ({ request }) => {
      sent = await request.json();
      current = makeDoc({ title: "Refund Policy v2", index_status: "pending", chunk_count: 0, updated_at: "2026-09-25T10:00:00Z" });
      return HttpResponse.json(current);
    }),
  );
  renderWithClient(<DocEditor spaceId={1} docId={10} pollMs={20} />);
  await userEvent.type(await title(), " v2");
  await userEvent.click(save());
  await waitFor(() => expect(sent).toEqual({ title: "Refund Policy v2", body_md: "# Refund Policy\nWithin 30 days." }));
  expect(await screen.findByText("Saved")).toBeInTheDocument();
  await waitFor(() => expect(screen.queryByText(/Unsaved changes/)).not.toBeInTheDocument());
});

test("Ctrl+S saves", async () => {
  mockApi();
  let saved = false;
  server.use(
    http.put("*/api/documents/10", () => {
      saved = true;
      return HttpResponse.json(makeDoc({ title: "Refund Policy!" }));
    }),
  );
  renderWithClient(<DocEditor spaceId={1} docId={10} />);
  await userEvent.type(await title(), "!");
  fireEvent.keyDown(body(), { key: "s", ctrlKey: true });
  await waitFor(() => expect(saved).toBe(true));
});

test("a save error keeps the edits and shows the message", async () => {
  mockApi();
  server.use(http.put("*/api/documents/10", () => HttpResponse.json({ detail: "insufficient role" }, { status: 403 })));
  renderWithClient(<DocEditor spaceId={1} docId={10} />);
  await userEvent.type(await title(), "x");
  await userEvent.click(save());
  expect(await screen.findByText("insufficient role")).toBeInTheDocument();
  expect(await title()).toHaveValue("Refund Policyx");
});

test("toolbar buttons edit the selected text", async () => {
  mockApi();
  renderWithClient(<DocEditor spaceId={1} docId={10} />);
  await title();
  const box = body() as HTMLTextAreaElement;
  box.focus();
  box.setSelectionRange(2, 8); // "Refund"
  await userEvent.click(screen.getByRole("button", { name: "Bold" }));
  expect(box).toHaveValue("# **Refund** Policy\nWithin 30 days.");
  expect(box.selectionStart).toBe(4);
  expect(box.selectionEnd).toBe(10);
});

test("view modes switch between write, split and preview", async () => {
  mockApi();
  renderWithClient(<DocEditor spaceId={1} docId={10} />);
  await title();
  expect(screen.getByRole("heading", { level: 1, name: "Refund Policy" })).toBeInTheDocument(); // split shows both
  await userEvent.click(screen.getByRole("button", { name: "Preview" }));
  expect(screen.queryByRole("textbox", { name: "Document body" })).not.toBeInTheDocument();
  expect(screen.getByRole("heading", { level: 1, name: "Refund Policy" })).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Write" }));
  expect(body()).toBeInTheDocument();
  expect(screen.queryByRole("heading", { level: 1, name: "Refund Policy" })).not.toBeInTheDocument();
});

test("raw HTML in a document is not rendered as HTML", async () => {
  mockApi({ doc: makeDoc({ body_md: "<script>window.hacked=1</script>\n\n<b>bold?</b>" }) });
  renderWithClient(<DocEditor spaceId={1} docId={10} />);
  await title();
  expect(document.querySelector("script")).toBeNull();
  expect(document.querySelector(".md-preview b")).toBeNull();
});

test("Delete asks for confirmation, deletes and returns to the space", async () => {
  mockApi();
  let deleted = false;
  server.use(
    http.delete("*/api/documents/10", () => {
      deleted = true;
      return new HttpResponse(null, { status: 204 });
    }),
  );
  renderWithClient(<DocEditor spaceId={1} docId={10} />);
  await title();
  await userEvent.click(screen.getByRole("button", { name: "Delete" }));
  expect(deleted).toBe(false);
  await userEvent.click(await screen.findByRole("button", { name: "Delete document" }));
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/s/1"));
  expect(deleted).toBe(true);
});

test("after deleting, the editor never flashes a not found state", async () => {
  let deleted = false;
  let getsAfterDelete = 0;
  server.use(
    http.get("*/api/spaces", () => HttpResponse.json([makeSpace()])),
    http.get("*/api/documents/10", () => {
      if (deleted) {
        // Only GETs after the editor has navigated away count; one already in flight when DELETE returned may still land.
        if (vi.mocked(router.replace).mock.calls.length > 0) getsAfterDelete += 1;
        return HttpResponse.json({ detail: "not found" }, { status: 404 });
      }
      return HttpResponse.json(makeDoc({ index_status: "pending", chunk_count: 0 }));
    }),
    http.delete("*/api/documents/10", () => {
      deleted = true;
      return new HttpResponse(null, { status: 204 });
    }),
  );
  renderWithClient(<DocEditor spaceId={1} docId={10} pollMs={10} />);
  await title();
  await userEvent.click(screen.getByRole("button", { name: "Delete" }));
  await userEvent.click(await screen.findByRole("button", { name: "Delete document" }));
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/s/1"));
  await new Promise((r) => setTimeout(r, 100));
  expect(getsAfterDelete).toBe(0);
  expect(screen.queryByText(/Document not found/i)).toBeNull();
  expect(screen.queryByRole("alert")).toBeNull();
});

test("a failed background poll keeps the unsaved edits and does not show not found", async () => {
  let calls = 0;
  server.use(
    http.get("*/api/spaces", () => HttpResponse.json([makeSpace()])),
    http.get("*/api/documents/10", () => {
      calls += 1;
      if (calls === 1) return HttpResponse.json(makeDoc({ index_status: "pending", chunk_count: 0 }));
      return HttpResponse.json({ detail: "boom" }, { status: 500 });
    }),
  );
  renderWithClient(<DocEditor spaceId={1} docId={10} pollMs={200} />);
  await userEvent.type(await title(), " v2");
  await userEvent.type(body(), " more");
  await waitFor(() => expect(calls).toBeGreaterThanOrEqual(2));
  await new Promise((r) => setTimeout(r, 100));
  expect(screen.getByRole("textbox", { name: "Title" })).toHaveValue("Refund Policy v2");
  expect(body()).toHaveValue("# Refund Policy\nWithin 30 days. more");
  expect(screen.queryByText(/Document not found/i)).toBeNull();
});

test("a non-404 load error says it could not load the document", async () => {
  server.use(
    http.get("*/api/spaces", () => HttpResponse.json([makeSpace()])),
    http.get("*/api/documents/10", () => HttpResponse.json({ detail: "database down" }, { status: 500 })),
  );
  renderWithClient(<DocEditor spaceId={1} docId={10} />);
  expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't load this document/i);
  expect(screen.queryByText(/Document not found/i)).toBeNull();
});

test("a viewer opening the new document page gets a read-only notice, not the editor", async () => {
  server.use(http.get("*/api/spaces", () => HttpResponse.json([makeSpace({ role: "viewer" })])));
  renderWithClient(<DocEditor spaceId={1} docId={null} />);
  expect(await screen.findByText("Read-only access")).toBeInTheDocument();
  expect(screen.getByText(/not create new ones/i)).toBeInTheDocument();
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  expect(screen.queryByRole("toolbar")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
});

test("a title typed while a save is in flight is not overwritten", async () => {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  mockApi();
  server.use(
    http.put("*/api/documents/10", async () => {
      await gate;
      return HttpResponse.json(makeDoc({ title: "Refund Policy v2" }));
    }),
  );
  renderWithClient(<DocEditor spaceId={1} docId={10} />);
  await userEvent.type(await title(), " v2");
  await userEvent.click(save());
  await screen.findByRole("button", { name: "Saving…" });
  await userEvent.type(screen.getByRole("textbox", { name: "Title" }), "X");
  release();
  // (A "Saved" toast from an earlier test can linger in sonner's global store, so wait on the button instead.)
  await waitFor(() => expect(screen.queryByRole("button", { name: "Saving…" })).toBeNull());
  expect(screen.getByRole("textbox", { name: "Title" })).toHaveValue("Refund Policy v2X");
});

test("viewers get a read-only page with an Ask link", async () => {
  mockApi({ role: "viewer" });
  renderWithClient(<DocEditor spaceId={1} docId={10} />);
  expect(await screen.findByRole("heading", { level: 1, name: "Refund Policy" })).toBeInTheDocument();
  expect(screen.getByText(/read-only access/i)).toBeInTheDocument();
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Ask about this" })).toHaveAttribute("href", "/ask?space=1");
});

test("a pending document is polled until it is indexed", async () => {
  server.use(http.get("*/api/spaces", () => HttpResponse.json([makeSpace()])));
  let calls = 0;
  server.use(
    http.get("*/api/documents/10", () => {
      calls += 1;
      return HttpResponse.json(
        calls < 3 ? makeDoc({ index_status: "pending", chunk_count: 0 }) : makeDoc({ index_status: "indexed", chunk_count: 3 }),
      );
    }),
  );
  renderWithClient(<DocEditor spaceId={1} docId={10} pollMs={20} stuckAfterMs={5000} />);
  expect(await screen.findByText("Indexing…")).toBeInTheDocument();
  expect(await screen.findByText("Indexed ✓ · 3 chunks", {}, { timeout: 3000 })).toBeInTheDocument();
});

test("a document stuck in pending says so, stops polling and can be saved again", async () => {
  server.use(http.get("*/api/spaces", () => HttpResponse.json([makeSpace()])));
  let calls = 0;
  server.use(
    http.get("*/api/documents/10", () => {
      calls += 1;
      return HttpResponse.json(makeDoc({ index_status: "pending", chunk_count: 0 }));
    }),
  );
  renderWithClient(<DocEditor spaceId={1} docId={10} pollMs={15} stuckAfterMs={80} />);
  expect(await screen.findByText("Still indexing…", {}, { timeout: 3000 })).toBeInTheDocument();
  expect(save()).toBeEnabled();
  const settled = calls;
  await new Promise((r) => setTimeout(r, 120));
  expect(calls - settled).toBeLessThanOrEqual(1);
});

test("a failed index explains itself and Save works without any edit", async () => {
  mockApi({ doc: makeDoc({ index_status: "failed", chunk_count: 0 }) });
  let sent: unknown;
  server.use(
    http.put("*/api/documents/10", async ({ request }) => {
      sent = await request.json();
      return HttpResponse.json(makeDoc({ index_status: "pending", chunk_count: 0 }));
    }),
  );
  renderWithClient(<DocEditor spaceId={1} docId={10} pollMs={20} />);
  expect(await screen.findByText(/Indexing failed\. Save again to retry/)).toBeInTheDocument();
  expect(save()).toBeEnabled();
  await userEvent.click(save());
  await waitFor(() => expect(sent).toEqual({ title: "Refund Policy", body_md: "# Refund Policy\nWithin 30 days." }));
});

test("a new document is created on Save and then opened", async () => {
  server.use(http.get("*/api/spaces", () => HttpResponse.json([makeSpace()])));
  let sent: unknown;
  server.use(
    http.post("*/api/spaces/1/documents", async ({ request }) => {
      sent = await request.json();
      return HttpResponse.json(makeDoc({ id: 42, title: "Handbook", body_md: "Hello" }), { status: 201 });
    }),
  );
  renderWithClient(<DocEditor spaceId={1} docId={null} />);
  const t = await title();
  expect(save()).toBeDisabled();
  await userEvent.type(t, "Handbook");
  await userEvent.type(body(), "Hello");
  await userEvent.click(save());
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/s/1/d/42"));
  expect(sent).toEqual({ title: "Handbook", body_md: "Hello" });
});

test("a blank title falls back to Untitled", async () => {
  server.use(http.get("*/api/spaces", () => HttpResponse.json([makeSpace()])));
  let sent: unknown;
  server.use(
    http.post("*/api/spaces/1/documents", async ({ request }) => {
      sent = await request.json();
      return HttpResponse.json(makeDoc({ id: 43 }), { status: 201 });
    }),
  );
  renderWithClient(<DocEditor spaceId={1} docId={null} />);
  await title();
  await userEvent.type(body(), "Just a body");
  await userEvent.click(save());
  await waitFor(() => expect(sent).toEqual({ title: "Untitled", body_md: "Just a body" }));
});

test("a missing document shows a not found state", async () => {
  server.use(
    http.get("*/api/spaces", () => HttpResponse.json([makeSpace()])),
    http.get("*/api/documents/10", () => HttpResponse.json({ detail: "not found" }, { status: 404 })),
  );
  renderWithClient(<DocEditor spaceId={1} docId={10} />);
  expect(await screen.findByRole("alert")).toHaveTextContent(/document not found/i);
});

test("after creating, a second save cannot create again and the fields are read-only", async () => {
  server.use(http.get("*/api/spaces", () => HttpResponse.json([makeSpace()])));
  let posts = 0;
  server.use(
    http.post("*/api/spaces/1/documents", () => {
      posts += 1;
      return HttpResponse.json(makeDoc({ id: 42, title: "Handbook", body_md: "Hello" }), { status: 201 });
    }),
  );
  renderWithClient(<DocEditor spaceId={1} docId={null} />);
  const t = await title();
  await userEvent.type(t, "Handbook");
  await userEvent.type(body(), "Hello");
  await userEvent.click(save());
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/s/1/d/42"));
  await userEvent.keyboard("{Control>}s{/Control}");
  fireEvent.click(screen.getByRole("button", { name: /Saving|Save/ }));
  expect(t).toHaveAttribute("readonly");
  expect(body()).toHaveAttribute("readonly");
  expect(posts).toBe(1);
});

test("a spaces load error is not reported as a missing space", async () => {
  server.use(http.get("*/api/spaces", () => HttpResponse.json({ detail: "boom" }, { status: 500 })));
  renderWithClient(<DocEditor spaceId={1} docId={null} />);
  expect(await screen.findByText("Couldn't load your spaces")).toBeInTheDocument();
  expect(screen.queryByText("Space not found")).not.toBeInTheDocument();
});

test("a spaces refetch that no longer lists the space keeps the mounted editor and its edits", async () => {
  mockApi();
  const { client } = renderWithClient(<DocEditor spaceId={1} docId={10} />);
  await userEvent.type(await title(), " v2");
  server.use(http.get("*/api/spaces", () => HttpResponse.json([])));
  await client.invalidateQueries({ queryKey: ["spaces"] });
  await new Promise((r) => setTimeout(r, 50));
  expect(screen.queryByText("Space not found")).not.toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: "Title" })).toHaveValue("Refund Policy v2");
});

test("while a new document is being created, Discard and the formatting toolbar are locked", async () => {
  server.use(
    http.get("*/api/spaces", () => HttpResponse.json([makeSpace()])),
    http.post("*/api/spaces/1/documents", async () => {
      await delay(300);
      return HttpResponse.json(makeDoc({ id: 42, title: "Handbook", body_md: "Hello" }), { status: 201 });
    }),
  );
  renderWithClient(<DocEditor spaceId={1} docId={null} />);
  await userEvent.type(await title(), "Handbook");
  await userEvent.type(body(), "Hello");
  expect(screen.getByRole("button", { name: "Discard" })).toBeInTheDocument();
  await userEvent.click(save());
  await waitFor(() => expect(screen.queryByRole("button", { name: "Discard" })).not.toBeInTheDocument());
  expect(screen.getByRole("button", { name: "Bold" })).toBeDisabled();
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/s/1/d/42"));
});

test("after a save the editor shows what the server stored, so it is not left dirty", async () => {
  mockApi();
  server.use(
    http.put("*/api/documents/10", () =>
      HttpResponse.json(makeDoc({ title: "Refund Policy", body_md: "cleaned by the server" })),
    ),
  );
  renderWithClient(<DocEditor spaceId={1} docId={10} />);
  await userEvent.type(await title(), " v2");
  await userEvent.type(body(), " with junk");
  await userEvent.click(save());
  await waitFor(() => expect(body()).toHaveValue("cleaned by the server"));
  expect(screen.getByRole("textbox", { name: "Title" })).toHaveValue("Refund Policy");
  expect(save()).toBeDisabled();
  expect(screen.queryByRole("button", { name: "Discard" })).not.toBeInTheDocument();
});
