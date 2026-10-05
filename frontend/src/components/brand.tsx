import { cn } from "@/lib/cn";

export function Brand({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-base font-bold", className)}>
      <span aria-hidden className="grid size-6 place-items-center rounded-md bg-brand text-xs text-white">
        W
      </span>
      Wayfind
    </span>
  );
}
