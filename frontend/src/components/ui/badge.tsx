import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const badgeVariants = cva("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", {
  variants: {
    tone: {
      brand: "bg-brand-tint text-brand-dark",
      gray: "bg-[#eef0f5] text-[#4b5266]",
      amber: "bg-amber-tint text-amber-ink",
      red: "bg-danger-tint text-danger",
    },
  },
  defaultVariants: { tone: "gray" },
});

export function Badge({
  tone,
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
