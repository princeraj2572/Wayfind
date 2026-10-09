import Link from "next/link";
import { cn } from "@/lib/cn";
import { snippet } from "@/lib/text";
import type { AskSource } from "@/lib/types";

export function SourceCard({ source, id, highlighted }: { source: AskSource; id: string; highlighted: boolean }) {
  return (
    <Link
      id={id}
      href={`/d/${source.document_id}`}
      aria-current={highlighted ? "true" : undefined}
      className={cn(
        "block rounded-xl border bg-white p-3 transition-shadow hover:border-brand/50",
        highlighted ? "border-brand ring-2 ring-brand/30" : "border-line",
      )}
    >
      <div className="flex items-center gap-2 text-sm font-semibold">
        <span className="grid size-5 place-items-center rounded bg-brand text-[11px] text-white">{source.n}</span>
        <span className="truncate">{source.title}</span>
      </div>
      <p className="mt-1 line-clamp-2 text-xs text-mute">{snippet(source.text)}</p>
    </Link>
  );
}
