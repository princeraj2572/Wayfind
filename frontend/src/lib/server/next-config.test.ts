// @vitest-environment node
import { expect, test } from "vitest";
import nextConfig from "../../../next.config";

test("every route gets the security headers", async () => {
  const rules = await nextConfig.headers!();
  const rule = rules.find((r) => r.source === "/(.*)");
  const map = Object.fromEntries((rule?.headers ?? []).map((h) => [h.key, h.value]));
  expect(map).toEqual({
    "X-Frame-Options": "DENY",
    "Content-Security-Policy": "frame-ancestors 'none'",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
  });
});
