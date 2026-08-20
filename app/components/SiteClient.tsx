"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { business, nav } from "../../lib/site-data";

export function OpeningSequence() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const seen = window.sessionStorage.getItem("hf-intro-seen");
    if (!reduce && !seen) {
      window.sessionStorage.setItem("hf-intro-seen", "true");
      const show = window.setTimeout(() => setVisible(true), 0);
      const timer = window.setTimeout(() => setVisible(false), 2300);
      return () => {
        window.clearTimeout(show);
        window.clearTimeout(timer);
      };
    }
    return undefined;
  }, []);

  if (!visible) return null;
  return (
    <div className="opening" aria-hidden="true">
      <div className="opening-glow" />
      <img src={business.logo} alt="" width="1679" height="937" className="opening-logo" />
      <p>{business.tagline}</p>
      <span className="opening-line" />
    </div>
  );
}

export function Header() {
  const [open, setOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  const firstLink = useRef<HTMLAnchorElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onScroll = () => setCompact(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("menu-locked", open);
    const focusTimer = open ? window.setTimeout(() => firstLink.current?.focus(), 0) : undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && open) {
        setOpen(false);
        window.setTimeout(() => toggle.current?.focus(), 0);
      }
      if (event.key === "Tab" && open && menu.current) {
        const focusable = Array.from(menu.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'));
        const first = focusable[0];
        const last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      if (focusTimer !== undefined) window.clearTimeout(focusTimer);
      document.body.classList.remove("menu-locked");
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <header className={`site-header ${compact ? "is-compact" : ""}`}>
      <div className="header-inner">
        <a className="brand" href="/" aria-label="HF Removals Adelaide home">
          <img src={business.headerLogo} alt="" width="320" height="164" />
          <span className="brand-copy"><strong>HF Removals</strong><small>Adelaide</small></span>
        </a>
        <nav className="desktop-nav" aria-label="Primary navigation">
          {nav.map((item) => <a key={item.href} href={item.href}>{item.label}</a>)}
        </nav>
        <div className="header-actions">
          <a className="phone-chip" href={business.phones[0].href} aria-label={`Call ${business.phones[0].display}`}>
            <span>Call</span><strong>{business.phones[0].display}</strong>
          </a>
          <a className="button button-ruby header-quote" href="/#quote">Free quote</a>
          <button ref={toggle} className="menu-toggle" type="button" aria-expanded={open} aria-controls="mobile-menu" onClick={() => setOpen((value) => !value)}>
            <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
            <span /><span /><span />
          </button>
        </div>
      </div>
      <div ref={menu} id="mobile-menu" className={`mobile-menu ${open ? "is-open" : ""}`} aria-hidden={!open} role="dialog" aria-modal="true" aria-label="Mobile navigation">
        <nav aria-label="Mobile navigation">
          {nav.map((item, index) => (
            <a ref={index === 0 ? firstLink : undefined} key={item.href} href={item.href} onClick={() => setOpen(false)}>{item.label}<span>↗</span></a>
          ))}
          <a href={business.phones[0].href}>Call {business.phones[0].display}<span>→</span></a>
          <a className="button button-ruby" href="/#quote" onClick={() => setOpen(false)}>Get a free quote</a>
        </nav>
      </div>
    </header>
  );
}

type FormDataShape = {
  name: string; phone: string; email: string; date: string; from: string; to: string;
  moveType: string; propertySize: string; details: string; company: string; startedAt: number;
};

const createEmptyForm = (): FormDataShape => ({ name: "", phone: "", email: "", date: "", from: "", to: "", moveType: "", propertySize: "", details: "", company: "", startedAt: Date.now() });

export function QuoteForm({ compact = false }: { compact?: boolean }) {
  const [form, setForm] = useState<FormDataShape>(() => createEmptyForm());
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const update = (field: keyof FormDataShape, value: string) => setForm((current) => ({ ...current, [field]: value }));

  const openEmailFallback = () => {
    const subject = encodeURIComponent(`Move quote request — ${form.name}`);
    const body = encodeURIComponent([
      `Name: ${form.name}`, `Phone: ${form.phone}`, `Email: ${form.email}`, `Moving date: ${form.date || "Not provided"}`,
      `Moving from: ${form.from}`, `Moving to: ${form.to}`, `Move type: ${form.moveType}`, `Property size: ${form.propertySize}`,
      `Additional details: ${form.details || "None provided"}`,
    ].join("\n"));
    window.location.href = `mailto:${business.emails[0]}?subject=${subject}&body=${body}`;
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (form.company) return;
    setLoading(true);
    setStatus("Sending your move details…");
    try {
      const response = await fetch("/api/quote", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(form) });
      if (response.ok) {
        setStatus("Thanks — your move details were sent to HF Removals Adelaide.");
        setForm(createEmptyForm());
      } else if (response.status >= 500) {
        setStatus("Online delivery is being connected. Your email app will open with the details ready to send.");
        openEmailFallback();
      } else {
        const payload = await response.json().catch(() => ({ error: "Please check the form and try again." })) as { error?: string };
        setStatus(payload.error ?? "Please check the form and try again.");
      }
    } catch {
      setStatus("We could not reach the quote service. Your email app will open with the details ready to send.");
      openEmailFallback();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className={`quote-form ${compact ? "quote-form-compact" : ""}`} id="quote" onSubmit={submit} noValidate={false}>
      <div className="form-heading"><span className="form-mark">HF</span><div><p className="eyebrow">Free move enquiry</p><h2>Tell us about your move</h2><p>Send the essentials and we&apos;ll review the details.</p></div></div>
      <p className="form-required">Fields marked <span aria-hidden="true">*</span> are required.</p>
      <div className="form-grid">
        <label><span className="field-label">Name <b aria-hidden="true">*</b></span><input required autoComplete="name" value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Your full name" /></label>
        <label><span className="field-label">Phone <b aria-hidden="true">*</b></span><input required autoComplete="tel" inputMode="tel" pattern="[0-9+ ()-]{8,}" value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="Mobile number" /></label>
        <label><span className="field-label">Email <b aria-hidden="true">*</b></span><input required type="email" autoComplete="email" value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="Email address" /></label>
        <label><span className="field-label">Moving date</span><input type="date" value={form.date} onChange={(e) => update("date", e.target.value)} /></label>
        <label><span className="field-label">Moving from <b aria-hidden="true">*</b></span><input required autoComplete="address-level2" value={form.from} onChange={(e) => update("from", e.target.value)} placeholder="Suburb or postcode" /></label>
        <label><span className="field-label">Moving to <b aria-hidden="true">*</b></span><input required autoComplete="address-level2" value={form.to} onChange={(e) => update("to", e.target.value)} placeholder="Suburb or postcode" /></label>
        <label><span className="field-label">Move type <b aria-hidden="true">*</b></span><select required value={form.moveType} onChange={(e) => update("moveType", e.target.value)}><option value="">Select move type</option><option>Residential</option><option>Apartment</option><option>Office / Commercial</option><option>Interstate</option><option>Backloading</option><option>Packing / Unpacking</option><option>Other</option></select></label>
        <label><span className="field-label">Property size <b aria-hidden="true">*</b></span><select required value={form.propertySize} onChange={(e) => update("propertySize", e.target.value)}><option value="">Select property size</option><option>Studio / Small</option><option>1 Bedroom</option><option>2 Bedroom</option><option>3 Bedroom</option><option>4 Bedroom</option><option>5+ Bedroom</option><option>Office / Commercial</option><option>Other</option></select></label>
        <label className="form-wide"><span className="field-label">Additional details</span><textarea value={form.details} onChange={(e) => update("details", e.target.value)} placeholder="Access, inventory, packing or other details" rows={compact ? 3 : 4} /></label>
        <label className="honeypot" aria-hidden="true">Company<input tabIndex={-1} autoComplete="off" value={form.company} onChange={(e) => update("company", e.target.value)} /></label>
      </div>
      <button className="button button-ruby form-submit" type="submit" disabled={loading}>{loading ? "Sending…" : "Get my free quote"}<span>→</span></button>
      <p className="form-note">Prefer to talk? Call <a href={business.phones[0].href}>{business.phones[0].display}</a>.</p>
      <p className="form-status" aria-live="polite" role="status">{status}</p>
    </form>
  );
}

export function MobileStickyCta() {
  return <div className="mobile-sticky"><a href={business.phones[0].href}>Call</a><a href="/#quote">Get quote</a></div>;
}
