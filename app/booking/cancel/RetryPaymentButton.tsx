"use client";

import { useState } from "react";

export function RetryPaymentButton({ bookingId, accessToken }: { bookingId: string; accessToken: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function retry() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/booking/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, accessToken }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not resume payment");
      window.location.href = data.checkoutUrl;
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <div>
      <button onClick={retry} disabled={loading} className="rounded-full bg-neutral-900 px-6 py-3 text-white disabled:opacity-40">
        {loading ? "Redirecting…" : "Retry payment"}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
