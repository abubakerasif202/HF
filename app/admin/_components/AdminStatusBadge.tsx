import { Icon, type IconName } from "./Icon";

/**
 * One badge system for every status the admin shows. Status is always
 * conveyed by the text label (plus an icon) — colour is reinforcement,
 * never the only signal.
 */
export type BadgeTone = "success" | "solid-green" | "info" | "warning" | "ruby" | "danger" | "neutral";

interface StatusStyle {
  label: string;
  tone: BadgeTone;
  icon: IconName;
}

export const BOOKING_STATUS: Record<string, StatusStyle> = {
  draft: { label: "Draft", tone: "neutral", icon: "note" },
  held: { label: "Held", tone: "warning", icon: "clock" },
  pending_payment: { label: "Pending payment", tone: "ruby", icon: "dollar" },
  confirmed: { label: "Confirmed", tone: "success", icon: "check" },
  assigned: { label: "Assigned", tone: "info", icon: "truck" },
  in_progress: { label: "In progress", tone: "warning", icon: "activity" },
  completed: { label: "Completed", tone: "solid-green", icon: "check" },
  cancelled: { label: "Cancelled", tone: "danger", icon: "x" },
  expired: { label: "Expired", tone: "neutral", icon: "ban" },
};

export const PAYMENT_STATUS: Record<string, StatusStyle> = {
  pending: { label: "Payment pending", tone: "ruby", icon: "clock" },
  deposit_paid: { label: "$100 paid", tone: "success", icon: "check" },
  paid: { label: "Paid in full", tone: "solid-green", icon: "check" },
  failed: { label: "Payment failed", tone: "danger", icon: "alert" },
  refunded: { label: "Refunded", tone: "neutral", icon: "arrowLeft" },
  partially_refunded: { label: "Part refunded", tone: "neutral", icon: "arrowLeft" },
};

export const SYNC_STATUS: Record<string, StatusStyle> = {
  synced: { label: "Synced", tone: "success", icon: "check" },
  pending: { label: "Sync pending", tone: "warning", icon: "clock" },
  failed: { label: "Sync failed", tone: "danger", icon: "alert" },
  not_applicable: { label: "Calendar sync off", tone: "neutral", icon: "ban" },
};

const MAPS = { booking: BOOKING_STATUS, payment: PAYMENT_STATUS, sync: SYNC_STATUS } as const;

function humanise(value: string): string {
  const text = value.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function statusStyle(kind: keyof typeof MAPS, status: string): StatusStyle {
  return MAPS[kind][status] ?? { label: humanise(status), tone: "neutral", icon: "clock" };
}

export function AdminStatusBadge({ kind = "booking", status }: { kind?: keyof typeof MAPS; status: string }) {
  const style = statusStyle(kind, status);
  return (
    <span className="admin-badge" data-tone={style.tone}>
      <Icon name={style.icon} size={13} />
      {style.label}
    </span>
  );
}

export function AdminActiveBadge({ active }: { active: boolean }) {
  return (
    <span className="admin-badge" data-tone={active ? "success" : "neutral"}>
      <Icon name={active ? "check" : "ban"} size={13} />
      {active ? "Active" : "Inactive"}
    </span>
  );
}
