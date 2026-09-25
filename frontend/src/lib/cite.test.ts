import { splitCitations } from "./cite";

test("plain text has no citations", () => {
  expect(splitCitations("Just text.", 3)).toEqual([{ kind: "text", text: "Just text." }]);
});

test("splits text around valid citations", () => {
  expect(splitCitations("Refunds take 5 days [1]. Enterprise gets 60 [2].", 2)).toEqual([
    { kind: "text", text: "Refunds take 5 days " },
    { kind: "cite", n: 1 },
    { kind: "text", text: ". Enterprise gets 60 " },
    { kind: "cite", n: 2 },
    { kind: "text", text: "." },
  ]);
});

test("adjacent citations", () => {
  expect(splitCitations("a[1][2]", 2)).toEqual([
    { kind: "text", text: "a" },
    { kind: "cite", n: 1 },
    { kind: "cite", n: 2 },
  ]);
});

test("out-of-range and zero citations stay as text and merge with neighbours", () => {
  expect(splitCitations("see [9] and [1] or [0]", 2)).toEqual([
    { kind: "text", text: "see [9] and " },
    { kind: "cite", n: 1 },
    { kind: "text", text: " or [0]" },
  ]);
});

test("with no sources everything is text", () => {
  expect(splitCitations("claim [1]", 0)).toEqual([{ kind: "text", text: "claim [1]" }]);
});

test("empty answer gives no parts", () => {
  expect(splitCitations("", 3)).toEqual([]);
});

test("decimals and words in brackets are not citations", () => {
  expect(splitCitations("[1.5] [a] [ 1 ]", 3)).toEqual([{ kind: "text", text: "[1.5] [a] [ 1 ]" }]);
});
