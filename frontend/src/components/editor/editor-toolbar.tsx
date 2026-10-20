"use client";

import { Bold, Code, Heading1, Heading2, Italic, Link2, List, ListOrdered } from "lucide-react";
import type { ComponentType } from "react";
import { cn } from "@/lib/cn";

export type ToolName = "bold" | "italic" | "h1" | "h2" | "bullet" | "numbered" | "link" | "code";

const TOOLS: { name: ToolName; label: string; Icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }> }[] = [
  { name: "bold", label: "Bold", Icon: Bold },
  { name: "italic", label: "Italic", Icon: Italic },
  { name: "h1", label: "Heading 1", Icon: Heading1 },
  { name: "h2", label: "Heading 2", Icon: Heading2 },
  { name: "bullet", label: "Bulleted list", Icon: List },
  { name: "numbered", label: "Numbered list", Icon: ListOrdered },
  { name: "link", label: "Link", Icon: Link2 },
  { name: "code", label: "Code", Icon: Code },
];

export function EditorToolbar({ onTool, disabled }: { onTool: (tool: ToolName) => void; disabled: boolean }) {
  return (
    <div role="toolbar" aria-label="Formatting" className="flex flex-wrap gap-1">
      {TOOLS.map(({ name, label, Icon }) => (
        <button
          key={name}
          type="button"
          title={label}
          aria-label={label}
          disabled={disabled}
          // Keep the textarea selection when a toolbar button is pressed.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onTool(name)}
          className={cn(
            "grid size-8 place-items-center rounded-md border border-line bg-white text-ink-soft hover:bg-panel",
            "disabled:pointer-events-none disabled:opacity-50",
          )}
        >
          <Icon aria-hidden className="size-4" />
        </button>
      ))}
    </div>
  );
}
