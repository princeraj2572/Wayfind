import userEvent from "@testing-library/user-event";
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

test("a server error is not reported as not found and can be retried", async () => {
  let calls = 0;
  server.use(
    http.get("*/api/documents/5", () => {
      calls += 1;
      return calls === 1
        ? HttpResponse.json({ detail: "boom" }, { status: 500 })
        : HttpResponse.json(makeDoc({ id: 5, space_id: 3 }));
    }),
  );
  renderWithClient(<DocRedirect docId={5} />);
  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent("Couldn't load this document");
  expect(alert).not.toHaveTextContent(/not found/i);
  await userEvent.click(screen.getByRole("button", { name: "Retry" }));
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/s/3/d/5"));
});
