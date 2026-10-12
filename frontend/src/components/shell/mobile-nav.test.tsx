import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { makeSpace } from "@/test/fixtures";
import { resetNav, router } from "@/test/nav";
import { renderWithClient } from "@/test/render";
import { server, setupMockServer } from "@/test/server";
import { MobileNav } from "./mobile-nav";

vi.mock("next/navigation", async () => (await import("@/test/nav")).navigationMock);

setupMockServer();
beforeEach(resetNav);

function mockApi() {
  server.use(
    http.get("*/api/spaces", () =>
      HttpResponse.json([makeSpace(), makeSpace({ id: 2, name: "Engineering", role: "viewer" })]),
    ),
  );
}

test("the menu offers Ask, every space and Sign out", async () => {
  mockApi();
  renderWithClient(<MobileNav />);
  await userEvent.click(screen.getByRole("button", { name: "Menu" }));
  expect(await screen.findByRole("menuitem", { name: "Ask" })).toHaveAttribute("href", "/ask");
  expect(await screen.findByRole("menuitem", { name: /Support/ })).toHaveAttribute("href", "/s/1");
  expect(screen.getByRole("menuitem", { name: /Engineering/ })).toHaveAttribute("href", "/s/2");
  expect(screen.getByRole("menuitem", { name: "Sign out" })).toBeInTheDocument();
});

test("with no spaces the menu says so", async () => {
  server.use(http.get("*/api/spaces", () => HttpResponse.json([])));
  renderWithClient(<MobileNav />);
  await userEvent.click(screen.getByRole("button", { name: "Menu" }));
  expect(await screen.findByText("No spaces yet")).toBeInTheDocument();
});

test("Sign out posts to the logout route and returns to the login page", async () => {
  mockApi();
  let loggedOut = false;
  server.use(
    http.post("*/api/auth/logout", () => {
      loggedOut = true;
      return new HttpResponse(null, { status: 204 });
    }),
  );
  renderWithClient(<MobileNav />);
  await userEvent.click(screen.getByRole("button", { name: "Menu" }));
  await userEvent.click(await screen.findByRole("menuitem", { name: "Sign out" }));
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/login"));
  expect(loggedOut).toBe(true);
});
