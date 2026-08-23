"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { areas, business, interstateRoutes, services } from "../../lib/site-data";

export function UtilityBar() {
  return (
    <aside className="utility-bar" aria-label="Announcement and direct contact">
      <div className="container utility-inner">
        <div className="utility-badge">
          <span className="utility-pulse" />
          <span>Adelaide Removalists · Open 24 Hours · Up to $1M Public Liability & Transit Insurance</span>
        </div>
        <div className="utility-contact">
          <a href="https://maps.google.com/?cid=10700874558509895358" target="_blank" rel="noopener noreferrer" className="utility-rating">
            <span className="utility-stars">★★★★★</span>
            <strong>4.9/5.0</strong> ({business.googleBusiness.reviewCount} Google Reviews)
          </a>
          <a href={business.phones[0].href} className="utility-phone" aria-label={`Call ${business.phones[0].display}`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
            <span>{business.phones[0].display}</span>
          </a>
        </div>
      </div>
    </aside>
  );
}

export function MotionExperience() {
  const pathname = usePathname();
  const progress = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const selector = [
      ".section-heading",
      ".trust-pillar",
      ".service-card",
      ".apartment-media",
      ".apartment-point",
      ".price-card",
      ".interstate-table",
      ".volume-grid article",
      ".service-photo-card",
      ".process-step",
      ".rating-card-compact",
      ".review-card",
      ".insurance-panel",
      ".leader-stats > div",
      ".area-links a",
      ".faq-item",
      ".inner-hero-copy",
      ".inner-hero-media",
      ".detail-card",
      ".listing-card",
      ".footer-grid > div",
    ].join(",");
    const targets = Array.from(document.querySelectorAll<HTMLElement>(selector));

    targets.forEach((target, index) => {
      target.classList.add("reveal-item");
      target.style.setProperty("--reveal-delay", `${(index % 5) * 55}ms`);
    });

    const observer = reducedMotion
      ? null
      : new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (!entry.isIntersecting) return;
              entry.target.classList.add("is-revealed");
              observer?.unobserve(entry.target);
            });
          },
          { rootMargin: "0px 0px -8%", threshold: 0.08 },
        );

    targets.forEach((target) => {
      if (reducedMotion) target.classList.add("is-revealed");
      else observer?.observe(target);
    });

    let frame = 0;
    const updateProgress = () => {
      frame = 0;
      const available = document.documentElement.scrollHeight - window.innerHeight;
      const ratio = available > 0 ? Math.min(window.scrollY / available, 1) : 0;
      if (progress.current) progress.current.style.transform = `scaleX(${ratio})`;
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(updateProgress);
    };
    updateProgress();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      observer?.disconnect();
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [pathname]);

  return <div ref={progress} className="scroll-progress" aria-hidden="true" />;
}

export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  const firstLink = useRef<HTMLAnchorElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onScroll = () => setCompact(window.scrollY > 30);
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
    <>
      <header className={`site-header ${compact ? "is-compact" : ""} ${open ? "menu-open" : ""}`}>
        <div className="header-inner">
        <a className="brand" href="/" aria-label="HF Removals Adelaide home">
          <img src={business.headerLogo} alt="HF Removals Adelaide" width="800" height="795" decoding="async" />
        </a>

        <nav className="desktop-nav" aria-label="Primary navigation">
          <a className={pathname === "/" ? "is-active" : ""} aria-current={pathname === "/" ? "page" : undefined} href="/">
            Home
          </a>

          <div className="nav-dropdown">
            <button className={`nav-dropdown-btn ${pathname.startsWith("/services") ? "is-active" : ""}`} type="button" aria-haspopup="true">
              <span>Services</span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m6 9 6 6 6-6" /></svg>
            </button>
            <div className="nav-dropdown-menu">
              {services.map((item) => (
                <a key={item.slug} href={`/services/${item.slug}`} className="nav-dropdown-item">
                  <strong>{item.eyebrow}</strong>
                  <small>{item.description}</small>
                </a>
              ))}
              <div className="nav-dropdown-footer">
                <a href="/services">View all services <span>→</span></a>
              </div>
            </div>
          </div>

          <div className="nav-dropdown">
            <button className={`nav-dropdown-btn ${pathname.startsWith("/areas") || pathname.startsWith("/interstate") ? "is-active" : ""}`} type="button" aria-haspopup="true">
              <span>Locations & Routes</span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m6 9 6 6 6-6" /></svg>
            </button>
            <div className="nav-dropdown-menu nav-dropdown-wide">
              <div className="nav-dropdown-columns">
                <div>
                  <span className="dropdown-col-title">Adelaide Suburbs</span>
                  {areas.map((item) => (
                    <a key={item.slug} href={`/areas/${item.slug}`} className="nav-dropdown-item">
                      <strong>{item.eyebrow}</strong>
                    </a>
                  ))}
                  <a href="/adelaide-removalists" className="nav-dropdown-item">
                    <strong>Adelaide Metro Hub</strong>
                  </a>
                </div>
                <div>
                  <span className="dropdown-col-title">Interstate Routes</span>
                  {interstateRoutes.map((item) => (
                    <a key={item.slug} href={`/interstate/${item.slug}`} className="nav-dropdown-item">
                      <strong>{item.eyebrow}</strong>
                      <small>{item.price} {item.unit}</small>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <a className={pathname === "/pricing" ? "is-active" : ""} aria-current={pathname === "/pricing" ? "page" : undefined} href="/pricing">
            Pricing
          </a>
          <a className={pathname === "/#reviews" ? "is-active" : ""} href="/#reviews">
            Reviews
          </a>
          <a className={pathname === "/about" ? "is-active" : ""} aria-current={pathname === "/about" ? "page" : undefined} href="/about">
            About
          </a>
          <a className={pathname === "/contact" ? "is-active" : ""} aria-current={pathname === "/contact" ? "page" : undefined} href="/contact">
            Contact
          </a>
        </nav>

        <div className="header-actions">
          <a className="phone-chip" href={business.phones[0].href} aria-label={`Call ${business.phones[0].display}`}>
            <span className="phone-chip-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
            </span>
            <div className="phone-chip-text">
              <span>Direct Line</span>
              <strong>{business.phones[0].display}</strong>
            </div>
          </a>
          <a className="button button-gold header-quote" href="/#quote">
            <span>Free Quote</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12h14m-7-7 7 7-7 7" /></svg>
          </a>
          <button ref={toggle} className={`menu-toggle ${open ? "is-open" : ""}`} type="button" aria-expanded={open} aria-controls="mobile-menu" onClick={() => setOpen((value) => !value)}>
            <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
            <span /><span /><span />
          </button>
        </div>
        </div>
      </header>
      <div ref={menu} id="mobile-menu" className={`mobile-menu ${open ? "is-open" : ""}`} aria-hidden={!open} role="dialog" aria-modal="true" aria-label="Mobile navigation">
        <nav aria-label="Mobile navigation">
          <a className={pathname === "/" ? "is-active" : ""} ref={firstLink} href="/" onClick={() => setOpen(false)}>
            Home <span>↗</span>
          </a>
          <a className={pathname.startsWith("/services") ? "is-active" : ""} href="/services" onClick={() => setOpen(false)}>
            Services <span>↗</span>
          </a>
          <a className={pathname.startsWith("/areas") ? "is-active" : ""} href="/areas" onClick={() => setOpen(false)}>
            Service Areas <span>↗</span>
          </a>
          <a className={pathname.startsWith("/interstate") ? "is-active" : ""} href="/interstate" onClick={() => setOpen(false)}>
            Interstate Routes <span>↗</span>
          </a>
          <a className={pathname === "/pricing" ? "is-active" : ""} href="/pricing" onClick={() => setOpen(false)}>
            Pricing <span>↗</span>
          </a>
          <a href="/#reviews" onClick={() => setOpen(false)}>
            Google Reviews (4.9★) <span>↗</span>
          </a>
          <a className={pathname === "/about" ? "is-active" : ""} href="/about" onClick={() => setOpen(false)}>
            About HF <span>↗</span>
          </a>
          <a className={pathname === "/contact" ? "is-active" : ""} href="/contact" onClick={() => setOpen(false)}>
            Contact <span>↗</span>
          </a>
          <div className="mobile-menu-actions">
            <a className="button button-gold" href="/#quote" onClick={() => setOpen(false)}>
              Request Free Quote <span>→</span>
            </a>
            <a className="button button-outline" href={business.phones[0].href}>
              Call {business.phones[0].display}
            </a>
          </div>
        </nav>
      </div>
    </>
  );
}

type FormDataShape = {
  name: string; phone: string; email: string; date: string; from: string; to: string;
  moveType: string; propertySize: string; details: string; company: string; tab: "local" | "interstate";
};

const createEmptyForm = (): FormDataShape => ({
  name: "", phone: "", email: "", date: "", from: "", to: "",
  moveType: "Residential (House / Unit)", propertySize: "2 Bedrooms", details: "", company: "", tab: "local"
});

const FORM_SUBMIT_ENDPOINT = "https://formsubmit.co/hfremovalad@gmail.com";

function getAdelaideDateInputValue(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Adelaide",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function QuoteForm({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname();
  const [form, setForm] = useState<FormDataShape>(() => createEmptyForm());
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusKind, setStatusKind] = useState<"success" | "error" | "info">("info");
  const submitting = useRef(false);
  const earliestDate = getAdelaideDateInputValue();
  const successUrl = `${business.domain}${pathname}?quote=sent#quote`;

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    if (search.get("quote") !== "sent") return;

    const statusTimer = window.setTimeout(() => {
      setStatusKind("success");
      setStatus("Thank you. Your move details have been submitted to HF Removals Adelaide.");
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.hash}`);
    }, 0);
    return () => window.clearTimeout(statusTimer);
  }, []);

  const update = (field: keyof FormDataShape, value: string) => setForm((current) => ({ ...current, [field]: value }));

  function submit(event: FormEvent<HTMLFormElement>) {
    if (submitting.current) {
      event.preventDefault();
      return;
    }
    if (form.company) {
      event.preventDefault();
      setForm(createEmptyForm());
      setStatusKind("success");
      setStatus("Thank you. Your request has been received.");
      return;
    }

    submitting.current = true;
    setLoading(true);
    setStatusKind("info");
    setStatus("Submitting your move details securely…");
  }

  return (
    <form
      action={FORM_SUBMIT_ENDPOINT}
      method="POST"
      className={`quote-form ${compact ? "quote-form-compact" : ""}`}
      id="quote"
      onSubmit={submit}
      onInvalid={() => {
        setStatusKind("error");
        setStatus("Please complete the required fields and correct any highlighted values.");
      }}
    >
      <input type="hidden" name="_subject" value="New HF Removals Adelaide Quote Request" />
      <input type="hidden" name="_captcha" value="false" />
      <input type="hidden" name="_template" value="table" />
      <input type="hidden" name="_next" value={successUrl} />
      <input type="hidden" name="website" value="HF Removals Adelaide Website" />
      <input type="hidden" name="move_category" value={form.tab === "interstate" ? "Interstate Move" : "Local Adelaide Move"} />
      <div className="form-header-badge">
        <span className="badge-dot" />
        <span>Published reference rates · Final quote based on your move scope</span>
      </div>

      <div className="form-heading">
        <span className="form-mark">HF</span>
        <div>
          <p className="eyebrow">Instant Quote Request</p>
          <h2>Tell Us About Your Move</h2>
          <p>Get a transparent quote scoped around your exact inventory & access.</p>
        </div>
      </div>

      <div className="form-tabs" role="tablist" aria-label="Move type selection">
        <button
          type="button"
          role="tab"
          aria-selected={form.tab === "local"}
          className={`form-tab-btn ${form.tab === "local" ? "is-active" : ""}`}
          onClick={() => update("tab", "local")}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="m3 11 9-7 9 7v9h-6v-6H9v6H3Z"/></svg>
          <span>Local Adelaide Move</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={form.tab === "interstate"}
          className={`form-tab-btn ${form.tab === "interstate" ? "is-active" : ""}`}
          onClick={() => update("tab", "interstate")}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M3 6h11v11H3Zm11 4h4l3 3v4h-7M7 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm11 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/></svg>
          <span>Interstate Move</span>
        </button>
      </div>

      <div className="form-rate-preview">
        {form.tab === "local" ? (
          <p>⚡ <strong>Local Rate:</strong> 2 Movers + Truck from <em>$74 / 30 min</em> ($148/hr) · All protective gear included</p>
        ) : (
          <p>⚡ <strong>Interstate Reference:</strong> Melbourne from <em>$119.43/m³</em> · Sydney from <em>$130.19/m³</em> · QLD $164/m³</p>
        )}
      </div>

      <fieldset className="form-grid form-core">
        <legend className="sr-only">Essential move details</legend>
        <label>
          <span className="field-label">Your Name <b aria-hidden="true">*</b></span>
          <input name="name" required maxLength={100} autoComplete="name" value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="e.g. Alex Smith" />
        </label>
        <label>
          <span className="field-label">Phone Number <b aria-hidden="true">*</b></span>
          <input name="phone" required maxLength={32} autoComplete="tel" inputMode="tel" pattern="[0-9+ ()-]{8,}" value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="e.g. 0400 000 000" />
        </label>
        <label>
          <span className="field-label">Moving From (Suburb) <b aria-hidden="true">*</b></span>
          <input name="moving_from" required maxLength={180} autoComplete="address-level2" value={form.from} onChange={(e) => update("from", e.target.value)} placeholder="e.g. Elizabeth Vale SA" />
        </label>
        <label>
          <span className="field-label">Moving To (Suburb/City) <b aria-hidden="true">*</b></span>
          <input name="moving_to" required maxLength={180} autoComplete="address-level2" value={form.to} onChange={(e) => update("to", e.target.value)} placeholder={form.tab === "local" ? "e.g. Marion SA" : "e.g. Melbourne VIC"} />
        </label>
        <label className="form-wide">
          <span className="field-label">Move Type <b aria-hidden="true">*</b></span>
          <select name="move_type" required value={form.moveType} onChange={(e) => update("moveType", e.target.value)}>
            <option>Residential (House / Unit)</option>
            <option>Apartment / High-Rise (Lift Access)</option>
            <option>Office / Commercial Relocation</option>
            <option>Interstate Long Distance</option>
            <option>Backloading Route</option>
            <option>Packing & Protection Only</option>
            <option>Single Item / Heavy Furniture</option>
          </select>
        </label>
        <input className="honeypot" type="text" name="_honey" tabIndex={-1} autoComplete="off" aria-hidden="true" value={form.company} onChange={(e) => update("company", e.target.value)} />
      </fieldset>

      <details className="form-optional" open={compact || undefined}>
        <summary>
          <span>More Details (Date, Property Size, Stairs/Lifts)</span>
          <span aria-hidden="true">+</span>
        </summary>
        <fieldset className="form-grid">
          <legend className="sr-only">Optional move details</legend>
          <label>
            <span className="field-label">Email Address</span>
            <input name="email" type="email" maxLength={254} autoComplete="email" value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="email@domain.com.au" />
          </label>
          <label>
            <span className="field-label">Preferred Moving Date</span>
            <input name="preferred_moving_date" type="date" min={earliestDate} value={form.date} onChange={(e) => update("date", e.target.value)} />
          </label>
          <label className="form-wide">
            <span className="field-label">Property Size / Volume</span>
            <select name="property_size" value={form.propertySize} onChange={(e) => update("propertySize", e.target.value)}>
              <option>Studio / 1 Bedroom Unit</option>
              <option>2 Bedrooms</option>
              <option>3 Bedrooms (Standard Family Home)</option>
              <option>4+ Bedrooms (Large Family Home)</option>
              <option>Office / Commercial Space</option>
              <option>Few Items / Selected Furniture</option>
            </select>
          </label>
          <label className="form-wide">
            <span className="field-label">Access & Heavy Items Notes</span>
            <textarea
              name="details"
              value={form.details}
              maxLength={3000}
              onChange={(e) => update("details", e.target.value)}
              placeholder="e.g. 2nd floor stairs, lift booking required, double-door fridge, heavy timber dining table, piano, packing required..."
              rows={compact ? 3 : 4}
            />
          </label>
        </fieldset>
      </details>

      <button className="button button-gold form-submit" type="submit" disabled={loading}>
        <span>{loading ? "Processing..." : "Get My Free Quote"}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14m-7-7 7 7-7 7" /></svg>
      </button>

      <div className="form-footer-guarantee">
        <span>🛡️ Up to $1,000,000 Transit Insurance Included</span>
        <span>•</span>
        <span>No Booking Fee Until Confirmed</span>
      </div>

      <p className="form-note">
        Need urgent assistance? Call directly: <a href={business.phones[0].href}><strong>{business.phones[0].display}</strong></a> (Open 24/7)
      </p>

      {status && (
        <p className={`form-status is-${statusKind}`} aria-live="polite" role={statusKind === "error" ? "alert" : "status"}>
          {status}
        </p>
      )}
    </form>
  );
}

export function MobileStickyCta() {
  return (
    <aside className="mobile-sticky" aria-label="Quick mobile call and quote action">
      <a href={business.phones[0].href} className="mobile-sticky-call">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
        <span>Call {business.phones[0].display}</span>
      </a>
      <a href="/#quote" className="mobile-sticky-quote">
        <span>Get Free Quote</span>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14m-7-7 7 7-7 7" /></svg>
      </a>
    </aside>
  );
}

