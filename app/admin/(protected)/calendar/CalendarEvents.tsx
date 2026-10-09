import Link from "next/link";
import { classifyBlockedTime } from "../../../../lib/booking/calendar-range.ts";
import { describePackage } from "../../../../lib/booking/pricing.ts";
import { AdminStatusBadge, statusStyle } from "../../_components/AdminStatusBadge";
import { Icon, type IconName } from "../../_components/Icon";
import { fmtTime, type BlockedTime, type Booking } from "./calendar-model";

export function packageLabel(packageId: string | null, crewSize: number): string {
  const pkg = describePackage({ packageId, crewSize });
  return pkg.truckCapacity ? `${pkg.packageName} · ${pkg.truckCapacity} · ${crewSize} men` : pkg.packageName;
}

export function blockScope(block: BlockedTime): { label: string; icon: IconName; kind: "global" | "vehicle" | "crew" } {
  const kind = classifyBlockedTime({ vehicleId: block.vehicleId, crewId: block.crewId });
  if (kind === "global") return { label: "Business closed", icon: "ban", kind };
  if (kind === "vehicle") return { label: `Truck: ${block.vehicleName ?? "?"}`, icon: "truck", kind };
  return { label: `Crew: ${block.crewName ?? "?"}`, icon: "crew", kind };
}

function Resources({ booking }: { booking: Booking }) {
  return (
    <span className="a-cal-ev-res">
      <span data-missing={!booking.vehicleName}>
        <Icon name="truck" size={13} />
        {booking.vehicleName ?? "No truck"}
      </span>
      <span data-missing={!booking.crewName}>
        <Icon name="crew" size={13} />
        {booking.crewName ?? "No crew"}
      </span>
    </span>
  );
}

/** Full-detail job card used by the agenda list and the one-day view. */
export function BookingCard({ booking, timezone }: { booking: Booking; timezone: string }) {
  const tone = statusStyle("booking", booking.status).tone;
  return (
    <Link href={`/admin/bookings/${booking.id}`} className="a-cal-card" data-tone={tone}>
      <span className="a-cal-card-time">
        <strong>{fmtTime(booking.startsAt, timezone)}</strong>
        <span>{fmtTime(booking.endsAt, timezone)}</span>
      </span>
      <span className="a-cal-card-main">
        <span className="a-cal-card-name">{booking.customerName ?? "—"}</span>
        <span className="a-cal-card-pkg">{packageLabel(booking.packageId, booking.crewSize)}</span>
        <Resources booking={booking} />
      </span>
      <span className="a-cal-card-side">
        <AdminStatusBadge status={booking.status} />
        <span className="a-cal-card-ref">{booking.bookingNumber}</span>
      </span>
    </Link>
  );
}

export function BlockedCard({ block, timezone }: { block: BlockedTime; timezone: string }) {
  const scope = blockScope(block);
  return (
    <Link href="/admin/availability" className="a-cal-card a-cal-card--blocked" data-scope={scope.kind}>
      <span className="a-cal-card-time">
        <strong>{fmtTime(block.startsAt, timezone)}</strong>
        <span>{fmtTime(block.endsAt, timezone)}</span>
      </span>
      <span className="a-cal-card-main">
        <span className="a-cal-card-name">
          <Icon name={scope.icon} size={15} />
          Blocked · {scope.label}
        </span>
        <span className="a-cal-card-pkg">{block.reason}</span>
      </span>
    </Link>
  );
}

/** Compact event placed inside the time grid. Height decides how much detail fits. */
export function GridEvent({ booking, timezone, heightPx }: { booking: Booking; timezone: string; heightPx: number }) {
  const style = statusStyle("booking", booking.status);
  const size = heightPx >= 96 ? "lg" : heightPx >= 58 ? "md" : "sm";
  return (
    <Link
      href={`/admin/bookings/${booking.id}`}
      className="a-cal-ev"
      data-tone={style.tone}
      data-size={size}
      title={`${booking.customerName ?? "Customer"} · ${style.label}`}
    >
      <span className="a-cal-ev-time">
        {fmtTime(booking.startsAt, timezone)}
        <Icon name={style.icon} size={12} />
        <span className="sr-only">{style.label}</span>
      </span>
      <span className="a-cal-ev-name">{booking.customerName ?? "—"}</span>
      {size !== "sm" && <span className="a-cal-ev-pkg">{packageLabel(booking.packageId, booking.crewSize)}</span>}
      {size === "lg" && <Resources booking={booking} />}
      {size !== "sm" && <span className="a-cal-ev-state" aria-hidden="true">{style.label}</span>}
    </Link>
  );
}

export function GridBlock({ block, timezone }: { block: BlockedTime; timezone: string }) {
  const scope = blockScope(block);
  return (
    <Link href="/admin/availability" className="a-cal-block" data-scope={scope.kind} title={`${scope.label}: ${block.reason}`}>
      <span className="a-cal-block-label">
        <Icon name={scope.icon} size={12} />
        {scope.label}
      </span>
      <span className="a-cal-block-reason">{block.reason}</span>
      <span className="sr-only">{fmtTime(block.startsAt, timezone)} to {fmtTime(block.endsAt, timezone)}</span>
    </Link>
  );
}
