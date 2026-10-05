import { timeAgo } from "./time";

const now = new Date("2026-09-25T12:00:00Z");
const ago = (ms: number) => new Date(now.getTime() - ms);
const S = 1000, M = 60 * S, H = 60 * M, D = 24 * H;

test.each([
  [10 * S, "just now"],
  [44 * S, "just now"],
  [45 * S, "1 minute ago"],
  [5 * M, "5 minutes ago"],
  [59 * M, "59 minutes ago"],
  [1 * H, "1 hour ago"],
  [23 * H, "23 hours ago"],
  [1 * D, "1 day ago"],
  [29 * D, "29 days ago"],
  [30 * D, "1 month ago"],
  [330 * D, "11 months ago"],
  [400 * D, "1 year ago"],
  [800 * D, "2 years ago"],
])("%i ms ago reads %s", (ms, expected) => {
  expect(timeAgo(ago(ms), now)).toBe(expected);
});

test("accepts ISO strings", () => {
  expect(timeAgo("2026-09-25T11:00:00Z", now)).toBe("1 hour ago");
});

test("a time in the future reads just now", () => {
  expect(timeAgo(new Date(now.getTime() + 5 * M), now)).toBe("just now");
});

test("an invalid date reads as empty", () => {
  expect(timeAgo("not a date", now)).toBe("");
});
