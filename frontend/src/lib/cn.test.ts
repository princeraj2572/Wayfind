import { cn } from "./cn";

test("joins class names and drops falsy values", () => {
  expect(cn("a", false && "b", undefined, ["c"], { d: true, e: false })).toBe("a c d");
});

test("later Tailwind classes win over earlier conflicting ones", () => {
  expect(cn("px-2 text-sm", "px-4")).toBe("text-sm px-4");
});
