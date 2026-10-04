"use client";

import Link from "next/link";
import { useTransition } from "react";
import { assignVehicleAction, assignCrewAction, cancelBookingAction } from "../../actions.ts";
import { describePackage } from "../../../../lib/booking/pricing.ts";
import { AdminStatusBadge } from "../../_components/AdminStatusBadge";
import { formatAdelaide, formatMoney } from "../../_components/ui";

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
  crew_size: number;
  package_id: string | null;
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
  const pkg = describePackage({ packageId: booking.package_id, crewSize: booking.crew_size });
  const packageLabel = pkg.truckCapacity ? `${pkg.packageName} · ${pkg.truckCapacity}` : pkg.packageName;

  return (
    <tr>
      <td data-label="Booking" className="admin-cell-strong">
        <Link href={`/admin/bookings/${booking.id}`} className="admin-link">{booking.booking_number}</Link>
      </td>
      <td data-label="Date" className="whitespace-nowrap">
        <div>
          <div>{formatAdelaide(booking.starts_at, { dateStyle: "medium" })}</div>
          <div className="admin-cell-sub">{formatAdelaide(booking.starts_at, { timeStyle: "short" })}</div>
        </div>
      </td>
      <td data-label="Customer">
        <div>
          <div className="font-semibold">{booking.customers?.name ?? "—"}</div>
          <div className="admin-cell-sub">{booking.customers?.email}</div>
        </div>
      </td>
      <td data-label="Route">{booking.pickup_address?.suburb ?? "—"} → {booking.destination_address?.suburb ?? "—"}</td>
      <td data-label="Truck & crew">
        <div className="admin-resource-stack">
          <div className="admin-cell-sub font-semibold">{packageLabel}</div>
          <select
            disabled={pending}
            defaultValue={booking.vehicle_id ?? ""}
            aria-label={`Truck for booking ${booking.booking_number}`}
            onChange={(e) => startTransition(async () => {
              try {
                await assignVehicleAction(booking.id, e.target.value);
              } catch (err) {
                alert(err instanceof Error && /exclusion/i.test(err.message) ? "That truck is already booked for an overlapping time." : "Could not assign truck.");
              }
            })}
            className="admin-input admin-input--compact"
          >
            <option value="" disabled>No truck</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
          <select
            disabled={pending || booking.booking_status !== "confirmed"}
            defaultValue={booking.crew_id ?? ""}
            aria-label={`Crew for booking ${booking.booking_number}`}
            title={booking.booking_status !== "confirmed" ? "Crew can only be changed while the booking is confirmed" : undefined}
            onChange={(e) => startTransition(async () => {
              try {
                await assignCrewAction(booking.id, e.target.value);
              } catch (err) {
                alert(err instanceof Error && /exclusion/i.test(err.message) ? "That crew is already assigned to an overlapping job." : "Could not assign crew.");
              }
            })}
            className="admin-input admin-input--compact"
          >
            <option value="" disabled>No crew</option>
            {crews.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </td>
      <td data-label="Payment">
        <div>
          <AdminStatusBadge kind="payment" status={booking.payment_status} />
          <div className="admin-cell-sub whitespace-nowrap">
            {booking.deposit_paid_cents > 0 ? `${formatMoney(booking.deposit_paid_cents, { decimals: 0 })} paid` : "No advance payment"} ·{" "}
            <span className={booking.balance_due_cents > 0 ? "font-bold text-[var(--admin-ruby-text)]" : undefined}>
              {formatMoney(booking.balance_due_cents, { decimals: 0 })} due
            </span>
          </div>
        </div>
      </td>
      <td data-label="Status"><AdminStatusBadge status={booking.booking_status} /></td>
      <td>
        {["held", "pending_payment", "confirmed", "assigned"].includes(booking.booking_status) && (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (confirm(`Cancel booking ${booking.booking_number}?`)) {
                startTransition(() => cancelBookingAction(booking.id));
              }
            }}
            className="admin-btn admin-btn--danger admin-btn--sm"
            aria-label={`Cancel booking ${booking.booking_number}`}
          >
            Cancel
          </button>
        )}
      </td>
    </tr>
  );
}
