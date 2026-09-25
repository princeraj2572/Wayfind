import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { MarkdownPreview } from "./markdown-preview";

test("images do not leak the referrer and load lazily", () => {
  const { container } = render(<MarkdownPreview text="![logo](https://example.com/a.png)" />);
  const img = container.querySelector("img")!;
  expect(img).toHaveAttribute("referrerpolicy", "no-referrer");
  expect(img).toHaveAttribute("loading", "lazy");
  expect(img).toHaveAttribute("alt", "logo");
});

test("links open in a new tab safely", () => {
  render(<MarkdownPreview text="[site](https://example.com)" />);
  const link = screen.getByRole("link", { name: "site" });
  expect(link).toHaveAttribute("target", "_blank");
  expect(link).toHaveAttribute("rel", "noopener noreferrer");
});
