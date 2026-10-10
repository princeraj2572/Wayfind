"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, jsonBody } from "./api";
import type { AskResponse, Doc, IndexStatus, Me, Space } from "./types";

export const qk = {
  me: ["me"] as const,
  spaces: ["spaces"] as const,
  docs: (spaceId: number) => ["docs", spaceId] as const,
  doc: (docId: number) => ["doc", docId] as const,
};

export function indexPollDelay(status: IndexStatus | undefined, poll: boolean, ms = 2000): number | false {
  return status === "pending" && poll ? ms : false;
}

/** Keep refreshing the list only for documents that were saved recently (a lost task must not poll forever). */
export function hasFreshPending(docs: Doc[] | undefined, now: Date = new Date()): boolean {
  return (docs ?? []).some(
    (d) => d.index_status === "pending" && now.getTime() - new Date(d.updated_at).getTime() < 120_000,
  );
}

export const useMe = () => useQuery({ queryKey: qk.me, queryFn: () => apiFetch<Me>("/auth/me") });

export const useSpaces = () => useQuery({ queryKey: qk.spaces, queryFn: () => apiFetch<Space[]>("/spaces") });

export const useDocuments = (spaceId: number) =>
  useQuery({
    queryKey: qk.docs(spaceId),
    queryFn: () => apiFetch<Doc[]>(`/spaces/${spaceId}/documents`),
    refetchInterval: (query) => (hasFreshPending(query.state.data) ? 3000 : false),
  });

/** Identifies one save of one document; a new save (new updated_at) gives a new key. */
export const docKey = (doc: Doc) => `${doc.id}:${doc.updated_at}`;

/**
 * Polls while the document is pending. `stuckFor` is the docKey of a save that has been pending too long:
 * polling stops for that save only, and resumes automatically for the next save.
 */
export function useDocument(
  docId: number | null,
  opts: { poll?: boolean; pollMs?: number; stuckFor?: string | null } = {},
) {
  const { poll = true, pollMs = 2000, stuckFor = null } = opts;
  return useQuery({
    queryKey: qk.doc(docId ?? -1),
    queryFn: () => apiFetch<Doc>(`/documents/${docId}`),
    enabled: docId !== null,
    refetchInterval: (query) => {
      const doc = query.state.data;
      const stuck = doc !== undefined && stuckFor === docKey(doc);
      return indexPollDelay(doc?.index_status, poll && !stuck, pollMs);
    },
  });
}

export function useCreateSpace() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => apiFetch<Space>("/spaces", { method: "POST", body: jsonBody({ name }) }),
    onSuccess: () => client.invalidateQueries({ queryKey: qk.spaces }),
  });
}

export function useAsk() {
  return useMutation({
    mutationFn: ({ question, spaceId }: { question: string; spaceId: number | null }) =>
      apiFetch<AskResponse>("/ask", {
        method: "POST",
        body: jsonBody({ question, space_ids: spaceId === null ? undefined : [spaceId] }),
      }),
  });
}

type DocInput = { title: string; body_md: string };

export function useCreateDoc(spaceId: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: DocInput) =>
      apiFetch<Doc>(`/spaces/${spaceId}/documents`, { method: "POST", body: jsonBody(input) }),
    onSuccess: (doc) => {
      client.setQueryData(qk.doc(doc.id), doc);
      return client.invalidateQueries({ queryKey: qk.docs(spaceId) });
    },
  });
}

export function useSaveDoc(docId: number, spaceId: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: DocInput) => apiFetch<Doc>(`/documents/${docId}`, { method: "PUT", body: jsonBody(input) }),
    onSuccess: (doc) => {
      client.setQueryData(qk.doc(docId), doc);
      return client.invalidateQueries({ queryKey: qk.docs(spaceId) });
    },
  });
}

export function useDeleteDoc(docId: number, spaceId: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<void>(`/documents/${docId}`, { method: "DELETE" }),
    onSuccess: () => {
      client.removeQueries({ queryKey: qk.doc(docId) });
      void client.invalidateQueries({ queryKey: qk.docs(spaceId) });
    },
  });
}

export function useUploadDoc(spaceId: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return apiFetch<Doc>(`/spaces/${spaceId}/documents/upload`, { method: "POST", body: form });
    },
    onSuccess: () => client.invalidateQueries({ queryKey: qk.docs(spaceId) }),
  });
}
