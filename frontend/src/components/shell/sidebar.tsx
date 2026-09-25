"use client";

import { ChartColumn, FolderOpen, MessageSquare } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brand } from "@/components/brand";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";
import { useSpaces } from "@/lib/queries";
import { NewSpaceDialog } from "./new-space-dialog";
import { UserMenu } from "./user-menu";

const item = "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm";
const active = "bg-brand-tint font-semibold text-brand-dark";
const idle = "text-[#3b4256] hover:bg-white";

export function Sidebar() {
  const pathname = usePathname();
  const spaces = useSpaces();
  const currentId = /^\/s\/(\d+)/.exec(pathname)?.[1];
  const list = spaces.data ?? [];
  const docsTarget = currentId ? `/s/${currentId}` : list.length ? `/s/${list[0].id}` : null;

  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-panel p-3 md:flex">
      <Link href="/ask" className="mb-5 px-2 pt-1">
        <Brand className="text-lg" />
      </Link>

      <nav aria-label="Main" className="space-y-0.5">
        <Link href="/ask" aria-current={pathname.startsWith("/ask") ? "page" : undefined} className={cn(item, pathname.startsWith("/ask") ? active : idle)}>
          <MessageSquare aria-hidden className="size-4" />
          Ask
        </Link>
        {docsTarget ? (
          <Link href={docsTarget} className={cn(item, pathname.startsWith("/s/") ? active : idle)}>
            <FolderOpen aria-hidden className="size-4" />
            Documents
          </Link>
        ) : spaces.isPending ? (
          <div className={item}>
            <Skeleton className="h-4 w-24 bg-line" />
          </div>
        ) : (
          <span aria-disabled="true" className={cn(item, "cursor-not-allowed text-mute/70")}>
            <FolderOpen aria-hidden className="size-4" />
            Documents
          </span>
        )}
        <span aria-disabled="true" className={cn(item, "cursor-not-allowed text-mute/70")}>
          <ChartColumn aria-hidden className="size-4" />
          Analytics
          <Badge tone="gray" className="ml-auto">
            Soon
          </Badge>
        </span>
      </nav>

      <div className="mt-6 px-2.5 text-[10.5px] font-semibold uppercase tracking-wider text-mute">Spaces</div>
      <div className="mt-1.5 min-h-0 flex-1 overflow-y-auto">
        {spaces.isPending ? (
          <div className="space-y-2 px-2.5 py-1">
            <Skeleton className="h-4 w-32 bg-line" />
            <Skeleton className="h-4 w-24 bg-line" />
          </div>
        ) : spaces.isError ? (
          <p className="px-2.5 text-xs text-danger">Couldn&apos;t load spaces.</p>
        ) : list.length === 0 ? (
          <p className="px-2.5 text-xs text-mute">No spaces yet. Create one to add documents.</p>
        ) : (
          <ul aria-label="Spaces" className="space-y-0.5">
            {list.map((space) => {
              const isCurrent = String(space.id) === currentId;
              return (
                <li key={space.id}>
                  <Link
                    href={`/s/${space.id}`}
                    aria-current={isCurrent ? "page" : undefined}
                    className={cn(item, "justify-between", isCurrent ? active : idle)}
                  >
                    <span className="truncate">{space.name}</span>
                    <span className="text-[11px] font-normal text-mute">{space.role}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        <div className="mt-1">
          <NewSpaceDialog />
        </div>
      </div>

      <div className="mt-2 border-t border-line pt-2">
        <UserMenu />
      </div>
    </aside>
  );
}
