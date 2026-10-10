import { fireEvent, render } from "@testing-library/react";
import { useUnsavedGuard } from "./use-unsaved-guard";

function Probe({ dirty }: { dirty: boolean }) {
  useUnsavedGuard(dirty);
  return (
    <div>
      <a href="/elsewhere">internal</a>
      <a href="https://example.com">external</a>
      <a href="/new-tab" target="_blank">new tab</a>
    </div>
  );
}

afterEach(() => vi.restoreAllMocks());

test("does nothing when there are no unsaved changes", () => {
  const confirm = vi.spyOn(window, "confirm");
  const { getByText } = render(<Probe dirty={false} />);
  expect(fireEvent.click(getByText("internal"))).toBe(true);
  expect(confirm).not.toHaveBeenCalled();
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(false);
});

test("asks before following an internal link and cancels when declined", () => {
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  const { getByText } = render(<Probe dirty />);
  expect(fireEvent.click(getByText("internal"))).toBe(false);
  expect(confirm).toHaveBeenCalledTimes(1);
});

test("lets the navigation continue when the user confirms", () => {
  vi.spyOn(window, "confirm").mockReturnValue(true);
  const { getByText } = render(<Probe dirty />);
  expect(fireEvent.click(getByText("internal"))).toBe(true);
});

test("ignores external links, new-tab links and modified clicks", () => {
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  const { getByText } = render(<Probe dirty />);
  expect(fireEvent.click(getByText("external"))).toBe(true);
  expect(fireEvent.click(getByText("new tab"))).toBe(true);
  expect(fireEvent.click(getByText("internal"), { ctrlKey: true })).toBe(true);
  expect(confirm).not.toHaveBeenCalled();
});

test("warns on tab close or reload while dirty and stops after cleanup", () => {
  const { unmount } = render(<Probe dirty />);
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
  unmount();
  const after = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(after);
  expect(after.defaultPrevented).toBe(false);
});
