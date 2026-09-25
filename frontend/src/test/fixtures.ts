import type { Doc, Member, Period, Space, SpaceAnalytics } from "@/lib/types";

export const makeSpace = (o: Partial<Space> = {}): Space => ({ id: 1, name: "Support", role: "admin", ...o });

export const makeDoc = (o: Partial<Doc> = {}): Doc => ({
  id: 10,
  space_id: 1,
  title: "Refund Policy",
  body_md: "# Refund Policy\nWithin 30 days.",
  source_type: "markdown",
  updated_at: "2026-09-20T10:00:00Z",
  updated_by: 1,
  updated_by_email: "alice@example.com",
  index_status: "indexed",
  indexed_at: "2026-09-20T10:00:05Z",
  chunk_count: 2,
  ...o,
});

export const makeMember = (o: Partial<Member> = {}): Member => ({
  user_id: 1,
  email: "alice@example.com",
  role: "admin",
  ...o,
});

export const makeAnalytics = (o: Partial<SpaceAnalytics> = {}): SpaceAnalytics => {
  const days = (o.days ?? 30) as Period;
  return {
    days,
    totals: { questions: 12, answered: 9, unanswered: 3, unique_askers: 4, with_generated_answer: 10 },
    top_questions: [
      { text: "how long do refunds take?", count: 5 },
      { text: "reset vpn", count: 2 },
    ],
    gaps: [{ text: "parental leave policy", count: 2 }],
    top_documents: [{ document_id: 10, title: "Refund Policy", citations: 6 }],
    daily: Array.from({ length: days }, (_, i) => ({
      date: new Date(Date.UTC(2026, 8, 25 - (days - 1 - i))).toISOString().slice(0, 10),
      questions: i % 3,
    })),
    ...o,
  };
};
