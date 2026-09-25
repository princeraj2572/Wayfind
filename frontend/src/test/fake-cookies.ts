export type StoredCookie = { value: string; options?: Record<string, unknown> };

export const cookieJar = new Map<string, StoredCookie>();

/** vi.mock("next/headers", async () => (await import("@/test/fake-cookies")).headersMock) */
export const headersMock = {
  cookies: async () => ({
    get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name)!.value } : undefined),
    set: (name: string, value: string, options?: Record<string, unknown>) => {
      cookieJar.set(name, { value, options });
    },
    delete: (name: string) => {
      cookieJar.delete(name);
    },
  }),
};
