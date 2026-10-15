import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { Role, SpaceAnalytics } from "@/lib/types";
import { makeAnalytics, makeSpace } from "@/test/fixtures";
import { resetNav } from "@/test/nav";
import { renderWithClient } from "@/test/render";
import { server, setupMockServer } from "@/test/server";
import { ActivityChart, chartSummary } from "./activity-chart";
import { AnalyticsView } from "./analytics-view";

vi.mock("next/navigation", async () => (await import("@/test/nav")).navigationMock);

setupMockServer();
beforeEach(resetNav);

function mockApi(role: Role = "admin", build: (days: number) => SpaceAnalytics = (d) => makeAnalytics({ days: d as 7 | 30 | 90 })) {
  const requested: number[] = [];
  server.use(
    http.get("*/api/spaces", () => HttpResponse.json([makeSpace({ role })])),
    http.get("*/api/spaces/1/analytics", ({ request }) => {
      const days = Number(new URL(request.url).searchParams.get("days"));
      requested.push(days);
      return HttpResponse.json(build(days));
    }),
  );
  return requested;
}

const tile = (name: string) => within(screen.getByRole("group", { name }));

test("shows the totals, defaulting to the last 30 days", async () => {
  const requested = mockApi();
  renderWithClient(<AnalyticsView spaceId={1} />);
  expect(await screen.findByRole("heading", { name: "Analytics" })).toBeInTheDocument();
  await waitFor(() => expect(tile("Questions").getByText("12")).toBeInTheDocument());
  expect(tile("Answered").getByText("9")).toBeInTheDocument();
  expect(tile("Unanswered").getByText("3")).toBeInTheDocument();
  expect(tile("People asking").getByText("4")).toBeInTheDocument();
  expect(requested).toEqual([30]);
  expect(screen.getByRole("button", { name: "30 days" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByText(/10 of 12 questions had a generated answer/i)).toBeInTheDocument();
});

test("lists gaps, top questions and most cited documents", async () => {
  mockApi();
  renderWithClient(<AnalyticsView spaceId={1} />);
  const gaps = within(await screen.findByRole("region", { name: /gaps/i }));
  expect(gaps.getByText("parental leave policy")).toBeInTheDocument();
  expect(gaps.getByText("2")).toBeInTheDocument();
  const top = within(screen.getByRole("region", { name: "Top questions" }));
  expect(top.getByText("how long do refunds take?")).toBeInTheDocument();
  const docs = within(screen.getByRole("region", { name: "Most cited documents" }));
  expect(docs.getByRole("link", { name: /Refund Policy/ })).toHaveAttribute("href", "/s/1/d/10");
  expect(docs.getByText("6")).toBeInTheDocument();
});

test("switching the period refetches with the new number of days", async () => {
  const requested = mockApi();
  renderWithClient(<AnalyticsView spaceId={1} />);
  await screen.findByRole("region", { name: "Top questions" });
  await userEvent.click(screen.getByRole("button", { name: "7 days" }));
  await waitFor(() => expect(requested).toEqual([30, 7]));
  expect(screen.getByRole("button", { name: "7 days" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "30 days" })).toHaveAttribute("aria-pressed", "false");
  await waitFor(() => expect(screen.getByRole("img", { name: /^Questions per day/ })).toBeInTheDocument());
});

test("a period with no questions explains that history starts when analytics was enabled", async () => {
  mockApi("admin", (d) =>
    makeAnalytics({
      days: d as 7 | 30 | 90,
      totals: { questions: 0, answered: 0, unanswered: 0, unique_askers: 0, with_generated_answer: 0 },
      top_questions: [],
      gaps: [],
      top_documents: [],
    }),
  );
  renderWithClient(<AnalyticsView spaceId={1} />);
  expect(await screen.findByText(/no questions in this period/i)).toBeInTheDocument();
  expect(screen.getByText(/history starts when analytics was enabled/i)).toBeInTheDocument();
  expect(screen.queryByRole("region", { name: /gaps/i })).not.toBeInTheDocument();
});

test("when every question was answered the gaps section says so", async () => {
  mockApi("admin", (d) => makeAnalytics({ days: d as 7 | 30 | 90, gaps: [] }));
  renderWithClient(<AnalyticsView spaceId={1} />);
  const gaps = within(await screen.findByRole("region", { name: /gaps/i }));
  expect(gaps.getByText(/no gaps/i)).toBeInTheDocument();
});

test("a non-admin sees Admins only and never requests analytics", async () => {
  const requested = mockApi("editor");
  renderWithClient(<AnalyticsView spaceId={1} />);
  expect(await screen.findByText("Admins only")).toBeInTheDocument();
  expect(requested).toEqual([]);
});

test("a 403 from the server also shows Admins only", async () => {
  server.use(
    http.get("*/api/spaces", () => HttpResponse.json([makeSpace({ role: "admin" })])),
    http.get("*/api/spaces/1/analytics", () => HttpResponse.json({ detail: "admin role required" }, { status: 403 })),
  );
  renderWithClient(<AnalyticsView spaceId={1} />);
  expect(await screen.findByText("Admins only")).toBeInTheDocument();
});

test("a space you cannot see says so", async () => {
  server.use(http.get("*/api/spaces", () => HttpResponse.json([])));
  renderWithClient(<AnalyticsView spaceId={1} />);
  expect(await screen.findByText("Space not found")).toBeInTheDocument();
});

test("a server failure is reported", async () => {
  server.use(
    http.get("*/api/spaces", () => HttpResponse.json([makeSpace()])),
    http.get("*/api/spaces/1/analytics", () => HttpResponse.json({ detail: "boom" }, { status: 500 })),
  );
  renderWithClient(<AnalyticsView spaceId={1} />);
  expect(await screen.findByText("Couldn't load analytics")).toBeInTheDocument();
});

test("question text and titles are shown as text, never as markup", async () => {
  mockApi("admin", (d) =>
    makeAnalytics({
      days: d as 7 | 30 | 90,
      gaps: [{ text: "<img src=x onerror=alert(1)>", count: 1 }],
      top_documents: [{ document_id: 3, title: "<b>bold</b> title", citations: 1 }],
    }),
  );
  renderWithClient(<AnalyticsView spaceId={1} />);
  expect(await screen.findByText("<img src=x onerror=alert(1)>")).toBeInTheDocument();
  expect(screen.getByText("<b>bold</b> title")).toBeInTheDocument();
  expect(document.querySelector("img[src='x']")).toBeNull();
});

const daily = [
  { date: "2026-09-23", questions: 1 },
  { date: "2026-09-24", questions: 4 },
  { date: "2026-09-25", questions: 2 },
];

test("chartSummary describes the range, the total and the busiest day", () => {
  expect(chartSummary(daily)).toBe(
    "Questions per day from 2026-09-23 to 2026-09-25: 7 in total. Busiest day 2026-09-24 with 4.",
  );
  expect(chartSummary([{ date: "2026-09-25", questions: 0 }])).toBe("Questions per day from 2026-09-25 to 2026-09-25: none.");
  expect(chartSummary([])).toBe("No activity data.");
});

test("the chart exposes one image with the summary and keeps bar heights within 0-100%", () => {
  render(<ActivityChart daily={[{ date: "2026-09-24", questions: 0 }, { date: "2026-09-25", questions: 1_000_000 }]} />);
  const chart = screen.getByRole("img", { name: /1000000 in total/ });
  const heights = [...chart.children].map((el) => parseFloat((el as HTMLElement).style.height));
  expect(heights.every((h) => h >= 0 && h <= 100)).toBe(true);
  expect(heights[1]).toBe(100);
});

test("an all-zero series and a single day still render", () => {
  render(<ActivityChart daily={[{ date: "2026-09-25", questions: 0 }]} />);
  const chart = screen.getByRole("img");
  expect(chart.children).toHaveLength(1);
  expect(parseFloat((chart.children[0] as HTMLElement).style.height)).toBeGreaterThan(0);
});
