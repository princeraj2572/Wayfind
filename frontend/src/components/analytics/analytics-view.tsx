"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { useSpaceAnalytics, useSpaces } from "@/lib/queries";
import type { CountedText, Period } from "@/lib/types";
import { ActivityChart } from "./activity-chart";

const PERIODS: Period[] = [7, 30, 90];

const adminsOnly = <ErrorState title="Admins only" message="Only admins of this space can see its analytics." />;

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div role="group" aria-label={label} className="rounded-xl border border-line p-4">
      <div className="text-2xl font-bold tracking-tight">{value.toLocaleString("en-US")}</div>
      <div className="mt-0.5 text-xs font-medium text-mute">{label}</div>
    </div>
  );
}

function Ranked({ items, empty }: { items: CountedText[]; empty: string }) {
  if (items.length === 0) return <p className="mt-3 text-sm text-mute">{empty}</p>;
  return (
    <ol className="mt-3 divide-y divide-line overflow-hidden rounded-xl border border-line">
      {items.map((item) => (
        <li key={item.text} className="flex items-center gap-3 px-4 py-2.5">
          <span className="min-w-0 flex-1 break-words text-sm">{item.text}</span>
          <Badge tone="gray">{item.count}</Badge>
        </li>
      ))}
    </ol>
  );
}

function Section({ id, title, note, children }: { id: string; title: string; note?: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-8">
      <h2 id={id} className="text-base font-semibold">
        {title}
      </h2>
      {note ? <p className="mt-0.5 text-xs text-mute">{note}</p> : null}
      {children}
    </section>
  );
}

export function AnalyticsView({ spaceId }: { spaceId: number }) {
  const spaces = useSpaces();
  const [days, setDays] = useState<Period>(30);
  const space = spaces.data?.find((s) => s.id === spaceId);
  const isAdmin = space?.role === "admin";
  const analytics = useSpaceAnalytics(spaceId, days, isAdmin);

  if (spaces.isPending) {
    return (
      <div className="mx-auto max-w-3xl space-y-3 px-6 py-8">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  if (spaces.isError) return <ErrorState title="Couldn't load your spaces" message={spaces.error.message} />;
  if (!space) return <ErrorState title="Space not found" message="It may not exist, or you may not have access to it." />;
  if (!isAdmin) return adminsOnly;
  if (analytics.isError) {
    const status = analytics.error instanceof ApiError ? analytics.error.status : 0;
    if (status === 403 || status === 404) return adminsOnly;
  }

  const data = analytics.data;
  const t = data?.totals;
  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight">Analytics</h1>
          <p className="mt-0.5 max-w-80 truncate text-sm text-mute">{space.name}</p>
        </div>
        <div role="group" aria-label="Period" className="flex gap-1.5">
          {PERIODS.map((p) => (
            <Button
              key={p}
              size="sm"
              variant={p === days ? "primary" : "outline"}
              aria-pressed={p === days}
              onClick={() => setDays(p)}
            >
              {p} days
            </Button>
          ))}
        </div>
      </div>

      {analytics.isError ? (
        <div role="alert" className="mt-6 rounded-xl border border-line bg-panel p-6 text-center">
          <h2 className="text-base font-semibold">Couldn&apos;t load analytics</h2>
          <p className="mt-1 text-sm text-mute">{analytics.error.message}</p>
        </div>
      ) : !data || !t ? (
        <div className="mt-6 space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : (
        <div aria-busy={analytics.isPlaceholderData} className={cn(analytics.isPlaceholderData && "opacity-60")}>
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Tile label="Questions" value={t.questions} />
            <Tile label="Answered" value={t.answered} />
            <Tile label="Unanswered" value={t.unanswered} />
            <Tile label="People asking" value={t.unique_askers} />
          </div>
          <p className="mt-2 text-xs text-mute">
            Unanswered means nothing was found, or an AI answer cited no document of this space. Gaps are only detected for
            questions that got an AI answer: {t.with_generated_answer.toLocaleString("en-US")} of{" "}
            {t.questions.toLocaleString("en-US")} had one.
          </p>

          {t.questions === 0 ? (
            <div role="status" className="mt-8 rounded-xl border border-line bg-panel p-6 text-center text-sm text-mute">
              <p className="font-medium text-ink">No questions in this period.</p>
              <p className="mt-1">History starts when analytics was enabled, so earlier questions are not included.</p>
            </div>
          ) : (
            <>
              <Section id="activity" title="Activity">
                <div className="mt-3 rounded-xl border border-line p-4">
                  <ActivityChart daily={data.daily} />
                </div>
              </Section>
              <Section
                id="gaps"
                title="Gaps: questions the knowledge base couldn't answer"
                note="Write or improve documents for these."
              >
                <Ranked items={data.gaps} empty="No gaps in this period. Every answered question cited a source." />
              </Section>
              <Section id="top-questions" title="Top questions">
                <Ranked items={data.top_questions} empty="No questions yet." />
              </Section>
              <Section id="top-documents" title="Most cited documents">
                {data.top_documents.length === 0 ? (
                  <p className="mt-3 text-sm text-mute">No document has been cited yet.</p>
                ) : (
                  <ol className="mt-3 divide-y divide-line overflow-hidden rounded-xl border border-line">
                    {data.top_documents.map((doc) => (
                      <li key={doc.document_id}>
                        <Link
                          href={`/s/${spaceId}/d/${doc.document_id}`}
                          className="flex items-center gap-3 px-4 py-2.5 hover:bg-panel"
                        >
                          <span className="min-w-0 flex-1 break-words text-sm font-medium">{doc.title}</span>
                          <Badge tone="brand">{doc.citations}</Badge>
                        </Link>
                      </li>
                    ))}
                  </ol>
                )}
              </Section>
            </>
          )}
        </div>
      )}
    </div>
  );
}
