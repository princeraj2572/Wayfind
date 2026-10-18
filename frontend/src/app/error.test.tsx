import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ErrorBoundary from "./error";

test("the app error page explains, offers Try again and a way back", async () => {
  const reset = vi.fn();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  render(<ErrorBoundary error={new Error("kaboom")} reset={reset} />);
  expect(screen.getByRole("heading", { name: "Something went wrong" })).toBeInTheDocument();
  expect(screen.queryByText("kaboom")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(reset).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("link", { name: "Back to Ask" })).toHaveAttribute("href", "/ask");
});
