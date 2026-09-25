import { vi } from "vitest";

export const router = {
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  back: vi.fn(),
  prefetch: vi.fn(),
};
export const nav = { pathname: "/ask", search: "" };

/** Use as: vi.mock("next/navigation", async () => (await import("@/test/nav")).navigationMock); */
export const navigationMock = {
  useRouter: () => router,
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(nav.search),
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT:${to}`);
  },
};

export function resetNav() {
  Object.values(router).forEach((fn) => fn.mockClear());
  nav.pathname = "/ask";
  nav.search = "";
}
