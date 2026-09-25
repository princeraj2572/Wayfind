import type { DailyCount } from "@/lib/types";

/** One-sentence text alternative for the chart. */
export function chartSummary(daily: DailyCount[]): string {
  if (daily.length === 0) return "No activity data.";
  const total = daily.reduce((sum, d) => sum + d.questions, 0);
  const range = `from ${daily[0].date} to ${daily[daily.length - 1].date}`;
  if (total === 0) return `Questions per day ${range}: none.`;
  const peak = daily.reduce((best, d) => (d.questions > best.questions ? d : best), daily[0]);
  return `Questions per day ${range}: ${total} in total. Busiest day ${peak.date} with ${peak.questions}.`;
}

export function ActivityChart({ daily }: { daily: DailyCount[] }) {
  const max = Math.max(1, ...daily.map((d) => d.questions));
  return (
    <figure>
      <div role="img" aria-label={chartSummary(daily)} className="flex h-32 items-end gap-px">
        {daily.map((d) => (
          <div
            key={d.date}
            title={`${d.date}: ${d.questions}`}
            className={d.questions === 0 ? "flex-1 rounded-t-sm bg-line" : "flex-1 rounded-t-sm bg-brand"}
            style={{ height: `${d.questions === 0 ? 2 : Math.max(4, (d.questions / max) * 100)}%` }}
          />
        ))}
      </div>
      {daily.length > 0 ? (
        <div aria-hidden className="mt-1 flex justify-between text-[11px] text-mute">
          <span>{daily[0].date}</span>
          <span>{daily[daily.length - 1].date}</span>
        </div>
      ) : null}
    </figure>
  );
}
