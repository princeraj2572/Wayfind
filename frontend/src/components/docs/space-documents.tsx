"use client";

import { FileText, Plus } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useDocuments, useSpaces } from "@/lib/queries";
import { timeAgo } from "@/lib/time";
import { canEdit } from "@/lib/types";
import { IndexBadge } from "./index-badge";
import { UploadDropzone } from "./upload-dropzone";

export function SpaceDocuments({ spaceId }: { spaceId: number }) {
  const spaces = useSpaces();
  const docs = useDocuments(spaceId);
  const space = spaces.data?.find((s) => s.id === spaceId);

  if (spaces.isPending || (docs.isPending && !docs.isError)) {
    return (
      <div className="mx-auto max-w-3xl space-y-3 px-6 py-8">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }
  if (spaces.isError) return <ErrorState title="Couldn't load your spaces" message={spaces.error.message} />;
  if (!space) return <ErrorState title="Space not found" message="It may not exist, or you may not have access to it." />;
  if (docs.isError) return <ErrorState title="Couldn't load documents" message={docs.error.message} />;

  const editable = canEdit(space.role);
  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl font-bold tracking-tight">{space.name}</h1>
          <Badge tone="gray">{space.role}</Badge>
        </div>
        {editable ? (
          <Button asChild>
            <Link href={`/s/${spaceId}/d/new`}>
              <Plus aria-hidden className="size-4" />
              New document
            </Link>
          </Button>
        ) : null}
      </div>

      {editable ? (
        <div className="mt-5">
          <UploadDropzone spaceId={spaceId} />
        </div>
      ) : null}

      {docs.data.length === 0 ? (
        <p className="mt-10 text-center text-sm text-mute">
          No documents yet.{editable ? " Create one or upload a file to get started." : ""}
        </p>
      ) : (
        <ul className="mt-5 divide-y divide-line overflow-hidden rounded-xl border border-line">
          {docs.data.map((doc) => (
            <li key={doc.id}>
              <Link href={`/s/${spaceId}/d/${doc.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-panel">
                <FileText aria-hidden className="size-5 shrink-0 text-mute" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{doc.title}</span>
                  <span className="block text-xs text-mute">
                    Edited {timeAgo(doc.updated_at)}
                    {doc.updated_by_email ? ` by ${doc.updated_by_email}` : ""}
                  </span>
                </span>
                <IndexBadge status={doc.index_status} chunkCount={doc.chunk_count} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
