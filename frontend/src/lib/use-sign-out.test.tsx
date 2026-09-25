import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { useUnsavedGuard } from "@/components/editor/use-unsaved-guard";
import { resetNav, router } from "@/test/nav";
import { renderWithClient } from "@/test/render";
import { server, setupMockServer } from "@/test/server";
import { useSignOut } from "./use-sign-out";

vi.mock("next/navigation", async () => (await import("@/test/nav")).navigationMock);

setupMockServer();
beforeEach(resetNav);
afterEach(() => vi.restoreAllMocks());

function Probe({ dirty }: { dirty: boolean }) {
  useUnsavedGuard(dirty);
  const signOut = useSignOut();
  return <button onClick={() => void signOut()}>Sign out</button>;
}

function mockLogout() {
  const state = { called: false };
  server.use(
    http.post("*/api/auth/logout", () => {
      state.called = true;
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return state;
}

test("signing out with unsaved changes asks first and stays put when declined", async () => {
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  const logout = mockLogout();
  renderWithClient(<Probe dirty />);
  await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
  expect(confirm).toHaveBeenCalledTimes(1);
  expect(logout.called).toBe(false);
  expect(router.replace).not.toHaveBeenCalled();
});

test("signing out with unsaved changes proceeds when confirmed", async () => {
  vi.spyOn(window, "confirm").mockReturnValue(true);
  const logout = mockLogout();
  renderWithClient(<Probe dirty />);
  await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/login"));
  expect(logout.called).toBe(true);
});

test("signing out without unsaved changes never asks", async () => {
  const confirm = vi.spyOn(window, "confirm");
  mockLogout();
  renderWithClient(<Probe dirty={false} />);
  await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/login"));
  expect(confirm).not.toHaveBeenCalled();
});
