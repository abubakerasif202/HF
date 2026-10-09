"use client";

import { useState, useTransition } from "react";
import { signInAction } from "../actions.ts";
import { AdminAlert } from "../_components/ui";
import { ADMIN_LOGIN_EMAIL } from "../../../lib/admin-access.ts";

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="mt-7 grid gap-4"
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const result = await signInAction(formData);
          if (result?.error) setError(result.error);
        });
      }}
    >
      <label className="admin-field">
        <span className="admin-label">Email</span>
        <input name="email" type="email" autoComplete="username" defaultValue={ADMIN_LOGIN_EMAIL} readOnly required className="admin-input" aria-invalid={error ? true : undefined} />
      </label>
      <label className="admin-field">
        <span className="admin-label">Password</span>
        <input name="password" type="password" autoComplete="current-password" required className="admin-input" aria-invalid={error ? true : undefined} />
      </label>
      {error && <AdminAlert tone="error">{error}</AdminAlert>}
      <button type="submit" disabled={pending} className="admin-btn admin-btn--primary admin-btn--block mt-1">
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
