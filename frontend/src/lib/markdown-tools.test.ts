import { bold, bulletList, heading, inlineCode, italic, link, numberedList, wrapSelection } from "./markdown-tools";

test("wrapping an empty selection inserts a placeholder and selects it", () => {
  expect(bold("hello ", 6, 6)).toEqual({ text: "hello **text**", start: 8, end: 12 });
});

test("wrapping a selection keeps it selected inside the markers", () => {
  expect(bold("say hello now", 4, 9)).toEqual({ text: "say **hello** now", start: 6, end: 11 });
});

test("italic and inline code use their own markers", () => {
  expect(italic("a", 0, 1).text).toBe("_a_");
  expect(inlineCode("a", 0, 1).text).toBe("`a`");
});

test("link wraps the text and leaves a url placeholder", () => {
  expect(link("see docs", 4, 8)).toEqual({ text: "see [docs](https://)", start: 5, end: 9 });
});

test("wrapSelection supports different before and after markers", () => {
  expect(wrapSelection("x", 0, 1, "<", ">", "y").text).toBe("<x>");
});

test("heading prefixes the current line only", () => {
  expect(heading("one\ntwo\nthree", 4, 7, 2)).toEqual({ text: "one\n## two\nthree", start: 4, end: 10 });
});

test("heading replaces an existing heading level", () => {
  expect(heading("# Title", 2, 2, 3).text).toBe("### Title");
});

test("a selection ending right after a newline does not include the next line", () => {
  expect(bulletList("one\ntwo\nthree", 0, 4).text).toBe("- one\ntwo\nthree");
});

test("bullet list prefixes every selected line and skips blank ones", () => {
  const text = "one\n\ntwo";
  expect(bulletList(text, 0, text.length).text).toBe("- one\n\n- two");
});

test("numbered list numbers only non-blank lines", () => {
  const text = "a\nb\n\nc";
  expect(numberedList(text, 0, text.length).text).toBe("1. a\n2. b\n\n3. c");
});

test("switching list type replaces the old marker", () => {
  expect(numberedList("- a\n- b", 0, 7).text).toBe("1. a\n2. b");
  expect(bulletList("1. a\n2. b", 0, 9).text).toBe("- a\n- b");
});

test("cursor on an empty first line still finds the right line", () => {
  expect(heading("\nbody", 0, 0, 1).text).toBe("# \nbody");
});

test("a line without a trailing newline at the end of the text", () => {
  expect(bulletList("only", 4, 4).text).toBe("- only");
});
