"use client";

import Link from "next/link";
import { useTransition } from "react";
import { assignVehicleAction, assignCrewAction, cancelBookingAction } from "../../actions.ts";
import { describePackage } from "../../../../lib/booking/pricing.ts";
import { AdminStatusBadge } from "../../_components/AdminStatusBadge";
import { Icon } from "../../_components/Icon";
import { formatAdelaide, formatMoney } from "../../_components/ui";
import { shortPlace, type AddressJson } from "./places";

interface Resource {
  id: string;
  name: string;
}

export interface BookingListItem {
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
  pickup_address: AddressJson;
  destination_address: AddressJson;
  customers: { name: string; email: string; phone: string | null } | null;
}

const CANCELLABLE = ["held", "pending_payment", "confirmed", "assigned"];
const INACTIVE = ["cancelled", "expired"];

export function BookingRow({ booking, vehicles, crews, index = 0 }: { booking: BookingListItem; vehicles: Resource[]; crews: Resource[]; index?: number }) {
  const [pending, startTransition] = useTransition();
  const pkg = describePackage({ packageId: booking.package_id, crewSize: booking.crew_size });
  const packageLabel = pkg.truckCapacity ? `${pkg.packageName} · ${pkg.truckCapacity}` : pkg.packageName;
  const owing = booking.balance_due_cents > 0;

  return (
    <li
      className="a-bk-row a-reveal"
      data-dim={INACTIVE.includes(booking.booking_status) ? "true" : undefined}
      style={{ "--i": Math.min(index, 10) } as React.CSSProperties}
    >
      <div className="a-bk-when">
        <span className="a-bk-wday">{formatAdelaide(booking.starts_at, { weekday: "short" })}</span>
        <span className="a-bk-day">{formatAdelaide(booking.starts_at, { day: "numeric" })}</span>
        <span className="a-bk-mon">{formatAdelaide(booking.starts_at, { month: "short" })}</span>
        <span className="a-bk-time">{formatAdelaide(booking.starts_at, { timeStyle: "short" })}</span>
      </div>

      <div className="a-bk-main">
        <div className="a-bk-who">
          <Link href={`/admin/bookings/${booking.id}`} className="a-bk-name">{booking.customers?.name ?? "Customer"}</Link>
          <span className="a-id">{booking.booking_number}</span>
        </div>
        {booking.customers?.email && <div className="a-bk-contact">{booking.customers.email}</div>}
        <div className="a-bk-route" aria-label="Route">
          <span className="a-bk-stop">{shortPlace(booking.pickup_address)}</span>
          <Icon name="arrowRight" size={14} />
          <span className="a-bk-stop">{shortPlace(booking.destination_address)}</span>
        </div>
        <div className="a-bk-pkg"><Icon name="truck" size={14} />{packageLabel}</div>
      </div>

      <div className="a-bk-status">
        <AdminStatusBadge status={booking.booking_status} />
        <AdminStatusBadge kind="payment" status={booking.payment_status} />
        <div className="a-bk-money">
          {booking.deposit_paid_cents > 0 ? `${formatMoney(booking.deposit_paid_cents, { decimals: 0 })} paid` : "No advance payment"}
          {" · "}
          <span data-owing={owing || undefined}>{formatMoney(booking.balance_due_cents, { decimals: 0 })} due</span>
        </div>
      </div>

      <div className="a-bk-assign">
        <label className="a-bk-field" data-missing={(!booking.vehicle_id && ["held", "confirmed", "assigned"].includes(booking.booking_status)) || undefined}>
          <span className="a-bk-field-label"><Icon name="truck" size={13} />Truck</span>
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
        </label>
        <label className="a-bk-field" data-missing={(!booking.crew_id && booking.booking_status === "confirmed") || undefined}>
          <span className="a-bk-field-label"><Icon name="crew" size={13} />Crew</span>
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
        </label>
      </div>

      <div className="a-bk-actions">
        <Link href={`/admin/bookings/${booking.id}`} className="admin-btn admin-btn--secondary admin-btn--sm" aria-label={`Open booking ${booking.booking_number}`}>
          Open
          <Icon name="chevronRight" size={15} />
        </Link>
        {CANCELLABLE.includes(booking.booking_status) && (
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
      </div>
    </li>
  );
}
