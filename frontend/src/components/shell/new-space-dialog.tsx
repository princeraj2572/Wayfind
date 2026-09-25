"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api";
import { useCreateSpace } from "@/lib/queries";

export function NewSpaceDialog() {
  const router = useRouter();
  const create = useCreateSpace();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const space = await create.mutateAsync(name);
      setOpen(false);
      setName("");
      router.push(`/s/${space.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create the space.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-start text-brand-dark">
          + New space
        </Button>
      </DialogTrigger>
      <DialogContent title="New space" description="A space groups documents and decides who can read or edit them.">
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <label htmlFor="space-name" className="text-sm font-medium">
              Space name
            </label>
            <Input id="space-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={200} autoFocus />
          </div>
          {error ? (
            <p role="alert" className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end">
            <Button type="submit" disabled={create.isPending || !name.trim()}>
              Create space
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
