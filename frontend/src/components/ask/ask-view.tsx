"use client";

import { SendHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { errorMessage } from "@/lib/api";
import { useAsk, useSpaces } from "@/lib/queries";
import { AnswerCard, type Entry, type EntryState } from "./answer-card";

export function AskView({ initialSpaceId }: { initialSpaceId: number | null }) {
  const spaces = useSpaces();
  const ask = useAsk();
  const [question, setQuestion] = useState("");
  const [spaceId, setSpaceId] = useState<number | null>(initialSpaceId);
  const [entries, setEntries] = useState<Entry[]>([]);
  const nextId = useRef(1);
  const endRef = useRef<HTMLDivElement>(null);

  const noSpaces = spaces.isSuccess && spaces.data.length === 0;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [entries]);

  function update(id: number, state: EntryState) {
    setEntries((all) => all.map((e) => (e.id === id ? { ...e, state } : e)));
  }

  async function submit() {
    const text = question.trim();
    if (!text || ask.isPending || noSpaces) return;
    const id = nextId.current++;
    setEntries((all) => [...all, { id, question: text, state: { status: "loading" } }]);
    setQuestion("");
    try {
      const data = await ask.mutateAsync({ question: text, spaceId });
      update(id, { status: "done", data });
    } catch (err) {
      update(id, { status: "error", message: errorMessage(err, "Something went wrong. Try again.") });
    }
  }

  return (
    <div className="mx-auto flex h-[calc(100dvh-3rem)] max-w-3xl md:h-dvh flex-col px-6">
      <header className="flex items-center justify-between gap-4 py-5">
        <h1 className="text-lg font-bold tracking-tight">Ask Wayfind</h1>
        <select
          aria-label="Search in"
          value={spaceId ?? ""}
          onChange={(e) => setSpaceId(e.target.value === "" ? null : Number(e.target.value))}
          className="h-9 rounded-lg border border-[#cfd3e3] bg-white px-2.5 text-sm"
        >
          <option value="">All spaces</option>
          {(spaces.data ?? []).map((space) => (
            <option key={space.id} value={space.id}>
              {space.name}
            </option>
          ))}
        </select>
      </header>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto pb-4">
        {entries.length === 0 ? (
          <div className="mt-16 text-center">
            <h2 className="text-xl font-semibold">Ask anything about your documents</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-mute">
              {noSpaces
                ? "You are not in any space yet. Create one from the sidebar, add documents, then come back to ask questions."
                : "Try “What is our refund policy for enterprise customers?” Answers cite the documents they came from."}
            </p>
          </div>
        ) : (
          entries.map((entry) => <AnswerCard key={entry.id} entry={entry} />)
        )}
        <div ref={endRef} />
      </div>

      <div className="pb-6 pt-2">
        <div className="flex items-end gap-2 rounded-2xl border border-[#cfd3e3] bg-white p-2 shadow-sm focus-within:border-brand">
          <Textarea
            aria-label="Your question"
            rows={1}
            maxLength={2000}
            value={question}
            disabled={noSpaces}
            placeholder="Ask a question…"
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void submit();
              }
            }}
            className="field-sizing-content max-h-40 min-h-9 flex-1 resize-none border-0 px-2 py-1.5 shadow-none focus-visible:outline-0"
          />
          <Button onClick={() => void submit()} disabled={!question.trim() || ask.isPending || noSpaces}>
            <SendHorizontal aria-hidden className="size-4" />
            Ask
          </Button>
        </div>
      </div>
    </div>
  );
}
