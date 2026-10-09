import Link from "next/link";
import { AdminStatusBadge } from "../../../_components/AdminStatusBadge";
import { Icon } from "../../../_components/Icon";
import { formatAdelaide } from "../../../_components/ui";
import { fullAddress, shortPlace, type AddressJson } from "../places";

const TRACK = [
  { key: "confirmed", label: "Confirmed" },
  { key: "assigned", label: "Assigned" },
  { key: "in_progress", label: "In progress" },
  { key: "completed", label: "Completed" },
] as const;

/** Lifecycle progress for the normal happy path. Other states (held, cancelled…) show no track. */
function StatusTrack({ status }: { status: string }) {
  const current = TRACK.findIndex((step) => step.key === status);
  if (current === -1) return null;
  return (
    <ol className="a-bk-track" aria-label="Booking progress">
      {TRACK.map((step, index) => (
        <li key={step.key} data-state={index < current ? "done" : index === current ? "current" : "todo"} aria-current={index === current ? "step" : undefined}>
          <span className="a-bk-track-dot" aria-hidden="true">{index < current ? <Icon name="check" size={12} /> : null}</span>
          {step.label}
        </li>
      ))}
    </ol>
  );
}

interface HeroProps {
  bookingNumber: string;
  createdAt: string;
  status: string;
  paymentStatus: string;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  customer: { name?: string | null; email?: string | null; phone?: string | null } | null;
  pickup: AddressJson;
  destination: AddressJson;
  packageSummary: string;
  vehicleName: string | null;
  crewName: string | null;
}

function Stop({ kind, address }: { kind: "Pickup" | "Destination"; address: AddressJson }) {
  const detail = fullAddress(address);
  return (
    <div className="a-bk-stop-card" data-kind={kind.toLowerCase()}>
      <span className="a-bk-stop-label">{kind}</span>
      <span className="a-bk-stop-place">{shortPlace(address)}</span>
      {detail && detail !== shortPlace(address) && <span className="a-bk-stop-detail">{detail}</span>}
    </div>
  );
}

export function BookingHero(props: HeroProps) {
  const { customer } = props;
  return (
    <section className="a-bk-hero" aria-labelledby="bk-hero-title">
      <svg className="a-bk-hero-art" viewBox="0 0 1200 420" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
        <circle cx="1040" cy="90" r="140" />
        <circle cx="1040" cy="90" r="220" />
        <path d="M-60 380C250 260 520 290 770 180S1120 60 1290 100" />
      </svg>

      <div className="a-bk-hero-top">
        <div>
          <p className="a-bk-hero-eyebrow">Booking · created {formatAdelaide(props.createdAt, { dateStyle: "medium" })}</p>
          <h1 id="bk-hero-title" className="a-bk-hero-number">{props.bookingNumber}</h1>
        </div>
        <div className="a-bk-hero-badges">
          <AdminStatusBadge status={props.status} />
          <AdminStatusBadge kind="payment" status={props.paymentStatus} />
        </div>
      </div>

      <StatusTrack status={props.status} />

      <div className="a-bk-hero-grid">
        <div className="a-bk-hero-block">
          <p className="a-bk-hero-label">Customer</p>
          <p className="a-bk-hero-customer">{customer?.name ?? "Customer"}</p>
          <div className="a-bk-hero-contact">
            {customer?.phone && (
              <a href={`tel:${customer.phone}`}><Icon name="phone" size={15} />{customer.phone}</a>
            )}
            {customer?.email && (
              <a href={`mailto:${customer.email}`}><Icon name="mail" size={15} />{customer.email}</a>
            )}
          </div>
        </div>

        <div className="a-bk-hero-block">
          <p className="a-bk-hero-label">When</p>
          <p className="a-bk-hero-when">{formatAdelaide(props.startsAt, { weekday: "long", day: "numeric", month: "long" })}</p>
          <p className="a-bk-hero-sub">
            {formatAdelaide(props.startsAt, { timeStyle: "short" })} – {formatAdelaide(props.endsAt, { timeStyle: "short" })}
            {" · "}est. {props.durationMinutes} min
          </p>
        </div>

        <div className="a-bk-hero-block">
          <p className="a-bk-hero-label">Truck &amp; crew</p>
          <p className="a-bk-hero-sub a-bk-hero-sub--lead">{props.packageSummary}</p>
          <p className="a-bk-hero-assign">
            <span data-missing={!props.vehicleName || undefined}><Icon name="truck" size={15} />{props.vehicleName ?? "No truck yet"}</span>
            <span data-missing={!props.crewName || undefined}><Icon name="crew" size={15} />{props.crewName ?? "No crew yet"}</span>
          </p>
          <Link href="/admin/bookings" className="a-bk-hero-link">Reassign from the list</Link>
        </div>
      </div>

      <div className="a-bk-stops" aria-label="Route">
        <Stop kind="Pickup" address={props.pickup} />
        <span className="a-bk-stops-line" aria-hidden="true"><Icon name="route" size={18} /></span>
        <Stop kind="Destination" address={props.destination} />
      </div>
    </section>
  );
}
