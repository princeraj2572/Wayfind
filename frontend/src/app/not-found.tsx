import Link from "next/link";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-panel px-4">
      <div className="text-center">
        <Brand className="text-lg" />
        <h1 className="mt-6 text-2xl font-bold tracking-tight">Page not found</h1>
        <p className="mt-2 text-sm text-mute">The page you are looking for does not exist.</p>
        <Button asChild className="mt-5">
          <Link href="/ask">Back to Ask</Link>
        </Button>
      </div>
    </div>
  );
}
