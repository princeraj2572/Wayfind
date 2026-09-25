"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingBlock, Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api";
import { useDocument } from "@/lib/queries";

export function DocRedirect({ docId }: { docId: number }) {
  const router = useRouter();
  const doc = useDocument(docId, { poll: false });
  const target = doc.data ? `/s/${doc.data.space_id}/d/${doc.data.id}` : null;

  useEffect(() => {
    if (target) router.replace(target);
  }, [target, router]);

  if (doc.isError) {
    if (doc.error instanceof ApiError && (doc.error.status === 404 || doc.error.status === 403)) {
      return <ErrorState title="Document not found" message="It may have been deleted, or you may not have access to it." />;
    }
    return (
      <ErrorState title="Couldn't load this document" message={doc.error.message} onRetry={() => void doc.refetch()} />
    );
  }
  return (
    <LoadingBlock className="mx-auto max-w-3xl space-y-3 px-6 py-8">
      <Skeleton className="h-7 w-64" />
      <Skeleton className="h-40 w-full" />
    </LoadingBlock>
  );
}
