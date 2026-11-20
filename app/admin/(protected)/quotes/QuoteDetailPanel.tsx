"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { AdminAlert } from "../../_components/ui";
import { QUOTE_STATUS } from "../../_components/AdminStatusBadge";
import { Icon } from "../../_components/Icon";
import {
  LOST_REASONS,
  buildReplyTemplate,
  followUpYmd,
  formatCentsAsDollars,
  parseDollarsToCents,
  type LostReason,
} from "../../../../lib/admin/quote-crm";
import { QUOTE_STATUS_ORDER, type QuoteStatus } from "./quoteStatus";
import { ConvertToBookingForm } from "./ConvertToBookingForm";
import { formatPreferredDate, mailHref, safeSourceUrl, telHref } from "./quoteFormat";
import { MISSING, field, hasValue, type Quote, type QuotePatch } from "./quoteTypes";

const STATUSES: { value: QuoteStatus; label: string }[] = QUOTE_STATUS_ORDER.map((value) => ({ value, label: QUOTE_STATUS[value].label }));

/** Suggested next steps per stage. These only ever change quote_status. */
const NEXT_STEPS: Record<QuoteStatus, { to: QuoteStatus; label: string; primary?: boolean }[]> = {
  new: [{ to: "quote_sent", label: "Mark quote sent", primary: true }, { to: "follow_up", label: "Needs follow-up" }, { to: "lost", label: "Mark lost" }],
  quote_sent: [{ to: "follow_up", label: "Needs follow-up", primary: true }, { to: "booked", label: "Mark booked" }, { to: "lost", label: "Mark lost" }],
  follow_up: [{ to: "booked", label: "Mark booked", primary: true }, { to: "quote_sent", label: "Back to quote sent" }, { to: "lost", label: "Mark lost" }],
  booked: [{ to: "completed", label: "Mark completed", primary: true }, { to: "follow_up", label: "Back to follow-up" }],
  completed: [{ to: "follow_up", label: "Reopen as follow-up" }],
  lost: [{ to: "new", label: "Reopen as new", primary: true }],
};

const DETAIL_FIELDS: { key: string; label: string }[] = [
  { key: "move_category", label: "Move category" },
  { key: "move_type", label: "Move type" },
  { key: "truck_package_id", label: "Truck selection" },
  { key: "property_size", label: "Property size" },
  { key: "floor_access", label: "Floor access" },
  { key: "parking_access", label: "Parking" },
  { key: "boxes_needed", label: "Boxes" },
  { key: "services[]", label: "Extra services" },
];

function ContactButton({ icon, label, value, href }: { icon: "phone" | "mail"; label: string; value: string; href: string | null }) {
  return (
    <a className="a-contact-btn" href={href ?? undefined} aria-disabled={href ? undefined : true} tabIndex={href ? undefined : -1}>
      <Icon name={icon} size={20} />
      <span>
        <span className="a-contact-label" style={{ display: "block" }}>{label}</span>
        <span className="a-contact-value" style={{ display: "block" }}>{hasValue(value) ? value : "Not provided"}</span>
      </span>
    </a>
  );
}

/** Notes, follow-up date and quoted amount. Remounted per enquiry (key) so edits never leak between rows. */
function WorkingNotes({ quote, pending, onPatch }: { quote: Quote; pending: boolean; onPatch: (patch: QuotePatch) => void }) {
  const [notes, setNotes] = useState(quote.notes ?? "");
  const [followUp, setFollowUp] = useState(followUpYmd(quote.follow_up_at));
  const [amount, setAmount] = useState(quote.quoted_amount_cents === null ? "" : formatCentsAsDollars(quote.quoted_amount_cents));
  const [formError, setFormError] = useState<string | null>(null);
  const showAmount = quote.quote_status === "quote_sent";

  function save(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    const patch: QuotePatch = {};
    if (notes.trim() !== (quote.notes ?? "")) patch.notes = notes.trim() || null;
    if (followUp !== followUpYmd(quote.follow_up_at)) patch.follow_up_at = followUp || null;
    if (showAmount) {
      const cents = parseDollarsToCents(amount);
      if (cents === "invalid") {
        setFormError("Enter the quoted amount in dollars, for example 850 or 850.50.");
        return;
      }
      if (cents !== quote.quoted_amount_cents) patch.quoted_amount_cents = cents;
    }
    if (Object.keys(patch).length === 0) {
      setFormError("Nothing has changed.");
      return;
    }
    onPatch(patch);
  }

  return (
    <form className="a-q-form" onSubmit={save}>
      <label className="admin-field">
        <span className="admin-label">Follow-up date</span>
        <input className="admin-input" type="date" value={followUp} onChange={(event) => setFollowUp(event.target.value)} disabled={pending} />
        <span className="admin-help">Shows under Follow-ups due on this day, and under Overdue after it.</span>
      </label>
      {showAmount && (
        <label className="admin-field">
          <span className="admin-label">Quoted amount (AUD)</span>
          <input className="admin-input" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="e.g. 850.00" disabled={pending} />
        </label>
      )}
      {!showAmount && quote.quoted_amount_cents !== null && (
        <p className="admin-help" style={{ margin: 0 }}>Quoted amount: ${formatCentsAsDollars(quote.quoted_amount_cents)}</p>
      )}
      <label className="admin-field">
        <span className="admin-label">Notes</span>
        <textarea className="admin-input" maxLength={4000} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Private notes. Never shown to the customer." disabled={pending} />
      </label>
      {formError && <AdminAlert tone="error">{formError}</AdminAlert>}
      <div className="a-q-actions">
        <button type="submit" className="admin-btn admin-btn--primary admin-btn--sm" disabled={pending}>{pending ? "Saving…" : "Save notes and follow-up"}</button>
      </div>
    </form>
  );
}

export function QuoteDetailPanel({ quote, pending, notice, onPatch, onConverted }: {
  quote: Quote;
  pending: boolean;
  notice: { tone: "success" | "error"; text: string } | null;
  onPatch: (patch: QuotePatch) => void;
  onConverted: (quote: Quote, bookingNumber: string) => void;
}) {
  const [choosingLost, setChoosingLost] = useState(false);
  const [lostReason, setLostReason] = useState<LostReason>("no_response");
  const [converting, setConverting] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const replyText = buildReplyTemplate(quote.payload);

  function requestStatus(to: QuoteStatus) {
    if (to === "lost") {
      setChoosingLost(true);
      return;
    }
    setChoosingLost(false);
    onPatch({ quote_status: to });
  }

  async function copyReply() {
    try {
      await navigator.clipboard.writeText(replyText);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }

  return (
    <>
      <section className="a-drawer-section">
        <h3 className="a-drawer-section-title">Contact</h3>
        <div className="a-contact-row">
          <ContactButton icon="phone" label="Call" value={field(quote, "phone")} href={telHref(field(quote, "phone"))} />
          <ContactButton icon="mail" label="Email" value={field(quote, "email")} href={mailHref(field(quote, "email"))} />
        </div>
        <div className="a-q-copy">
          <button type="button" className="admin-btn admin-btn--secondary admin-btn--sm" onClick={() => void copyReply()}>
            <Icon name="copy" size={15} />Copy reply
          </button>
          <span className="admin-help" role="status" style={{ marginLeft: 10 }}>
            {copyState === "copied" ? "Copied. Paste it into your email or text." : copyState === "failed" ? "Could not copy. Select the text below instead." : "Plain text only. Nothing is sent."}
          </span>
          {copyState === "failed" && <textarea className="admin-input a-q-reply" readOnly value={replyText} aria-label="Reply text to copy" style={{ marginTop: 10 }} />}
        </div>
      </section>

      <section className="a-drawer-section">
        <h3 className="a-drawer-section-title">The move</h3>
        <div className="a-route" style={{ marginBottom: 14 }}>
          <span className="a-route-stop" style={{ whiteSpace: "normal" }}>{field(quote, "moving_from")}</span>
          <span className="a-route-stop" style={{ whiteSpace: "normal" }}>{field(quote, "moving_to")}</span>
        </div>
        <dl className="admin-dl">
          <div className="admin-dl-row"><dt>Preferred date</dt><dd>{(() => { const v = field(quote, "preferred_moving_date"); if (!hasValue(v)) return MISSING; const f = formatPreferredDate(v); return f.soon ? `${f.text} · ${f.soon}` : f.text; })()}</dd></div>
          {DETAIL_FIELDS.map(({ key, label }) => (
            <div className="admin-dl-row" key={key}><dt>{label}</dt><dd>{field(quote, key)}</dd></div>
          ))}
        </dl>
      </section>

      {hasValue(field(quote, "details")) && (
        <section className="a-drawer-section">
          <h3 className="a-drawer-section-title">Job details from the customer</h3>
          <pre className="admin-note-box">{field(quote, "details")}</pre>
        </section>
      )}

      <section className="a-drawer-section">
        <h3 className="a-drawer-section-title">Follow-up</h3>
        <div className="a-next-steps" role="group" aria-label="Suggested next steps">
          {NEXT_STEPS[quote.quote_status].map((nextStep) => (
            <button key={nextStep.to} type="button" className="a-step" data-primary={nextStep.primary || undefined} disabled={pending} onClick={() => requestStatus(nextStep.to)}>
              <Icon name={QUOTE_STATUS[nextStep.to].icon} size={16} />
              {nextStep.label}
            </button>
          ))}
        </div>
        <label className="admin-field" style={{ marginTop: 16 }}>
          <span className="admin-label">Set status directly</span>
          <select
            className="admin-input"
            aria-label={`Follow-up status for ${field(quote, "name")}`}
            value={quote.quote_status}
            disabled={pending}
            onChange={(event) => requestStatus(event.target.value as QuoteStatus)}
          >
            {STATUSES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>

        {choosingLost && (
          <div className="a-q-form" style={{ marginTop: 16 }} role="group" aria-label="Mark as lost">
            <label className="admin-field">
              <span className="admin-label">Why was it lost?</span>
              <select className="admin-input" value={lostReason} onChange={(event) => setLostReason(event.target.value as LostReason)}>
                {LOST_REASONS.map((reason) => <option key={reason.value} value={reason.value}>{reason.label}</option>)}
              </select>
            </label>
            <div className="a-q-actions">
              <button type="button" className="admin-btn admin-btn--primary admin-btn--sm" disabled={pending} onClick={() => { setChoosingLost(false); onPatch({ quote_status: "lost", lost_reason: lostReason }); }}>Mark lost</button>
              <button type="button" className="admin-btn admin-btn--ghost admin-btn--sm" onClick={() => setChoosingLost(false)}>Cancel</button>
            </div>
          </div>
        )}

        {quote.quote_status === "lost" && !choosingLost && (
          <label className="admin-field" style={{ marginTop: 16 }}>
            <span className="admin-label">Lost reason</span>
            <select
              className="admin-input"
              value={quote.lost_reason ?? ""}
              disabled={pending}
              onChange={(event) => onPatch({ lost_reason: (event.target.value || null) as LostReason | null })}
            >
              <option value="">Not recorded</option>
              {LOST_REASONS.map((reason) => <option key={reason.value} value={reason.value}>{reason.label}</option>)}
            </select>
          </label>
        )}
        {notice && <div style={{ marginTop: 12 }}><AdminAlert tone={notice.tone === "success" ? "success" : "error"}>{notice.text}</AdminAlert></div>}
      </section>

      <section className="a-drawer-section">
        <h3 className="a-drawer-section-title">Notes and follow-up date</h3>
        <WorkingNotes key={quote.id} quote={quote} pending={pending} onPatch={onPatch} />
      </section>

      <section className="a-drawer-section">
        <h3 className="a-drawer-section-title">Booking</h3>
        {quote.booking ? (
          <p className="a-q-linked" style={{ margin: 0 }}>
            <Icon name="calendarCheck" size={16} />
            <span>Linked booking <Link className="admin-link" href={`/admin/bookings/${quote.booking.id}`}>{quote.booking.booking_number}</Link></span>
          </p>
        ) : converting ? (
          <ConvertToBookingForm quote={quote} onCancel={() => setConverting(false)} onConverted={(next, bookingNumber) => { setConverting(false); onConverted(next, bookingNumber); }} />
        ) : (
          <>
            <p className="admin-help" style={{ marginTop: 0 }}>Turn this enquiry into a held booking and mark it booked. Dates, trucks and conflicts are checked for you.</p>
            <button type="button" className="admin-btn admin-btn--secondary admin-btn--sm" onClick={() => setConverting(true)} disabled={pending}>
              <Icon name="calendarCheck" size={15} />Convert to booking draft
            </button>
          </>
        )}
      </section>

      <section className="a-drawer-section">
        <h3 className="a-drawer-section-title">Original submission</h3>
        <dl className="admin-dl">
          <div className="admin-dl-row">
            <dt>Form source</dt>
            <dd>{(() => { const value = field(quote, "source_page"); const href = hasValue(value) ? safeSourceUrl(value) : null; return href ? <a className="admin-link" href={href} target="_blank" rel="noopener noreferrer">{value}</a> : value; })()}</dd>
          </div>
          <div className="admin-dl-row"><dt>Email delivery verification</dt><dd>{quote.delivery_status === "unknown" ? "Not verified" : quote.delivery_status}</dd></div>
          <div className="admin-dl-row"><dt>Reference</dt><dd className="is-mono">{quote.id}</dd></div>
        </dl>
      </section>
    </>
  );
}
