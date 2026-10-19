import { setupServer } from "msw/node";

export const server = setupServer();

/** Call once at the top of a test file: starts MSW and fails the test on any unmocked request. */
export function setupMockServer() {
  const unhandled: string[] = [];
  beforeAll(() => {
    server.listen({ onUnhandledRequest: "error" });
    // "error" alone only makes the fetch fail, which app code may swallow; record it so the test fails too.
    server.events.on("request:unhandled", ({ request }) => {
      unhandled.push(`${request.method} ${request.url}`);
    });
  });
  afterEach(() => {
    server.resetHandlers();
    const seen = unhandled.splice(0);
    if (seen.length) throw new Error(`Unmocked request(s) during the test:\n${seen.join("\n")}`);
  });
  afterAll(() => {
    server.events.removeAllListeners();
    server.close();
  });
}
