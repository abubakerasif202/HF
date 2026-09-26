"use client";

import Link from "next/link";
import { useTransition } from "react";
import { assignVehicleAction, assignCrewAction, cancelBookingAction } from "../../actions.ts";

interface Resource {
  id: string;
  name: string;
}

interface Booking {
  id: string;
  booking_number: string;
  starts_at: string;
  booking_status: string;
  payment_status: string;
  vehicle_id: string | null;
  crew_id: string | null;
  subtotal_cents: number;
  deposit_paid_cents: number;
  balance_due_cents: number;
  pickup_address: { suburb?: string } | null;
  destination_address: { suburb?: string } | null;
  customers: { name: string; email: string; phone: string | null } | null;
}

export function BookingRow({ booking, vehicles, crews }: { booking: Booking; vehicles: Resource[]; crews: Resource[] }) {
  const [pending, startTransition] = useTransition();

  return (
    <tr className="border-b align-top">
      <td className="py-2 font-medium">
        <Link href={`/admin/bookings/${booking.id}`} className="underline">{booking.booking_number}</Link>
      </td>
      <td>{new Date(booking.starts_at).toLocaleString("en-AU", { timeZone: "Australia/Adelaide", dateStyle: "medium", timeStyle: "short" })}</td>
      <td>
        <div>{booking.customers?.name}</div>
        <div className="text-xs text-neutral-400">{booking.customers?.email}</div>
      </td>
      <td>{booking.pickup_address?.suburb ?? "—"} → {booking.destination_address?.suburb ?? "—"}</td>
      <td>
        <select
          disabled={pending}
          defaultValue={booking.vehicle_id ?? ""}
          onChange={(e) => startTransition(async () => {
            try {
              await assignVehicleAction(booking.id, e.target.value);
            } catch (err) {
              alert(err instanceof Error && /exclusion/i.test(err.message) ? "That truck is already booked for an overlapping time." : "Could not assign truck.");
            }
          })}
          className="rounded border px-2 py-1"
        >
          <option value="" disabled>Unassigned</option>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>{v.name}</option>
          ))}
        </select>
      </td>
      <td>
        <select
          disabled={pending || booking.booking_status !== "confirmed"}
          defaultValue={booking.crew_id ?? ""}
          onChange={(e) => startTransition(async () => {
            try {
              await assignCrewAction(booking.id, e.target.value);
            } catch (err) {
              alert(err instanceof Error && /exclusion/i.test(err.message) ? "That crew is already assigned to an overlapping job." : "Could not assign crew.");
            }
          })}
          className="rounded border px-2 py-1"
        >
          <option value="" disabled>Unassigned</option>
          {crews.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </td>
      <td>
        <div>{booking.payment_status}</div>
        <div className="text-xs text-neutral-400">
          ${(booking.deposit_paid_cents / 100).toFixed(0)} paid / ${(booking.balance_due_cents / 100).toFixed(0)} due
        </div>
      </td>
      <td><StatusBadge status={booking.booking_status} /></td>
      <td>
        {["held", "pending_payment", "confirmed", "assigned"].includes(booking.booking_status) && (
          <button
            disabled={pending}
            onClick={() => {
              if (confirm(`Cancel booking ${booking.booking_number}?`)) {
                startTransition(() => cancelBookingAction(booking.id));
              }
            }}
            className="text-xs text-red-600 underline"
          >
            Cancel
          </button>
        )}
      </td>
    </tr>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    confirmed: "bg-green-100 text-green-700",
    assigned: "bg-blue-100 text-blue-700",
    held: "bg-amber-100 text-amber-700",
    pending_payment: "bg-amber-100 text-amber-700",
    cancelled: "bg-neutral-100 text-neutral-500",
    expired: "bg-neutral-100 text-neutral-500",
    completed: "bg-neutral-800 text-white",
  };
  return <span className={`rounded-full px-2 py-1 text-xs ${colors[status] ?? "bg-neutral-100"}`}>{status}</span>;
}
