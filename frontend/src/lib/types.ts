export type Role = "viewer" | "editor" | "admin";
export type IndexStatus = "pending" | "indexed" | "failed";

export interface Me {
  id: number;
  email: string;
}

export interface Space {
  id: number;
  name: string;
  role: Role;
}

export interface Doc {
  id: number;
  space_id: number;
  title: string;
  body_md: string;
  source_type: string;
  updated_at: string;
  updated_by: number | null;
  updated_by_email: string | null;
  index_status: IndexStatus;
  indexed_at: string | null;
  chunk_count: number;
}

export interface AskSource {
  n: number;
  chunk_id: number;
  document_id: number;
  title: string;
  text: string;
}

export interface AskResponse {
  answer: string | null;
  answer_error: string | null;
  sources: AskSource[];
}

export const NO_MATCH_ERROR = "no matching documents found";

export const canEdit = (role?: Role) => role === "editor" || role === "admin";

export interface Member {
  user_id: number;
  email: string;
  role: Role;
}

export type Period = 7 | 30 | 90;

export interface CountedText {
  text: string;
  count: number;
}

export interface TopDocument {
  document_id: number;
  title: string;
  citations: number;
}

export interface DailyCount {
  date: string;
  questions: number;
}

export interface SpaceAnalytics {
  days: Period;
  totals: { questions: number; answered: number; unanswered: number; unique_askers: number; with_generated_answer: number };
  top_questions: CountedText[];
  gaps: CountedText[];
  top_documents: TopDocument[];
  daily: DailyCount[];
}
