"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronDown, LogOut } from "lucide-react";
import { useMe } from "@/lib/queries";
import { useSignOut } from "@/lib/use-sign-out";

export function UserMenu() {
  const signOut = useSignOut();
  const me = useMe();
  const email = me.data?.email ?? "";

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label="Account menu"
        className="flex w-full items-center gap-2.5 rounded-lg p-2 text-left hover:bg-white focus-visible:outline-2 focus-visible:outline-brand"
      >
        <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-full bg-brand text-xs font-semibold text-white">
          {email.charAt(0).toUpperCase() || "?"}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{email || "Account"}</span>
        <ChevronDown aria-hidden className="size-4 shrink-0 text-mute" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side="top"
          align="start"
          sideOffset={6}
          className="z-50 min-w-48 rounded-lg border border-line bg-white p-1 shadow-lg"
        >
          <DropdownMenu.Item
            onSelect={signOut}
            className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-sm outline-none data-[highlighted]:bg-panel"
          >
            <LogOut aria-hidden className="size-4 text-mute" />
            Sign out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
