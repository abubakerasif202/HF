"use client";

import { useState, useTransition } from "react";
import { signInAction } from "../actions.ts";

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="mt-8 space-y-4"
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const result = await signInAction(formData);
          if (result?.error) setError(result.error);
        });
      }}
    >
      <label className="block">
        <span className="text-sm font-medium">Email</span>
        <input name="email" type="email" required className="mt-1 w-full rounded-lg border px-3 py-2" />
      </label>
      <label className="block">
        <span className="text-sm font-medium">Password</span>
        <input name="password" type="password" required className="mt-1 w-full rounded-lg border px-3 py-2" />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={pending} className="w-full rounded-full bg-neutral-900 px-6 py-3 text-white disabled:opacity-40">
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
