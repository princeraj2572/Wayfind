"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { toast } from "sonner";
import { IndexBadge } from "@/components/docs/index-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { ErrorState } from "@/components/ui/error-state";
import { Input, Textarea } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import {
  bold,
  bulletList,
  heading,
  inlineCode,
  italic,
  link,
  numberedList,
  type Edit,
} from "@/lib/markdown-tools";
import { docKey, useCreateDoc, useDeleteDoc, useDocument, useSaveDoc, useSpaces } from "@/lib/queries";
import { timeAgo } from "@/lib/time";
import { canEdit, type Doc } from "@/lib/types";
import { EditorToolbar, type ToolName } from "./editor-toolbar";
import { MarkdownPreview } from "./markdown-preview";
import { useUnsavedGuard } from "./use-unsaved-guard";

type Mode = "write" | "split" | "preview";

const TOOL_FUNCTIONS: Record<ToolName, (text: string, start: number, end: number) => Edit> = {
  bold,
  italic,
  h1: (t, s, e) => heading(t, s, e, 1),
  h2: (t, s, e) => heading(t, s, e, 2),
  bullet: bulletList,
  numbered: numberedList,
  link,
  code: inlineCode,
};

const message = (err: unknown) => errorMessage(err, "Something went wrong. Try again.");

export interface DocEditorProps {
  spaceId: number;
  docId: number | null;
  pollMs?: number;
  stuckAfterMs?: number;
}

function EditorSkeleton() {
  return (
    <div className="mx-auto max-w-5xl space-y-3 px-6 py-8">
      <Skeleton className="h-8 w-72" />
      <Skeleton className="h-4 w-56" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export function DocEditor({ spaceId, docId, pollMs = 2000, stuckAfterMs = 60_000 }: DocEditorProps) {
  const spaces = useSpaces();
  const [stuckFor, setStuckFor] = useState<string | null>(null);
  // Once deleted, stop observing the document: its query was removed and a refetch would 404.
  const [deleted, setDeleted] = useState(false);
  const query = useDocument(deleted ? null : docId, { pollMs, stuckFor });
  const doc = query.data;

  const status = doc?.index_status;
  const stuckKey = doc ? docKey(doc) : null;
  useEffect(() => {
    if (status !== "pending" || !stuckKey) return;
    const timer = setTimeout(() => setStuckFor(stuckKey), stuckAfterMs);
    return () => clearTimeout(timer);
  }, [status, stuckKey, stuckAfterMs]);
  const stuck = status === "pending" && stuckFor === stuckKey;

  const listedRole = spaces.data?.find((s) => s.id === (doc?.space_id ?? spaceId))?.role;
  // A later spaces refetch that no longer lists this space must not unmount an editor holding unsaved edits.
  const [lastRole, setLastRole] = useState(listedRole);
  if (listedRole && listedRole !== lastRole) setLastRole(listedRole);
  const role = listedRole ?? lastRole;

  if (deleted || spaces.isPending || (docId !== null && query.isPending)) return <EditorSkeleton />;
  // Only when there is no data: a failed background poll must keep the mounted editor (and its unsaved edits).
  if (docId !== null && !doc && query.isError) {
    if (query.error instanceof ApiError && query.error.status === 404) {
      return <ErrorState title="Document not found" message="It may have been deleted, or you may not have access to it." />;
    }
    return <ErrorState title="Couldn't load this document" message={message(query.error)} onRetry={() => void query.refetch()} />;
  }
  if (spaces.isError && !spaces.data) {
    return <ErrorState title="Couldn't load your spaces" message={message(spaces.error)} />;
  }
  if (!role) return <ErrorState title="Space not found" message="It may not exist, or you may not have access to it." />;

  return (
    <EditorBody
      key={doc?.id ?? "new"}
      spaceId={doc?.space_id ?? spaceId}
      doc={doc}
      readOnly={!canEdit(role)}
      stuck={stuck}
      onDeleted={() => setDeleted(true)}
    />
  );
}

interface EditorBodyProps {
  spaceId: number;
  doc?: Doc;
  readOnly: boolean;
  stuck: boolean;
  onDeleted: () => void;
}

function EditorBody({ spaceId, doc, readOnly, stuck, onDeleted }: EditorBodyProps) {
  const router = useRouter();
  const [title, setTitle] = useState(doc?.title ?? "");
  const [body, setBody] = useState(doc?.body_md ?? "");
  const [mode, setMode] = useState<Mode>("split");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const pendingSelection = useRef<{ start: number; end: number } | null>(null);

  const save = useSaveDoc(doc?.id ?? 0, spaceId);
  const create = useCreateDoc(spaceId);
  const remove = useDeleteDoc(doc?.id ?? 0, spaceId);

  const baseTitle = doc?.title ?? "";
  const baseBody = doc?.body_md ?? "";
  const dirty = title !== baseTitle || body !== baseBody;
  // After create resolves the server page is still loading: keep the editor locked so nothing is created twice.
  const creating = !doc && (create.isPending || create.isSuccess);
  const busy = save.isPending || creating;
  const failed = doc?.index_status === "failed";
  const canSave = !readOnly && !busy && (dirty || failed || stuck);

  useUnsavedGuard(dirty && !readOnly);

  useLayoutEffect(() => {
    const selection = pendingSelection.current;
    const element = textarea.current;
    if (selection && element) {
      element.focus();
      element.setSelectionRange(selection.start, selection.end);
      pendingSelection.current = null;
    }
  }, [body]);

  function applyTool(tool: ToolName) {
    const element = textarea.current;
    if (!element) return;
    const edit = TOOL_FUNCTIONS[tool](body, element.selectionStart, element.selectionEnd);
    pendingSelection.current = { start: edit.start, end: edit.end };
    setBody(edit.text);
  }

  async function onSave() {
    const cleanTitle = title.trim() || "Untitled";
    try {
      if (!doc) {
        const created = await create.mutateAsync({ title: cleanTitle, body_md: body });
        toast.success("Created");
        router.replace(`/s/${spaceId}/d/${created.id}`);
      } else {
        const saved = await save.mutateAsync({ title: cleanTitle, body_md: body });
        // Show what the server actually stored (it may normalise the text), unless the user kept typing meanwhile.
        setTitle((current) => (current === title ? saved.title : current));
        setBody((current) => (current === body ? saved.body_md : current));
        toast.success("Saved");
      }
    } catch (err) {
      toast.error(message(err));
    }
  }

  async function onDelete() {
    try {
      await remove.mutateAsync();
      // Commit the switch to a null query before navigating so no stale poll can re-create the removed query.
      flushSync(() => onDeleted());
      setConfirmOpen(false);
      toast.success("Document deleted");
      router.replace(`/s/${spaceId}`);
    } catch (err) {
      setConfirmOpen(false);
      toast.error(message(err));
    }
  }

  if (readOnly && doc) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-8">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-2xl font-bold tracking-tight">{doc.title}</h1>
          <Button asChild variant="outline">
            <Link href={`/ask?space=${spaceId}`}>Ask about this</Link>
          </Button>
        </div>
        <Meta doc={doc} stuck={stuck} dirty={false} />
        <p className="mt-4 rounded-lg bg-panel px-3 py-2 text-sm text-mute-strong">
          You have read-only access to this space. Ask a space admin if you need to edit documents.
        </p>
        <div className="mt-6">
          <MarkdownPreview text={doc.body_md} demoteHeadings />
        </div>
      </div>
    );
  }

  if (readOnly) {
    return (
      <ErrorState
        tone="info"
        title="Read-only access"
        message="You can read documents in this space but not create new ones."
      />
    );
  }

  const showEditor = mode !== "preview";
  const showPreview = mode !== "write";
  return (
    <div
      className="mx-auto flex max-w-6xl flex-col px-6 py-6"
      onKeyDown={(e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
          e.preventDefault();
          if (canSave) void onSave();
        }
      }}
    >
      <div className="flex flex-wrap items-center gap-3">
        <Input
          aria-label="Title"
          value={title}
          placeholder="Untitled"
          readOnly={creating}
          onChange={(e) => setTitle(e.target.value)}
          className="h-11 min-w-0 flex-1 border-transparent px-2 text-2xl font-bold tracking-tight shadow-none hover:border-line"
        />
        <div className="flex items-center gap-2">
          {dirty && !creating ? (
            <Button
              variant="ghost"
              onClick={() => {
                setTitle(baseTitle);
                setBody(baseBody);
              }}
            >
              Discard
            </Button>
          ) : null}
          <Button onClick={() => void onSave()} disabled={!canSave}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      <Meta doc={doc} stuck={stuck} dirty={dirty} />
      {failed ? (
        <p role="status" className="mt-3 rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">
          Indexing failed. Save again to retry. Your document is saved but will not show up in search until it is indexed.
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-y border-line py-2">
        <div className="flex items-center gap-3">
          <div role="group" aria-label="View mode" className="inline-flex overflow-hidden rounded-lg border border-field text-xs">
            {(["write", "split", "preview"] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                onClick={() => setMode(m)}
                className={cn("px-3 py-1.5", mode === m ? "bg-brand-tint font-semibold text-brand-dark" : "text-ink-soft hover:bg-panel")}
              >
                {m === "write" ? "Write" : m === "split" ? "Split" : "Preview"}
              </button>
            ))}
          </div>
          <EditorToolbar onTool={applyTool} disabled={!showEditor || creating} />
        </div>
        {doc ? (
          <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <DialogTrigger asChild>
              <Button variant="danger" size="sm">
                Delete
              </Button>
            </DialogTrigger>
            <DialogContent title="Delete this document?" description="It will be removed from search too. This cannot be undone.">
              <div className="flex justify-end gap-2">
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button variant="danger" onClick={() => void onDelete()} disabled={remove.isPending}>
                  Delete document
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        ) : null}
      </div>

      <div className={cn("grid min-h-[22rem] gap-0", showEditor && showPreview ? "lg:grid-cols-2" : "grid-cols-1")}>
        {showEditor ? (
          <Textarea
            ref={textarea}
            aria-label="Document body"
            value={body}
            readOnly={creating}
            onChange={(e) => setBody(e.target.value)}
            spellCheck
            placeholder="Write in Markdown…"
            className="min-h-[22rem] resize-y rounded-none border-0 border-r border-line px-4 py-4 font-mono text-[13px] leading-6 shadow-none focus-visible:outline-0"
          />
        ) : null}
        {showPreview ? (
          <div className="min-w-0 bg-paper px-6 py-4">
            <MarkdownPreview text={body} />
          </div>
        ) : null}
      </div>

      <div className="flex justify-between border-t border-line py-2 text-xs text-mute">
        <span>{body.trim() ? body.trim().split(/\s+/).length : 0} words · Markdown</span>
        <span>Saving re-indexes the document so it shows up in search within seconds.</span>
      </div>
    </div>
  );
}

function Meta({ doc, stuck, dirty }: { doc?: Doc; stuck: boolean; dirty: boolean }) {
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1.5 px-2 text-xs text-mute">
      {doc ? (
        <span>
          Edited {timeAgo(doc.updated_at)}
          {doc.updated_by_email ? ` by ${doc.updated_by_email}` : ""}
        </span>
      ) : (
        <span>New document</span>
      )}
      {doc ? <IndexBadge status={doc.index_status} chunkCount={doc.chunk_count} stuck={stuck} /> : null}
      {dirty ? <Badge tone="amber">● Unsaved changes</Badge> : null}
    </div>
  );
}
