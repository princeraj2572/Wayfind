import Link from "next/link";
import { Button } from "./button";

export function ErrorState({
  title,
  message,
  onRetry,
  tone = "error",
}: {
  title: string;
  message?: string;
  onRetry?: () => void;
  /** "info" is for notices that are not failures (announced politely instead of as an alert). */
  tone?: "error" | "info";
}) {
  return (
    <div
      role={tone === "info" ? "status" : "alert"}
      className="mx-auto mt-16 max-w-md rounded-xl border border-line bg-panel p-6 text-center"
    >
      <h2 className="text-base font-semibold">{title}</h2>
      {message ? <p className="mt-1 text-sm text-mute">{message}</p> : null}
      <div className="mt-4 flex justify-center gap-2">
        {onRetry ? (
          <Button size="sm" onClick={onRetry}>
            Retry
          </Button>
        ) : null}
        <Button asChild variant="outline" size="sm">
          <Link href="/ask">Back to Ask</Link>
        </Button>
      </div>
    </div>
  );
}
