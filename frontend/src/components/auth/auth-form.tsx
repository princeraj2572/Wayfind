"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch, errorMessage, jsonBody } from "@/lib/api";
import { safeNext } from "@/lib/safe-next";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const params = useSearchParams();
  const isRegister = mode === "register";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const next = safeNext(params.get("next"));
  const otherHref = `${isRegister ? "/login" : "/register"}${next ? `?next=${encodeURIComponent(next)}` : ""}`;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (isRegister && password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setPending(true);
    try {
      await apiFetch(`/auth/${mode}`, { method: "POST", body: jsonBody({ email, password }), redirectOn401: false });
      router.replace(next ?? "/ask");
      router.refresh();
    } catch (err) {
      setError(errorMessage(err, "Something went wrong. Try again."));
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div>
        <h1 className="text-xl font-bold tracking-tight">{isRegister ? "Create your account" : "Welcome back"}</h1>
        <p className="mt-1 text-sm text-mute">
          {isRegister ? "Start asking your knowledge base." : "Sign in to ask your knowledge base."}
        </p>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="password" className="text-sm font-medium">
          Password
        </label>
        <Input
          id="password"
          type="password"
          autoComplete={isRegister ? "new-password" : "current-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {isRegister ? <p className="text-xs text-mute">At least 8 characters.</p> : null}
      </div>
      {error ? (
        <p role="alert" className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Please wait…" : isRegister ? "Create account" : "Sign in"}
      </Button>
      <p className="text-center text-sm text-mute">
        {isRegister ? "Already have an account? " : "New here? "}
        <Link href={otherHref} className="font-semibold text-brand-dark hover:underline">
          {isRegister ? "Sign in" : "Create one"}
        </Link>
      </p>
    </form>
  );
}
