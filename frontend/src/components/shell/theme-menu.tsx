"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { parsePref, useTheme } from "@/lib/theme";

const OPTIONS = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
] as const;

/** Theme radio group for use inside a Radix dropdown menu (account menu and mobile menu). */
export function ThemeMenuItems({ itemClass }: { itemClass: string }) {
  const [pref, setPref] = useTheme();
  return (
    <>
      <DropdownMenu.Label className="px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-mute">
        Theme
      </DropdownMenu.Label>
      <DropdownMenu.RadioGroup value={pref} onValueChange={(value) => setPref(parsePref(value))}>
        {OPTIONS.map(({ value, label, Icon }) => (
          <DropdownMenu.RadioItem key={value} value={value} className={itemClass}>
            <span className="flex items-center gap-2">
              <Icon aria-hidden className="size-4 text-mute" />
              {label}
            </span>
            <DropdownMenu.ItemIndicator>
              <Check aria-hidden className="size-4 text-brand-dark" />
            </DropdownMenu.ItemIndicator>
          </DropdownMenu.RadioItem>
        ))}
      </DropdownMenu.RadioGroup>
    </>
  );
}
