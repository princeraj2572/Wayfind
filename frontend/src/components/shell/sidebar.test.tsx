import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { makeSpace } from "@/test/fixtures";
import { nav, resetNav, router } from "@/test/nav";
import { renderWithClient } from "@/test/render";
import { server, setupMockServer } from "@/test/server";
import { Sidebar } from "./sidebar";

vi.mock("next/navigation", async () => (await import("@/test/nav")).navigationMock);

setupMockServer();
beforeEach(resetNav);

function mockApi(spaces = [makeSpace(), makeSpace({ id: 2, name: "Engineering", role: "viewer" })]) {
  server.use(
    http.get("*/api/spaces", () => HttpResponse.json(spaces)),
    http.get("*/api/auth/me", () => HttpResponse.json({ id: 1, email: "alice@example.com" })),
  );
}

test("lists the user's spaces with their roles", async () => {
  mockApi();
  renderWithClient(<Sidebar />);
  const list = await screen.findByRole("list", { name: "Spaces" });
  const links = within(list).getAllByRole("link");
  expect(links).toHaveLength(2);
  expect(links[0]).toHaveTextContent("Support");
  expect(links[0]).toHaveTextContent("admin");
  expect(links[0]).toHaveAttribute("href", "/s/1");
  expect(links[1]).toHaveTextContent("Engineering");
  expect(links[1]).toHaveTextContent("viewer");
});

test("marks the current space", async () => {
  nav.pathname = "/s/2/d/5";
  mockApi();
  renderWithClient(<Sidebar />);
  const list = await screen.findByRole("list", { name: "Spaces" });
  expect(within(list).getByRole("link", { name: /Engineering/ })).toHaveAttribute("aria-current", "page");
  expect(within(list).getByRole("link", { name: /Support/ })).not.toHaveAttribute("aria-current");
});

test("Ask is active on the ask page and Analytics is disabled until an admin space is open", async () => {
  mockApi();
  renderWithClient(<Sidebar />);
  expect(await screen.findByRole("link", { name: "Ask" })).toHaveAttribute("aria-current", "page");
  expect(screen.getByText("Analytics").closest("[aria-disabled]")).toHaveAttribute("aria-disabled", "true");
  expect(screen.getByText("Analytics").closest("[aria-disabled]")).toHaveAttribute("title", "Admins only");
  expect(screen.queryByRole("link", { name: /Analytics/ })).not.toBeInTheDocument();
});

test("Documents links to the first space when none is open", async () => {
  mockApi();
  renderWithClient(<Sidebar />);
  await waitFor(() => expect(screen.getByRole("link", { name: "Documents" })).toHaveAttribute("href", "/s/1"));
});

test("with no spaces the list explains what to do and Documents is disabled", async () => {
  mockApi([]);
  renderWithClient(<Sidebar />);
  expect(await screen.findByText(/no spaces yet/i)).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Documents" })).not.toBeInTheDocument();
});

test("creating a space posts the name and opens it", async () => {
  mockApi([]);
  let body: unknown;
  server.use(
    http.post("*/api/spaces", async ({ request }) => {
      body = await request.json();
      return HttpResponse.json({ id: 7, name: "Handbook", role: "admin" }, { status: 201 });
    }),
  );
  renderWithClient(<Sidebar />);
  await userEvent.click(await screen.findByRole("button", { name: "+ New space" }));
  await userEvent.type(await screen.findByLabelText("Space name"), "Handbook");
  await userEvent.click(screen.getByRole("button", { name: "Create space" }));
  await waitFor(() => expect(router.push).toHaveBeenCalledWith("/s/7"));
  expect(body).toEqual({ name: "Handbook" });
});

test("a failed space creation shows the message and keeps the dialog open", async () => {
  mockApi([]);
  server.use(http.post("*/api/spaces", () => HttpResponse.json({ detail: "Value error, name must not be blank" }, { status: 422 })));
  renderWithClient(<Sidebar />);
  await userEvent.click(await screen.findByRole("button", { name: "+ New space" }));
  await userEvent.type(await screen.findByLabelText("Space name"), "x");
  await userEvent.click(screen.getByRole("button", { name: "Create space" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("name must not be blank");
  expect(router.push).not.toHaveBeenCalled();
});

test("the account menu shows the email and signs out", async () => {
  mockApi();
  let loggedOut = false;
  server.use(
    http.post("*/api/auth/logout", () => {
      loggedOut = true;
      return new HttpResponse(null, { status: 204 });
    }),
  );
  renderWithClient(<Sidebar />);
  const trigger = await screen.findByRole("button", { name: /account menu/i });
  await waitFor(() => expect(trigger).toHaveTextContent("alice@example.com"));
  await userEvent.click(trigger);
  await userEvent.click(await screen.findByRole("menuitem", { name: "Sign out" }));
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/login"));
  expect(loggedOut).toBe(true);
});

test("Documents links to the open space immediately while spaces are still loading", async () => {
  nav.pathname = "/s/2";
  server.use(
    http.get("*/api/spaces", async () => {
      await delay("infinite");
      return HttpResponse.json([]);
    }),
    http.get("*/api/auth/me", () => HttpResponse.json({ id: 1, email: "alice@example.com" })),
  );
  renderWithClient(<Sidebar />);
  expect(screen.getByRole("link", { name: "Documents" })).toHaveAttribute("href", "/s/2");
});

test("while spaces load and none is open, Documents shows a skeleton instead of a disabled item", async () => {
  server.use(
    http.get("*/api/spaces", async () => {
      await delay("infinite");
      return HttpResponse.json([]);
    }),
    http.get("*/api/auth/me", () => HttpResponse.json({ id: 1, email: "alice@example.com" })),
  );
  renderWithClient(<Sidebar />);
  expect(screen.queryByText("Documents")).not.toBeInTheDocument();
});

test("a space creation error is cleared when the dialog is closed and reopened", async () => {
  mockApi([]);
  server.use(http.post("*/api/spaces", () => HttpResponse.json({ detail: "nope" }, { status: 422 })));
  renderWithClient(<Sidebar />);
  await userEvent.click(await screen.findByRole("button", { name: "+ New space" }));
  await userEvent.type(await screen.findByLabelText("Space name"), "x");
  await userEvent.click(screen.getByRole("button", { name: "Create space" }));
  expect(await screen.findByRole("alert")).toBeInTheDocument();
  await userEvent.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  await userEvent.click(screen.getByRole("button", { name: "+ New space" }));
  await screen.findByRole("dialog");
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

test("Analytics links to the open space when the user is its admin", async () => {
  nav.pathname = "/s/1";
  mockApi();
  renderWithClient(<Sidebar />);
  expect(await screen.findByRole("link", { name: "Analytics" })).toHaveAttribute("href", "/s/1/analytics");
});

test("Analytics stays disabled in a space where the user is not an admin", async () => {
  nav.pathname = "/s/2";
  mockApi();
  renderWithClient(<Sidebar />);
  await screen.findByRole("list", { name: "Spaces" });
  expect(screen.queryByRole("link", { name: "Analytics" })).not.toBeInTheDocument();
  expect(screen.getByText("Analytics").closest("[aria-disabled]")).toHaveAttribute("title", "Admins only");
});

test("on the analytics page Analytics is the current item and Documents is not", async () => {
  nav.pathname = "/s/1/analytics";
  mockApi();
  renderWithClient(<Sidebar />);
  expect(await screen.findByRole("link", { name: "Analytics" })).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("link", { name: "Documents" })).not.toHaveAttribute("aria-current");
});
