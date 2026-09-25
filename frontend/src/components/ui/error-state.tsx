import Link from "next/link";
import { Button } from "./button";

export function ErrorState({ title, message }: { title: string; message?: string }) {
  return (
    <div role="alert" className="mx-auto mt-16 max-w-md rounded-xl border border-line bg-panel p-6 text-center">
      <h2 className="text-base font-semibold">{title}</h2>
      {message ? <p className="mt-1 text-sm text-mute">{message}</p> : null}
      <Button asChild variant="outline" size="sm" className="mt-4">
        <Link href="/ask">Back to Ask</Link>
      </Button>
    </div>
  );
}
