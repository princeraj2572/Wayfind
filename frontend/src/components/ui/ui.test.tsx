import { cleanup, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { Badge } from "./badge";
import { Button } from "./button";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "./dialog";
import { ErrorState } from "./error-state";
import { Input } from "./input";
import { LoadingBlock } from "./skeleton";

test("Button defaults to type=button and applies variants", () => {
  render(<Button variant="outline">Save</Button>);
  const button = screen.getByRole("button", { name: "Save" });
  expect(button).toHaveAttribute("type", "button");
  expect(button.className).toContain("border-line");
});

test("Button asChild renders the child element", () => {
  render(
    <Button asChild>
      <a href="/x">Go</a>
    </Button>,
  );
  expect(screen.getByRole("link", { name: "Go" })).toHaveAttribute("href", "/x");
});

test("Button can be disabled", async () => {
  const onClick = vi.fn();
  render(
    <Button disabled onClick={onClick}>
      Nope
    </Button>,
  );
  await userEvent.click(screen.getByRole("button", { name: "Nope" }));
  expect(onClick).not.toHaveBeenCalled();
});

test("Badge tones map to classes", () => {
  render(<Badge tone="red">Failed</Badge>);
  expect(screen.getByText("Failed").className).toContain("text-danger");
});

test("Input forwards props", () => {
  render(<Input aria-label="Email" defaultValue="a@b.co" />);
  expect(screen.getByLabelText("Email")).toHaveValue("a@b.co");
});

test("Dialog opens with its title and closes", async () => {
  render(
    <Dialog>
      <DialogTrigger>Open it</DialogTrigger>
      <DialogContent title="Hello dialog" description="Some text">
        <DialogClose>Close it</DialogClose>
      </DialogContent>
    </Dialog>,
  );
  expect(screen.queryByText("Hello dialog")).not.toBeInTheDocument();
  await userEvent.click(screen.getByText("Open it"));
  expect(await screen.findByRole("dialog", { name: "Hello dialog" })).toBeInTheDocument();
  await userEvent.click(screen.getByText("Close it"));
  expect(screen.queryByText("Hello dialog")).not.toBeInTheDocument();
});

test("ErrorState shows title, message and a way back", () => {
  render(<ErrorState title="Not found" message="Gone." />);
  expect(screen.getByRole("alert")).toHaveTextContent("Not found");
  expect(screen.getByText("Gone.")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /back to ask/i })).toHaveAttribute("href", "/ask");
});

test("Dialog description is announced, and a dialog without one does not warn", async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  render(
    <Dialog>
      <DialogTrigger>Open with</DialogTrigger>
      <DialogContent title="With text" description="Some text" />
    </Dialog>,
  );
  await userEvent.click(screen.getByText("Open with"));
  expect(await screen.findByRole("dialog", { name: "With text" })).toHaveAccessibleDescription("Some text");
  cleanup();
  render(
    <Dialog>
      <DialogTrigger>Open without</DialogTrigger>
      <DialogContent title="No text" />
    </Dialog>,
  );
  await userEvent.click(screen.getByText("Open without"));
  expect(await screen.findByRole("dialog", { name: "No text" })).toBeInTheDocument();
  expect(warn).not.toHaveBeenCalled();
  warn.mockRestore();
});

test("ErrorState offers Retry only when given a handler, and calls it", async () => {
  const retry = vi.fn();
  const { rerender } = render(<ErrorState title="Couldn't load" />);
  expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  rerender(<ErrorState title="Couldn't load" onRetry={retry} />);
  await userEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(retry).toHaveBeenCalledTimes(1);
});

test("an informational ErrorState is a status, not an alert", () => {
  render(<ErrorState tone="info" title="Read-only access" message="You can read only." />);
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("Read-only access");
});

test("LoadingBlock announces loading as a busy status", () => {
  render(
    <LoadingBlock>
      <div>placeholder</div>
    </LoadingBlock>,
  );
  const block = screen.getByRole("status", { name: "Loading" });
  expect(block).toHaveAttribute("aria-busy", "true");
});
