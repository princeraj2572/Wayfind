"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { LogOut, Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Brand } from "@/components/brand";
import { useSignOut } from "@/lib/use-sign-out";
import { useSpaces } from "@/lib/queries";
import { NewSpaceDialog } from "./new-space-dialog";

const item =
  "flex cursor-pointer items-center justify-between gap-3 rounded-md px-2.5 py-2 text-sm outline-none data-[highlighted]:bg-panel";

/** Top bar for viewports below md, where the sidebar is hidden. */
export function MobileNav() {
  const spaces = useSpaces();
  const signOut = useSignOut();
  const list = spaces.data ?? [];
  const pathname = usePathname();
  const [newSpaceOpen, setNewSpaceOpen] = useState(false);
  const currentId = /^\/s\/(\d+)/.exec(pathname)?.[1];
  const currentSpace = list.find((s) => String(s.id) === currentId);

  return (
    <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center justify-between border-b border-line bg-white px-4 md:hidden">
      <Link href="/ask">
        <Brand />
      </Link>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger
          aria-label="Menu"
          className="grid size-9 place-items-center rounded-lg hover:bg-panel focus-visible:outline-2 focus-visible:outline-brand"
        >
          <Menu aria-hidden className="size-5" />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={6}
            className="z-50 max-h-[70vh] min-w-56 overflow-y-auto rounded-lg border border-line bg-white p-1 shadow-lg"
          >
            <DropdownMenu.Item asChild>
              <Link href="/ask" className={item}>
                Ask
              </Link>
            </DropdownMenu.Item>
            {currentSpace?.role === "admin" ? (
              <DropdownMenu.Item asChild>
                <Link href={`/s/${currentSpace.id}/analytics`} className={item}>
                  Analytics
                </Link>
              </DropdownMenu.Item>
            ) : null}
            <DropdownMenu.Separator className="my-1 h-px bg-line" />
            <DropdownMenu.Label className="px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-mute">
              Documents
            </DropdownMenu.Label>
            {list.length === 0 ? (
              <div className="px-2.5 py-1.5 text-sm text-mute">{spaces.isPending ? "Loading…" : "No spaces yet"}</div>
            ) : (
              list.map((space) => (
                <DropdownMenu.Item key={space.id} asChild>
                  <Link href={`/s/${space.id}`} className={item}>
                    <span className="truncate">{space.name}</span>
                    <span className="text-[11px] text-mute">{space.role}</span>
                  </Link>
                </DropdownMenu.Item>
              ))
            )}
            <DropdownMenu.Separator className="my-1 h-px bg-line" />
            <DropdownMenu.Item onSelect={() => setNewSpaceOpen(true)} className={item}>
              New space
            </DropdownMenu.Item>
            <DropdownMenu.Item onSelect={() => void signOut()} className={item}>
              <span className="flex items-center gap-2">
                <LogOut aria-hidden className="size-4 text-mute" />
                Sign out
              </span>
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      <NewSpaceDialog open={newSpaceOpen} onOpenChange={setNewSpaceOpen} />
    </header>
  );
}
