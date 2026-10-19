"use client";

import { Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import { useUploadDoc } from "@/lib/queries";

export function UploadDropzone({ spaceId }: { spaceId: number }) {
  const upload = useUploadDoc(spaceId);
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  async function handle(files: File[]) {
    for (const file of files) {
      try {
        const doc = await upload.mutateAsync(file);
        toast.success(`Uploaded “${doc.title}”`);
      } catch (err) {
        toast.error(`${file.name}: ${errorMessage(err, "upload failed")}`);
      }
    }
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        void handle(Array.from(e.dataTransfer.files));
      }}
      className={cn(
        "flex items-center gap-3 rounded-xl border-[1.5px] border-dashed px-4 py-3 text-sm transition-colors",
        over ? "border-brand bg-brand-tint" : "border-[#a7e3c8] bg-brand-soft",
      )}
    >
      <Upload aria-hidden className="size-5 shrink-0 text-brand-dark" />
      <p className="flex-1 text-brand-dark">
        Drop PDF, DOCX, Markdown or text files here, or{" "}
        <button type="button" onClick={() => inputRef.current?.click()} className="font-semibold underline underline-offset-2">
          browse
        </button>
        .
      </p>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".md,.txt,.pdf,.docx"
        aria-label="Upload files"
        className="hidden"
        onChange={(e) => {
          void handle(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
    </div>
  );
}
