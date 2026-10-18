import { cn } from "@/lib/cn";

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-md bg-panel", className)} />;
}

/** Wraps skeletons so assistive technology hears one "Loading" status instead of nothing. */
export function LoadingBlock({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div role="status" aria-busy="true" aria-label="Loading" className={className}>
      {children}
    </div>
  );
}
