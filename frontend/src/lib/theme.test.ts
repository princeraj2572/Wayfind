import { applyTheme, parsePref, readPref, resolveTheme, THEME_INIT_SCRIPT, THEME_KEY, writePref } from "./theme";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
  delete document.documentElement.dataset.theme;
  document.documentElement.style.colorScheme = "";
});

test.each([
  ["light", "light"],
  ["dark", "dark"],
  ["system", "system"],
  ["purple", "system"],
  [null, "system"],
  [undefined, "system"],
  [42, "system"],
])("parsePref(%j) is %s", (value, expected) => {
  expect(parsePref(value)).toBe(expected);
});

test.each([
  ["light", true, "light"],
  ["light", false, "light"],
  ["dark", false, "dark"],
  ["system", true, "dark"],
  ["system", false, "light"],
] as const)("resolveTheme(%s, prefersDark=%s) is %s", (pref, prefersDark, expected) => {
  expect(resolveTheme(pref, prefersDark)).toBe(expected);
});

test("applyTheme sets the resolved theme and the browser color scheme on <html>", () => {
  applyTheme("dark");
  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(document.documentElement.style.colorScheme).toBe("dark");
  applyTheme("light");
  expect(document.documentElement.dataset.theme).toBe("light");
  expect(document.documentElement.style.colorScheme).toBe("light");
});

test("system follows the operating system preference", () => {
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("dark"), addEventListener() {}, removeEventListener() {} }));
  applyTheme("system");
  expect(document.documentElement.dataset.theme).toBe("dark");
});

test("system falls back to light where matchMedia does not exist", () => {
  applyTheme("system");
  expect(document.documentElement.dataset.theme).toBe("light");
});

test("the preference is stored and read back; garbage in storage means system", () => {
  expect(readPref()).toBe("system");
  writePref("dark");
  expect(localStorage.getItem(THEME_KEY)).toBe("dark");
  expect(readPref()).toBe("dark");
  localStorage.setItem(THEME_KEY, "<script>");
  expect(readPref()).toBe("system");
});

test("blocked storage never throws", () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  expect(readPref()).toBe("system");
  expect(() => writePref("dark")).not.toThrow();
});

test("the inline init script applies the stored theme before React loads", () => {
  localStorage.setItem(THEME_KEY, "dark");
  new Function(THEME_INIT_SCRIPT)();
  expect(document.documentElement.dataset.theme).toBe("dark");
});

test("the inline init script follows the OS when nothing is stored", () => {
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  new Function(THEME_INIT_SCRIPT)();
  expect(document.documentElement.dataset.theme).toBe("dark");
});

test("the inline init script survives blocked storage and missing matchMedia", () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  expect(() => new Function(THEME_INIT_SCRIPT)()).not.toThrow();
  expect(document.documentElement.dataset.theme).toBe("light");
});
