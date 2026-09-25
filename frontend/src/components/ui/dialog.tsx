"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/cn";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  title,
  description,
  children,
  className,
  onCloseAutoFocus,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
  onCloseAutoFocus?: (event: Event) => void;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-ink/40" />
      <DialogPrimitive.Content
        {...(description ? {} : { "aria-describedby": undefined })}
        onCloseAutoFocus={onCloseAutoFocus}
        className={cn(
          "fixed left-1/2 top-1/2 z-50 w-[min(92vw,26rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-line bg-white p-5 shadow-xl",
          className,
        )}
      >
        <DialogPrimitive.Title className="break-words text-base font-semibold">{title}</DialogPrimitive.Title>
        {description ? (
          <DialogPrimitive.Description className="mt-1 text-sm text-mute">{description}</DialogPrimitive.Description>
        ) : null}
        <div className="mt-4">{children}</div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
