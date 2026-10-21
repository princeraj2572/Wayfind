"use client";

import { useSyncExternalStore } from "react";

export type ThemePref = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_KEY = "wayfind_theme";
const CHANGE_EVENT = "wayfind-theme-change";

export function parsePref(value: unknown): ThemePref {
  return value === "light" || value === "dark" || value === "system" ? value : "system";
}

export function resolveTheme(pref: ThemePref, prefersDark: boolean): ResolvedTheme {
  return pref === "system" ? (prefersDark ? "dark" : "light") : pref;
}

const systemPrefersDark = () =>
  typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-color-scheme: dark)").matches
    : false;

export function readPref(): ThemePref {
  try {
    return parsePref(localStorage.getItem(THEME_KEY));
  } catch {
    return "system";
  }
}

export function writePref(pref: ThemePref) {
  try {
    localStorage.setItem(THEME_KEY, pref);
  } catch {
    /* storage blocked: the choice still applies until the page is closed */
  }
}

export function applyTheme(pref: ThemePref) {
  const theme = resolveTheme(pref, systemPrefersDark());
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

/**
 * Runs from <head> before the page paints so a dark-mode user never sees a light flash.
 * Kept dependency-free and defensive: it must never throw, and it mirrors readPref + applyTheme.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var p=null;try{p=localStorage.getItem("${THEME_KEY}")}catch(e){}var d=false;try{d=window.matchMedia("(prefers-color-scheme: dark)").matches}catch(e){}var t=p==="dark"||(p!=="light"&&d)?"dark":"light";var r=document.documentElement;r.dataset.theme=t;r.style.colorScheme=t}catch(e){}})();`;

function subscribe(onChange: () => void) {
  const media = typeof window.matchMedia === "function" ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  const sync = () => {
    applyTheme(readPref());
    onChange();
  };
  window.addEventListener(CHANGE_EVENT, sync);
  window.addEventListener("storage", sync); // another tab changed it
  media?.addEventListener?.("change", sync); // the OS switched while on "system"
  return () => {
    window.removeEventListener(CHANGE_EVENT, sync);
    window.removeEventListener("storage", sync);
    media?.removeEventListener?.("change", sync);
  };
}

// A string, so React can compare snapshots by value without caching.
const getSnapshot = readPref;

/** The saved preference and a setter that stores it, applies it and tells every listener. */
export function useTheme(): [ThemePref, (pref: ThemePref) => void] {
  const pref = useSyncExternalStore(subscribe, getSnapshot, () => "system" as ThemePref);
  const set = (next: ThemePref) => {
    writePref(next);
    applyTheme(next);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  };
  return [pref, set];
}
