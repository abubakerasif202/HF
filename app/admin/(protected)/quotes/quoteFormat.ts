import { MISSING, hasValue } from "./quoteTypes";

export function initialsOf(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (!hasValue(name) || parts.length === 0) return "?";
  return ((parts[0][0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "")).toUpperCase();
}

/** tel: target only when the value contains a plausible number (never "tel:—"). */
export function telHref(phone: string): string | null {
  const digits = phone.replace(/[^\d+]/g, "");
  return digits.replace(/\D/g, "").length >= 6 ? `tel:${digits}` : null;
}

export function mailHref(email: string): string | null {
  return /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(email) ? `mailto:${email}` : null;
}

/** Customer-supplied URL: link only http(s) pages on the HF domain. Anything else shows as plain text. */
export function safeSourceUrl(value: string): string | null {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const ours = host === "hfremovalsadelaide.com.au" || host.endsWith(".hfremovalsadelaide.com.au");
    return (url.protocol === "https:" || url.protocol === "http:") && ours ? url.toString() : null;
  } catch {
    return null;
  }
}

export function formatPreferredDate(value: string): { text: string; soon: string | null } {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return { text: value, soon: null };
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  const text = date.toLocaleDateString("en-AU", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short", year: "numeric" });
  const today = new Date();
  const days = Math.round((date.getTime() - Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())) / 86_400_000);
  const soon = days === 0 ? "Today" : days === 1 ? "Tomorrow" : days > 1 && days <= 14 ? `In ${days} days` : days < 0 ? "Date passed" : null;
  return { text, soon };
}

/** "Fri 12 Dec" for a YYYY-MM-DD follow-up date. */
export function shortDate(ymd: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!match) return MISSING;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))).toLocaleDateString("en-AU", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });
}
