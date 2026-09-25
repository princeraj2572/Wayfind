import { docKey, hasFreshPending, indexPollDelay } from "./queries";
import { makeDoc } from "@/test/fixtures";

test("polls only while pending and allowed", () => {
  expect(indexPollDelay("pending", true)).toBe(2000);
  expect(indexPollDelay("pending", true, 50)).toBe(50);
  expect(indexPollDelay("pending", false)).toBe(false);
  expect(indexPollDelay("indexed", true)).toBe(false);
  expect(indexPollDelay("failed", true)).toBe(false);
  expect(indexPollDelay(undefined, true)).toBe(false);
});

const now = new Date("2026-09-25T12:00:00Z");

test("a recently updated pending document keeps the list polling", () => {
  const docs = [makeDoc({ index_status: "pending", updated_at: "2026-09-25T11:59:30Z" })];
  expect(hasFreshPending(docs, now)).toBe(true);
});

test("an old pending document does not poll forever", () => {
  const docs = [makeDoc({ index_status: "pending", updated_at: "2026-09-25T10:00:00Z" })];
  expect(hasFreshPending(docs, now)).toBe(false);
});

test("no pending documents means no polling", () => {
  expect(hasFreshPending([makeDoc()], now)).toBe(false);
  expect(hasFreshPending(undefined, now)).toBe(false);
});

test("docKey changes with every save, so a stuck save does not silence the next one", () => {
  const first = makeDoc({ updated_at: "2026-09-25T10:00:00Z" });
  const second = makeDoc({ updated_at: "2026-09-25T10:05:00Z" });
  expect(docKey(first)).toBe("10:2026-09-25T10:00:00Z");
  expect(docKey(second)).not.toBe(docKey(first));
});
