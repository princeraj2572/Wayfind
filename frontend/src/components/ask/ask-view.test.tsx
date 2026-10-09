import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { makeSpace } from "@/test/fixtures";
import { renderWithClient } from "@/test/render";
import { server, setupMockServer } from "@/test/server";
import { AskView } from "./ask-view";

setupMockServer();

const SPACES = [makeSpace(), makeSpace({ id: 2, name: "Engineering", role: "viewer" })];
const SOURCES = [
  { n: 1, chunk_id: 11, document_id: 5, title: "Refund Policy", text: "# Refund Policy\nRefunds within 30 days." },
  { n: 2, chunk_id: 12, document_id: 6, title: "Enterprise SLA", text: "Enterprise customers get 60 days." },
];

function mockSpaces(spaces = SPACES) {
  server.use(http.get("*/api/spaces", () => HttpResponse.json(spaces)));
}

async function ask(text: string) {
  await userEvent.type(await screen.findByLabelText("Your question"), text);
  await userEvent.click(screen.getByRole("button", { name: "Ask" }));
}

test("shows an answer with citation chips and source cards", async () => {
  mockSpaces();
  server.use(
    http.post("*/api/ask", () =>
      HttpResponse.json({ answer: "Enterprise gets 60 days [2].", answer_error: null, sources: SOURCES }),
    ),
  );
  renderWithClient(<AskView initialSpaceId={null} />);
  await ask("refund policy?");
  expect(await screen.findByText(/Enterprise gets 60 days/)).toBeInTheDocument();
  expect(screen.getByText("refund policy?")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Show source 2" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /Refund Policy/ })).toHaveAttribute("href", "/d/5");
  expect(screen.getByRole("link", { name: /Enterprise SLA/ })).toHaveAttribute("href", "/d/6");
});

test("clicking a chip highlights its source", async () => {
  mockSpaces();
  server.use(
    http.post("*/api/ask", () =>
      HttpResponse.json({ answer: "Answer [1] and [2].", answer_error: null, sources: SOURCES }),
    ),
  );
  renderWithClient(<AskView initialSpaceId={null} />);
  await ask("q");
  await userEvent.click(await screen.findByRole("button", { name: "Show source 2" }));
  expect(screen.getByRole("link", { name: /Enterprise SLA/ })).toHaveAttribute("aria-current", "true");
  expect(screen.getByRole("link", { name: /Refund Policy/ })).not.toHaveAttribute("aria-current");
});

test("chips only render for real sources", async () => {
  mockSpaces();
  server.use(
    http.post("*/api/ask", () =>
      HttpResponse.json({ answer: "See [1] and [9].", answer_error: null, sources: [SOURCES[0]] }),
    ),
  );
  renderWithClient(<AskView initialSpaceId={null} />);
  await ask("q");
  expect(await screen.findByRole("button", { name: "Show source 1" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Show source 9" })).not.toBeInTheDocument();
  expect(screen.getByText(/\[9\]/)).toBeInTheDocument();
});

test("when the answer service is down the sources still show with a notice", async () => {
  mockSpaces();
  server.use(
    http.post("*/api/ask", () =>
      HttpResponse.json({ answer: null, answer_error: "ANTHROPIC_API_KEY is not set", sources: SOURCES }),
    ),
  );
  renderWithClient(<AskView initialSpaceId={null} />);
  await ask("q");
  expect(await screen.findByText(/answer service is unavailable/i)).toBeInTheDocument();
  expect(screen.queryByText(/ANTHROPIC_API_KEY/)).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: /Refund Policy/ })).toBeInTheDocument();
});

test("no matches shows a plain message", async () => {
  mockSpaces();
  server.use(
    http.post("*/api/ask", () =>
      HttpResponse.json({ answer: null, answer_error: "no matching documents found", sources: [] }),
    ),
  );
  renderWithClient(<AskView initialSpaceId={null} />);
  await ask("q");
  expect(await screen.findByText(/no matching documents were found/i)).toBeInTheDocument();
});

test("sends no space filter for All spaces and one id when a space is chosen", async () => {
  mockSpaces();
  const bodies: unknown[] = [];
  server.use(
    http.post("*/api/ask", async ({ request }) => {
      bodies.push(await request.json());
      return HttpResponse.json({ answer: "ok", answer_error: null, sources: [] });
    }),
  );
  renderWithClient(<AskView initialSpaceId={null} />);
  await ask("first");
  await waitFor(() => expect(bodies).toHaveLength(1));
  await userEvent.selectOptions(screen.getByLabelText("Search in"), "2");
  await ask("second");
  await waitFor(() => expect(bodies).toHaveLength(2));
  expect(bodies[0]).toEqual({ question: "first" });
  expect(bodies[1]).toEqual({ question: "second", space_ids: [2] });
});

test("the space from the URL is preselected", async () => {
  mockSpaces();
  renderWithClient(<AskView initialSpaceId={2} />);
  await waitFor(() => expect(screen.getByLabelText("Search in")).toHaveValue("2"));
});

test("Enter sends and Shift+Enter adds a line", async () => {
  mockSpaces();
  let count = 0;
  server.use(
    http.post("*/api/ask", () => {
      count += 1;
      return HttpResponse.json({ answer: "ok", answer_error: null, sources: [] });
    }),
  );
  renderWithClient(<AskView initialSpaceId={null} />);
  const box = await screen.findByLabelText("Your question");
  await userEvent.type(box, "line one{Shift>}{Enter}{/Shift}line two");
  expect(box).toHaveValue("line one\nline two");
  expect(count).toBe(0);
  await userEvent.type(box, "{Enter}");
  await waitFor(() => expect(count).toBe(1));
  expect(box).toHaveValue("");
});

test("an empty question cannot be sent", async () => {
  mockSpaces();
  renderWithClient(<AskView initialSpaceId={null} />);
  await screen.findByLabelText("Your question");
  expect(screen.getByRole("button", { name: "Ask" })).toBeDisabled();
  await userEvent.type(screen.getByLabelText("Your question"), "   ");
  expect(screen.getByRole("button", { name: "Ask" })).toBeDisabled();
});

test("an API error is shown on that answer", async () => {
  mockSpaces();
  server.use(http.post("*/api/ask", () => HttpResponse.json({ detail: "boom" }, { status: 500 })));
  renderWithClient(<AskView initialSpaceId={null} />);
  await ask("q");
  expect(await screen.findByRole("alert")).toHaveTextContent("boom");
});

test("a user with no spaces is told what to do", async () => {
  mockSpaces([]);
  renderWithClient(<AskView initialSpaceId={null} />);
  expect(await screen.findByText(/not in any space yet/i)).toBeInTheDocument();
  expect(screen.getByLabelText("Your question")).toBeDisabled();
});
