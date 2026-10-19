"use client";

import { useEffect } from "react";

const UNSAVED_MESSAGE = "You have unsaved changes. Leave without saving?";

// How many mounted editors currently hold unsaved edits (sign-out is a menu action, not a link).
let dirtyEditors = 0;

/** For actions that leave the page without a link click (for example sign-out). */
export function confirmLeaveIfUnsaved(): boolean {
  return dirtyEditors === 0 || window.confirm(UNSAVED_MESSAGE);
}

/** Warn before closing the tab and before following an in-app link while there are unsaved edits. */
export function useUnsavedGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    dirtyEditors += 1;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const onClick = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || anchor.target === "_blank") return;
      if (!(anchor.getAttribute("href") ?? "").startsWith("/")) return;
      if (!window.confirm(UNSAVED_MESSAGE)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      dirtyEditors -= 1;
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);
}
