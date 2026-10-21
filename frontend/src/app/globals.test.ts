// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const css = readFileSync(join(__dirname, "globals.css"), "utf8");
const tokens = (block: string) => [...block.matchAll(/(--color-[a-z-]+):/g)].map((m) => m[1]);

const light = css.slice(css.indexOf("@theme"), css.indexOf("}", css.indexOf("@theme")));
const dark = css.slice(css.indexOf(':root[data-theme="dark"]'), css.indexOf("}", css.indexOf(':root[data-theme="dark"]')));

test("every color token has a dark counterpart, so no component is left half-themed", () => {
  const missing = tokens(light).filter((t) => !tokens(dark).includes(t));
  expect(missing).toEqual([]);
});

test("the dark block does not invent tokens the light theme lacks", () => {
  const extra = tokens(dark).filter((t) => !tokens(light).includes(t));
  expect(extra).toEqual([]);
});

test("the body background follows the theme", () => {
  expect(css).toMatch(/body\s*\{[^}]*background:\s*var\(--color-page\)/);
});

const HARDCODED = /(?:bg|text|border)-(?:white|black)|\[#[0-9a-fA-F]{3,8}\]/;

test("the hardcoded-color pattern recognises what it must", () => {
  for (const bad of ['className="bg-white"', "hover:bg-white", "text-black", 'border-[#cfd3e3]', "bg-[#fff]"]) {
    expect(HARDCODED.test(bad)).toBe(true);
  }
  for (const ok of ['className="bg-surface text-on-brand"', "border-line", "bg-brand-tint"]) {
    expect(HARDCODED.test(ok)).toBe(false);
  }
});

test("no source file hardcodes white, black or a hex color in a class", () => {
  const root = join(__dirname, "..");
  const sources = readdirSync(root, { recursive: true, encoding: "utf8" }).filter(
    (name) => name.endsWith(".tsx") && !name.includes(".test."),
  );
  expect(sources.length).toBeGreaterThan(30);
  const offenders: string[] = [];
  for (const name of sources) {
    if (HARDCODED.test(readFileSync(join(root, name), "utf8"))) offenders.push(name);
  }
  expect(offenders).toEqual([]);
});
