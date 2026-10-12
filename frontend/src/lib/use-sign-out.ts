"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

/** Ends the session: clears the cookie server-side, drops every cached query, returns to the login page. */
export function useSignOut() {
  const router = useRouter();
  const client = useQueryClient();
  return async function signOut() {
    await apiFetch("/auth/logout", { method: "POST", redirectOn401: false }).catch(() => undefined);
    await client.cancelQueries();
    client.clear();
    router.replace("/login");
    router.refresh();
  };
}
