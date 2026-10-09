import { Badge } from "@/components/ui/badge";
import type { IndexStatus } from "@/lib/types";

export function IndexBadge({
  status,
  chunkCount,
  stuck = false,
}: {
  status: IndexStatus;
  chunkCount: number;
  stuck?: boolean;
}) {
  if (status === "failed") return <Badge tone="red">Indexing failed</Badge>;
  if (status === "pending") {
    return (
      <Badge tone="amber">
        <span aria-hidden className="size-2.5 animate-spin rounded-full border-2 border-amber-ink/30 border-t-amber-ink" />
        {stuck ? "Still indexing…" : "Indexing…"}
      </Badge>
    );
  }
  return (
    <Badge tone="brand">
      Indexed ✓ · {chunkCount} {chunkCount === 1 ? "chunk" : "chunks"}
    </Badge>
  );
}
