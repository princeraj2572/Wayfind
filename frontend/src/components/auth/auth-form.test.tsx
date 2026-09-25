import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { nav, resetNav, router } from "@/test/nav";
import { server, setupMockServer } from "@/test/server";
import { AuthForm } from "./auth-form";

vi.mock("next/navigation", async () => (await import("@/test/nav")).navigationMock);

setupMockServer();
beforeEach(resetNav);

async function fill(email: string, password: string) {
  await userEvent.type(screen.getByLabelText("Email"), email);
  await userEvent.type(screen.getByLabelText("Password"), password);
}

test("signing in posts credentials and goes to the ask page", async () => {
  let body: unknown;
  server.use(
    http.post("*/api/auth/login", async ({ request }) => {
      body = await request.json();
      return HttpResponse.json({ user: { id: 1, email: "a@b.co" } });
    }),
  );
  render(<AuthForm mode="login" />);
  await fill("a@b.co", "password123");
  await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/ask"));
  expect(body).toEqual({ email: "a@b.co", password: "password123" });
  expect(router.refresh).toHaveBeenCalled();
});

test("honors a safe next path", async () => {
  nav.search = "next=%2Fs%2F3";
  server.use(http.post("*/api/auth/login", () => HttpResponse.json({ user: { id: 1, email: "a@b.co" } })));
  render(<AuthForm mode="login" />);
  await fill("a@b.co", "password123");
  await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/s/3"));
});

test("ignores an unsafe next path", async () => {
  nav.search = "next=%2F%2Fevil.example";
  server.use(http.post("*/api/auth/login", () => HttpResponse.json({ user: { id: 1, email: "a@b.co" } })));
  render(<AuthForm mode="login" />);
  await fill("a@b.co", "password123");
  await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/ask"));
});

test("shows the server error and lets the user retry", async () => {
  server.use(
    http.post("*/api/auth/login", () => HttpResponse.json({ detail: "invalid email or password" }, { status: 401 })),
  );
  render(<AuthForm mode="login" />);
  await fill("a@b.co", "wrongpass1");
  await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("invalid email or password");
  expect(router.replace).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
});

test("registering enforces the password length without calling the server", async () => {
  render(<AuthForm mode="register" />);
  await fill("a@b.co", "short");
  await userEvent.click(screen.getByRole("button", { name: "Create account" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(/at least 8 characters/i);
});

test("registering posts to the register endpoint", async () => {
  server.use(http.post("*/api/auth/register", () => HttpResponse.json({ user: { id: 2, email: "n@b.co" } }, { status: 201 })));
  render(<AuthForm mode="register" />);
  await fill("n@b.co", "password123");
  await userEvent.click(screen.getByRole("button", { name: "Create account" }));
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/ask"));
});

test("a duplicate email shows the API message", async () => {
  server.use(http.post("*/api/auth/register", () => HttpResponse.json({ detail: "email already registered" }, { status: 409 })));
  render(<AuthForm mode="register" />);
  await fill("n@b.co", "password123");
  await userEvent.click(screen.getByRole("button", { name: "Create account" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("email already registered");
});

test("links to the other page and keeps the next parameter", () => {
  nav.search = "next=%2Fs%2F3";
  render(<AuthForm mode="login" />);
  expect(screen.getByRole("link", { name: "Create one" })).toHaveAttribute("href", "/register?next=%2Fs%2F3");
});
