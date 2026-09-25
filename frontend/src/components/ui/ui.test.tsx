import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Badge } from "./badge";
import { Button } from "./button";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "./dialog";
import { ErrorState } from "./error-state";
import { Input } from "./input";

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
