"use client";

import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { splitCitations } from "@/lib/cite";
import { NO_MATCH_ERROR, type AskResponse } from "@/lib/types";
import { SourceCard } from "./source-card";

export type EntryState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "done"; data: AskResponse };

export interface Entry {
  id: number;
  question: string;
  state: EntryState;
}

export function AnswerCard({ entry }: { entry: Entry }) {
  const [highlight, setHighlight] = useState<number | null>(null);
  const { state } = entry;
  const sourceId = (n: number) => `source-${entry.id}-${n}`;

  function show(n: number) {
    setHighlight(n);
    document.getElementById(sourceId(n))?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  return (
    <div className="space-y-3">
      <div className="ml-auto w-fit max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-panel px-4 py-2.5 text-sm">
        {entry.question}
      </div>

      {state.status === "loading" ? (
        <section aria-busy="true" aria-label="Answer" className="rounded-2xl border border-brand-tint bg-brand-soft p-4">
          <p role="status" className="mb-3 text-sm text-mute">
            Searching your documents…
          </p>
          <div className="space-y-2">
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-11/12" />
            <Skeleton className="h-3.5 w-2/3" />
          </div>
        </section>
      ) : state.status === "error" ? (
        <p role="alert" className="rounded-2xl bg-danger-tint px-4 py-3 text-sm text-danger">
          {state.message}
        </p>
      ) : (
        <section aria-label="Answer" className="space-y-3">
          {state.data.answer ? (
            <div className="whitespace-pre-wrap rounded-2xl border border-brand-tint bg-brand-soft px-4 py-3.5 text-[15px] leading-relaxed">
              {splitCitations(state.data.answer, state.data.sources.length).map((part, i) =>
                part.kind === "text" ? (
                  <span key={i}>{part.text}</span>
                ) : (
                  <button
                    key={i}
                    type="button"
                    aria-label={`Show source ${part.n}`}
                    onClick={() => show(part.n)}
                    className="mx-0.5 inline-block rounded bg-brand px-1.5 align-baseline text-[11px] font-bold text-white hover:bg-brand-dark"
                  >
                    {part.n}
                  </button>
                ),
              )}
            </div>
          ) : state.data.answer_error === NO_MATCH_ERROR ? (
            <p className="rounded-2xl border border-line bg-panel px-4 py-3 text-sm text-mute">
              No matching documents were found. Try different words, or check that the right space is selected.
            </p>
          ) : (
            <p className="rounded-2xl bg-amber-tint px-4 py-3 text-sm text-amber-ink">
              The answer service is unavailable right now. Showing the best matching sources instead.
            </p>
          )}

          {state.data.sources.length > 0 ? (
            <div>
              <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-mute">Sources</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {state.data.sources.map((source) => (
                  <SourceCard key={source.n} source={source} id={sourceId(source.n)} highlighted={highlight === source.n} />
                ))}
              </div>
            </div>
          ) : null}
        </section>
      )}
    </div>
  );
}
