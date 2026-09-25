import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import type { Member, Role } from "@/lib/types";
import { makeMember, makeSpace } from "@/test/fixtures";
import { resetNav, router } from "@/test/nav";
import { renderWithClient } from "@/test/render";
import { server, setupMockServer } from "@/test/server";
import { MembersView } from "./members-view";

vi.mock("next/navigation", async () => (await import("@/test/nav")).navigationMock);

setupMockServer();
beforeEach(resetNav);

const alice = makeMember();
const bob = makeMember({ user_id: 2, email: "bob@example.com", role: "editor" });

function mockApi(role: Role = "admin", initial: Member[] = [alice, bob]) {
  const state = { members: [...initial] };
  server.use(
    http.get("*/api/spaces", () => HttpResponse.json([makeSpace({ role })])),
    http.get("*/api/auth/me", () => HttpResponse.json({ id: 1, email: "alice@example.com" })),
    http.get("*/api/spaces/1/members", () => HttpResponse.json(state.members)),
  );
  return state;
}

async function renderReady() {
  renderWithClient(<MembersView spaceId={1} />);
  return within(await screen.findByRole("list", { name: "Members" }));
}

test("lists every member with their role and marks you", async () => {
  mockApi();
  const list = await renderReady();
  const rows = list.getAllByRole("listitem");
  expect(rows).toHaveLength(2);
  expect(within(rows[0]).getByText("alice@example.com")).toBeInTheDocument();
  expect(within(rows[0]).getByText("You")).toBeInTheDocument();
  expect(within(rows[1]).queryByText("You")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Role for bob@example.com")).toHaveValue("editor");
});

test("a viewer sees the list but no management controls", async () => {
  mockApi("viewer");
  const list = await renderReady();
  expect(list.getByText("editor")).toBeInTheDocument();
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /remove/i })).not.toBeInTheDocument();
  expect(screen.queryByRole("form", { name: "Add member" })).not.toBeInTheDocument();
});

test("an admin adds a member by email and the list refreshes", async () => {
  const state = mockApi();
  let body: unknown;
  server.use(
    http.put("*/api/spaces/1/members", async ({ request }) => {
      body = await request.json();
      state.members.push(makeMember({ user_id: 3, email: "carol@example.com", role: "viewer" }));
      return HttpResponse.json({ user_id: 3, email: "carol@example.com", role: "viewer" });
    }),
  );
  const list = await renderReady();
  await userEvent.type(screen.getByLabelText("Email"), " Carol@Example.com ");
  await userEvent.selectOptions(screen.getByLabelText("Role"), "viewer");
  await userEvent.click(screen.getByRole("button", { name: "Add member" }));
  expect(await list.findByText("carol@example.com")).toBeInTheDocument();
  expect(body).toEqual({ email: "Carol@Example.com", role: "viewer" });
  expect(screen.getByLabelText("Email")).toHaveValue("");
});

test("adding an unknown email explains that the person must register first", async () => {
  mockApi();
  server.use(http.put("*/api/spaces/1/members", () => HttpResponse.json({ detail: "user not found" }, { status: 404 })));
  await renderReady();
  await userEvent.type(screen.getByLabelText("Email"), "ghost@example.com");
  await userEvent.click(screen.getByRole("button", { name: "Add member" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(/no account with that email/i);
});

test("changing a role sends the member's email and the new role", async () => {
  const state = mockApi();
  let body: unknown;
  server.use(
    http.put("*/api/spaces/1/members", async ({ request }) => {
      body = await request.json();
      state.members[1] = { ...bob, role: "admin" };
      return HttpResponse.json({ user_id: 2, email: "bob@example.com", role: "admin" });
    }),
  );
  await renderReady();
  await userEvent.selectOptions(screen.getByLabelText("Role for bob@example.com"), "admin");
  await waitFor(() => expect(body).toEqual({ email: "bob@example.com", role: "admin" }));
  await waitFor(() => expect(screen.getByLabelText("Role for bob@example.com")).toHaveValue("admin"));
});

test("demoting the last admin shows the server message and keeps the role", async () => {
  mockApi("admin", [alice]);
  server.use(
    http.put("*/api/spaces/1/members", () =>
      HttpResponse.json({ detail: "a space must keep at least one admin" }, { status: 409 }),
    ),
  );
  await renderReady();
  await userEvent.selectOptions(screen.getByLabelText("Role for alice@example.com"), "viewer");
  await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Change role" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("a space must keep at least one admin");
  expect(screen.getByLabelText("Role for alice@example.com")).toHaveValue("admin");
});

test("removing another member asks for confirmation, then deletes them", async () => {
  const state = mockApi();
  let deleted = "";
  server.use(
    http.delete("*/api/spaces/1/members/2", ({ request }) => {
      deleted = new URL(request.url).pathname;
      state.members = [alice];
      return new HttpResponse(null, { status: 204 });
    }),
  );
  const list = await renderReady();
  await userEvent.click(screen.getByRole("button", { name: "Remove bob@example.com" }));
  const dialog = await screen.findByRole("dialog", { name: "Remove bob@example.com?" });
  expect(dialog).toHaveTextContent(/they will lose access/i);
  await userEvent.click(within(dialog).getByRole("button", { name: "Remove" }));
  await waitFor(() => expect(list.queryByText("bob@example.com")).not.toBeInTheDocument());
  expect(deleted).toBe("/api/spaces/1/members/2");
  expect(router.replace).not.toHaveBeenCalled();
});

test("cancelling the confirmation deletes nothing", async () => {
  mockApi(); // an unmocked DELETE would fail the test (onUnhandledRequest: error)
  await renderReady();
  await userEvent.click(screen.getByRole("button", { name: "Remove bob@example.com" }));
  await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Cancel" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
});

test("removing the last admin keeps the dialog open with the server message", async () => {
  mockApi("admin", [alice]);
  server.use(
    http.delete("*/api/spaces/1/members/1", () =>
      HttpResponse.json({ detail: "a space must keep at least one admin" }, { status: 409 }),
    ),
  );
  await renderReady();
  await userEvent.click(screen.getByRole("button", { name: "Remove alice@example.com" }));
  const dialog = await screen.findByRole("dialog");
  await userEvent.click(within(dialog).getByRole("button", { name: "Remove" }));
  expect(await within(dialog).findByRole("alert")).toHaveTextContent("a space must keep at least one admin");
  expect(router.replace).not.toHaveBeenCalled();
});

test("removing yourself warns about losing access and leaves for Ask without an error flash", async () => {
  const state = mockApi();
  server.use(
    http.delete("*/api/spaces/1/members/1", () => {
      // After removal the space is gone for this user: members answers 404.
      server.use(http.get("*/api/spaces/1/members", () => HttpResponse.json({ detail: "space not found" }, { status: 404 })));
      state.members = [bob];
      return new HttpResponse(null, { status: 204 });
    }),
  );
  await renderReady();
  await userEvent.click(screen.getByRole("button", { name: "Remove alice@example.com" }));
  const dialog = await screen.findByRole("dialog");
  expect(dialog).toHaveTextContent(/you will lose access/i);
  await userEvent.click(within(dialog).getByRole("button", { name: "Remove" }));
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/ask"));
  await new Promise((r) => setTimeout(r, 50));
  expect(screen.queryByText(/couldn.t load members/i)).not.toBeInTheDocument();
});

test("a space you cannot see says so", async () => {
  server.use(
    http.get("*/api/spaces", () => HttpResponse.json([])),
    http.get("*/api/auth/me", () => HttpResponse.json({ id: 1, email: "alice@example.com" })),
    http.get("*/api/spaces/1/members", () => HttpResponse.json({ detail: "space not found" }, { status: 404 })),
  );
  renderWithClient(<MembersView spaceId={1} />);
  expect(await screen.findByText("Space not found")).toBeInTheDocument();
});

test("emails are shown as text, never as markup", async () => {
  mockApi("admin", [alice, makeMember({ user_id: 5, email: "<img src=x onerror=alert(1)>@example.com", role: "viewer" })]);
  const list = await renderReady();
  expect(list.getByText("<img src=x onerror=alert(1)>@example.com")).toBeInTheDocument();
  expect(document.querySelector("img[src='x']")).toBeNull();
});

test("demoting yourself asks first and sends nothing until you confirm", async () => {
  const state = mockApi();
  let body: unknown = null;
  server.use(
    http.put("*/api/spaces/1/members", async ({ request }) => {
      body = await request.json();
      state.members[0] = { ...alice, role: "viewer" };
      return HttpResponse.json({ user_id: 1, email: "alice@example.com", role: "viewer" });
    }),
  );
  await renderReady();
  await userEvent.selectOptions(screen.getByLabelText("Role for alice@example.com"), "viewer");
  const dialog = await screen.findByRole("dialog", { name: "Change your own role?" });
  expect(dialog).toHaveTextContent(/lose the ability to manage/i);
  expect(body).toBeNull();
  await userEvent.click(within(dialog).getByRole("button", { name: "Change role" }));
  await waitFor(() => expect(body).toEqual({ email: "alice@example.com", role: "viewer" }));
});

test("cancelling a self-demotion changes nothing", async () => {
  mockApi(); // an unmocked PUT would fail the test
  await renderReady();
  await userEvent.selectOptions(screen.getByLabelText("Role for alice@example.com"), "editor");
  await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Cancel" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(screen.getByLabelText("Role for alice@example.com")).toHaveValue("admin");
});

test("the list waits for your identity so removing yourself is always recognised", async () => {
  server.use(
    http.get("*/api/spaces", () => HttpResponse.json([makeSpace()])),
    http.get("*/api/auth/me", async () => {
      await delay("infinite");
      return HttpResponse.json({ id: 1, email: "alice@example.com" });
    }),
    http.get("*/api/spaces/1/members", () => HttpResponse.json([alice, bob])),
  );
  renderWithClient(<MembersView spaceId={1} />);
  await new Promise((r) => setTimeout(r, 100));
  expect(screen.queryByRole("list", { name: "Members" })).not.toBeInTheDocument();
});
