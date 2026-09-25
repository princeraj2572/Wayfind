import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { makeDoc, makeSpace } from "@/test/fixtures";
import { renderWithClient } from "@/test/render";
import { server, setupMockServer } from "@/test/server";
import { IndexBadge } from "./index-badge";
import { SpaceDocuments } from "./space-documents";

setupMockServer();

test.each([
  ["indexed", 2, false, "Indexed ✓ · 2 chunks"],
  ["indexed", 1, false, "Indexed ✓ · 1 chunk"],
  ["pending", 0, false, "Indexing…"],
  ["pending", 0, true, "Still indexing…"],
  ["failed", 0, false, "Indexing failed"],
] as const)("IndexBadge %s/%i/%s reads %s", (status, chunkCount, stuck, text) => {
  renderWithClient(<IndexBadge status={status} chunkCount={chunkCount} stuck={stuck} />);
  expect(screen.getByText(text)).toBeInTheDocument();
});

function mockSpace(role: "admin" | "editor" | "viewer", docs = [makeDoc(), makeDoc({ id: 11, title: "VPN Setup", updated_by_email: null, index_status: "pending", chunk_count: 0 })]) {
  server.use(
    http.get("*/api/spaces", () => HttpResponse.json([makeSpace({ role })])),
    http.get("*/api/spaces/1/documents", () => HttpResponse.json(docs)),
  );
}

test("lists documents with editor, time and index status", async () => {
  mockSpace("admin");
  renderWithClient(<SpaceDocuments spaceId={1} />);
  expect(await screen.findByRole("heading", { name: "Support" })).toBeInTheDocument();
  const first = screen.getByRole("link", { name: /Refund Policy/ });
  expect(first).toHaveAttribute("href", "/s/1/d/10");
  expect(within(first).getByText(/by alice@example.com/)).toBeInTheDocument();
  expect(within(first).getByText("Indexed ✓ · 2 chunks")).toBeInTheDocument();
  const second = screen.getByRole("link", { name: /VPN Setup/ });
  expect(within(second).queryByText(/ by /)).not.toBeInTheDocument();
  expect(within(second).getByText("Indexing…")).toBeInTheDocument();
});

test("editors and admins can create and upload", async () => {
  mockSpace("editor");
  renderWithClient(<SpaceDocuments spaceId={1} />);
  expect(await screen.findByRole("link", { name: "New document" })).toHaveAttribute("href", "/s/1/d/new");
  expect(screen.getByLabelText("Upload files")).toBeInTheDocument();
});

test("viewers see the list but no editing controls", async () => {
  mockSpace("viewer");
  renderWithClient(<SpaceDocuments spaceId={1} />);
  await screen.findByRole("link", { name: /Refund Policy/ });
  expect(screen.queryByRole("link", { name: "New document" })).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Upload files")).not.toBeInTheDocument();
  expect(screen.getByText("viewer")).toBeInTheDocument();
});

test("an empty space says so", async () => {
  mockSpace("admin", []);
  renderWithClient(<SpaceDocuments spaceId={1} />);
  expect(await screen.findByText(/no documents yet/i)).toBeInTheDocument();
});

test("a space the user is not in looks like a missing space", async () => {
  server.use(
    http.get("*/api/spaces", () => HttpResponse.json([makeSpace({ id: 2 })])),
    http.get("*/api/spaces/1/documents", () => HttpResponse.json({ detail: "not found" }, { status: 404 })),
  );
  renderWithClient(<SpaceDocuments spaceId={1} />);
  expect(await screen.findByRole("alert")).toHaveTextContent(/space not found/i);
});

test("uploading posts the file as multipart and confirms", async () => {
  mockSpace("admin");
  let type: string | null = null;
  let hasFile = false;
  server.use(
    http.post("*/api/spaces/1/documents/upload", async ({ request }) => {
      type = request.headers.get("content-type");
      hasFile = (await request.formData()).get("file") !== null;
      return HttpResponse.json(makeDoc({ id: 12, title: "vpn" }), { status: 201 });
    }),
  );
  renderWithClient(<SpaceDocuments spaceId={1} />);
  const input = await screen.findByLabelText("Upload files");
  await userEvent.upload(input, new File(["# VPN\nInstall it."], "vpn.md", { type: "text/markdown" }));
  await waitFor(() => expect(hasFile).toBe(true));
  expect(type).toMatch(/^multipart\/form-data/);
  expect(await screen.findByText(/uploaded/i)).toBeInTheDocument();
});

test("an upload the server rejects shows its message", async () => {
  mockSpace("admin");
  server.use(
    http.post("*/api/spaces/1/documents/upload", () =>
      HttpResponse.json({ detail: "PDF has no extractable text (scanned?)" }, { status: 400 }),
    ),
  );
  renderWithClient(<SpaceDocuments spaceId={1} />);
  await userEvent.upload(await screen.findByLabelText("Upload files"), new File(["x"], "scan.pdf", { type: "application/pdf" }));
  expect(await screen.findByText(/no extractable text/i)).toBeInTheDocument();
});

test("every member sees Members; only admins see Analytics", async () => {
  mockSpace("viewer");
  const { unmount } = renderWithClient(<SpaceDocuments spaceId={1} />);
  expect(await screen.findByRole("link", { name: "Members" })).toHaveAttribute("href", "/s/1/members");
  expect(screen.queryByRole("link", { name: "Analytics" })).not.toBeInTheDocument();
  unmount();

  mockSpace("admin");
  renderWithClient(<SpaceDocuments spaceId={1} />);
  expect(await screen.findByRole("link", { name: "Analytics" })).toHaveAttribute("href", "/s/1/analytics");
  expect(screen.getByRole("link", { name: "Members" })).toBeInTheDocument();
});
