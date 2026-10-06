import { snippet } from "./text";

test("collapses whitespace and strips markdown heading marks", () => {
  expect(snippet("# Refund Policy\n\nWithin   30 days.\n## Enterprise\n60 days.")).toBe(
    "Refund Policy Within 30 days. Enterprise 60 days.",
  );
});

test("truncates with an ellipsis at the limit", () => {
  const out = snippet("word ".repeat(100), 20);
  expect(out.length).toBeLessThanOrEqual(21);
  expect(out.endsWith("…")).toBe(true);
});

test("short text is unchanged", () => {
  expect(snippet("Short.")).toBe("Short.");
});
