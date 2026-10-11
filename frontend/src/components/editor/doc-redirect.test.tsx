import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { makeDoc } from "@/test/fixtures";
import { resetNav, router } from "@/test/nav";
import { renderWithClient } from "@/test/render";
import { server, setupMockServer } from "@/test/server";
import { DocRedirect } from "./doc-redirect";

vi.mock("next/navigation", async () => (await import("@/test/nav")).navigationMock);

setupMockServer();
beforeEach(resetNav);

test("redirects to the document inside its space", async () => {
  server.use(http.get("*/api/documents/5", () => HttpResponse.json(makeDoc({ id: 5, space_id: 3 }))));
  renderWithClient(<DocRedirect docId={5} />);
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/s/3/d/5"));
});

test("a document the user cannot see shows the not found state", async () => {
  server.use(http.get("*/api/documents/5", () => HttpResponse.json({ detail: "not found" }, { status: 404 })));
  renderWithClient(<DocRedirect docId={5} />);
  expect(await screen.findByRole("alert")).toHaveTextContent(/document not found/i);
  expect(router.replace).not.toHaveBeenCalled();
});
