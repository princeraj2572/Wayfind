import { safeNext } from "./safe-next";

test.each(["/ask", "/s/3", "/s/3/d/7?x=1", "/d/9"])("keeps the same-site path %s", (p) => {
  expect(safeNext(p)).toBe(p);
});

test.each([
  null,
  undefined,
  "",
  "ask",
  "//evil.example",
  "https://evil.example",
  "/\\evil.example",
  "/\t/evil.example",
  "/ask\nSet-Cookie: x=1",
  "javascript:alert(1)",
])("rejects %j", (p) => {
  expect(safeNext(p as string | null | undefined)).toBeNull();
});
