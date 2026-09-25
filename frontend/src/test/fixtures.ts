import type { Doc, Space } from "@/lib/types";

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
