import { setupServer } from "msw/node";

export const server = setupServer();

/** Call once at the top of a test file: starts MSW, fails on any unmocked request. */
export function setupMockServer() {
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());
}
