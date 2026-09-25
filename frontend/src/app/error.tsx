"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="grid min-h-screen place-items-center bg-panel px-4">
      <div className="text-center">
        <Brand className="text-lg" />
        <h1 className="mt-6 text-2xl font-bold tracking-tight">Something went wrong</h1>
        <p className="mt-2 text-sm text-mute">An unexpected error happened. Try again, or go back to Ask.</p>
        <div className="mt-5 flex justify-center gap-2">
          <Button onClick={reset}>Try again</Button>
          <Button asChild variant="outline">
            <Link href="/ask">Back to Ask</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
