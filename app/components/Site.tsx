import Image from "next/image";
import { areas, business, ContentPage, entryLocalRate, googleReviews, guides, interstatePricing, interstateRoutes, localPricing, services, standardMoveFaqs } from "../../lib/site-data";
import { hfServiceAreaRecords } from "../../lib/hf-service-areas";
import { ABDeveloperCredit } from "./ABDeveloperCredit";
import { BookNowButton, Header, MobileStickyCta, MotionExperience, QuoteForm, SideQuoteTab, UtilityBar } from "./SiteClient";

function CheckIcon({ size = 12, style }: { size?: number; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function StarIcon({ size = 13, style, className }: { size?: number; style?: React.CSSProperties; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={style} className={className}>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

export function ServiceTicker({ locations = false }: { locations?: boolean }) {
  const items = locations
    ? ["ADELAIDE METRO", "ELIZABETH VALE", "ELIZABETH", "SALISBURY", "BLAKEVIEW", "GAWLER", "ADELAIDE CBD", "MARION", "NORWOOD", "GLENELG"]
    : ["RESIDENTIAL REMOVALS", "APARTMENT & HIGH-RISE", "OFFICE RELOCATIONS", "INTERSTATE MOVES", "BACKLOADING", "PACKING & UNPACKING"];
  const content = [...items, ...items];
  return (
    <div className="ticker">
      <p className="sr-only">{items.join(", ")}. Moving ticker banner.</p>
      <div className="ticker-track" aria-hidden="true">
        {content.map((item, index) => (
          <span key={`${item}-${index}`}>
            {item}
            <b>◆</b>
          </span>
        ))}
      </div>
    </div>
  );
}

function TrustBar() {
  const items = [
    {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="var(--hf-gold-500)" stroke="none" />
        </svg>
      ),
      title: `${business.googleBusiness.rating.toFixed(1)} Google Rating`,
      desc: `${business.googleBusiness.reviewCount} Google Reviews`,
    },
    {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      ),
      title: "Up to $1M insurance",
      desc: "Policy terms and move scope apply",
    },
    {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      ),
      title: business.googleBusiness.hoursLabel,
      desc: "Same-Day & Urgent Moves",
    },
    {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <rect width="20" height="14" x="2" y="5" rx="2" />
          <line x1="2" x2="22" y1="10" y2="10" />
        </svg>
      ),
      title: "Transparent Rates",
      desc: `From ${entryLocalRate.halfHour}/30min · Scope confirmed in quote`,
    },
    {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="m7.5 4.27 9 5.15" />
          <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
        </svg>
      ),
      title: "Free Mattress Wraps",
      desc: "Blankets, Straps & Protection",
    },
    {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      ),
      title: "Local Adelaide Crew",
      desc: "Metro & Interstate Coverage",
    },
  ];

  return (
    <section className="trust-strip" aria-label="Key Service Guarantees">
      <div className="container">
        <div className="trust-grid">
          {items.map((item, index) => (
            <div key={index} className="trust-pillar">
              <span className="pillar-icon">{item.icon}</span>
              <div className="pillar-text">
                <strong>{item.title}</strong>
                <span>{item.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SectionHeading({
  eyebrow,
  title,
  copy,
  light = false,
  center = false,
}: {
  eyebrow: string;
  title: React.ReactNode;
  copy?: string;
  light?: boolean;
  center?: boolean;
}) {
  return (
    <div className={`section-heading ${light ? "light" : ""} ${center ? "text-center" : ""}`}>
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      {copy && <p>{copy}</p>}
    </div>
  );
}

function ServicesGrid() {
  const serviceIcons: Record<string, React.ReactNode> = {
    "residential-removals": (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m3 11 9-7 9 7v9h-6v-6H9v6H3Z"/></svg>
    ),
    "office-commercial-removals": (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/><path d="M15 3v18"/><path d="M3 9h18"/><path d="M3 15h18"/></svg>
    ),
    "interstate-removals": (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h11v11H3Zm11 4h4l3 3v4h-7M7 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm11 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/></svg>
    ),
    backloading: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>
    ),
    "packing-unpacking": (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>
    ),
    "furniture-removals": (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 11V7a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v4"/><path d="M4 11h16a2 2 0 0 1 2 2v3H2v-3a2 2 0 0 1 2-2Z"/><path d="M5 16v3M19 16v3M8 8h8"/></svg>
    ),
  };

  return (
    <section className="section services-section" id="services">
      <div className="container">
        <SectionHeading
          eyebrow="Specialized Moving Services"
          title={<>Tailored Moving Solutions <em>From Door to Door</em></>}
          copy="Carefully scoped around your property access, furniture protection requirements, and preferred moving timeline."
        />
        <div className="service-grid">
          {services.map((service, index) => (
            <a className="service-card" href={`/services/${service.slug}`} key={service.slug}>
              <div className="service-card-top">
                <span className="service-icon">{serviceIcons[service.slug] ?? <span className="card-number">{String(index + 1).padStart(2, "0")}</span>}</span>
                <span className="card-badge">Option {String(index + 1).padStart(2, "0")}</span>
              </div>
              <h3>{service.eyebrow}</h3>
              <p>{service.description}</p>
              <ul className="service-card-highlights">
                {service.highlights.slice(0, 3).map((h) => (
                  <li key={h}>
                    <CheckIcon size={12} style={{ display: "inline-block", verticalAlign: "-1px", marginRight: "6px" }} />
                    {h}
                  </li>
                ))}
              </ul>
              <span className="card-link">
                Explore service <b>→</b>
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

function ApartmentAccessSection() {
  const points = [
    { title: "Lift Bookings & Access Windows", desc: "Coordinated move timing to fit strict strata and body corporate service lift reservations." },
    { title: "Loading Dock Clearances", desc: "Truck height & positioning planned around basement clearance and designated loading bays." },
    { title: "Stairways & Tight Hallways", desc: "Share furniture dimensions, stair turns and narrow doorways so the team can review the access before moving day." },
    { title: "Common Area & Furniture Protection", desc: "Tell us about building protection requirements. Mattress protection is available; confirm other materials and preparation with your quote." },
  ];

  return (
    <section className="section apartment-section" aria-labelledby="apartment-title">
      <div className="container apartment-grid">
        <div className="apartment-media">
          <Image src="/images/hf-apartment-removals.webp" alt="HF Removals Adelaide crew moving labelled cartons into a residential property" width={1672} height={941} sizes="(max-width: 900px) calc(100vw - 32px), (max-width: 1280px) 50vw, 600px" />
          <div className="apartment-media-badge">
            <strong>Adelaide CBD & apartment move planning</strong>
            <span>Share lift, loading-zone and common-area requirements before moving day</span>
          </div>
        </div>
        <div className="apartment-copy">
          <p className="eyebrow">Apartments & High-Rise Moves</p>
          <h2 id="apartment-title">Smooth Moves Start <em>Before The Lift Doors Open</em></h2>
          <p className="apartment-lead">
            Moving in or out of an apartment or multi-level townhouse involves specific access challenges. HF Removals plans around every detail from vehicle parking to lift bookings.
          </p>
          <div className="apartment-points">
            {points.map((p, i) => (
              <div key={i} className="apartment-point">
                <span className="point-check" aria-hidden="true"><CheckIcon size={13} /></span>
                <div>
                  <strong>{p.title}</strong>
                  <p>{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="apartment-cta">
            <a className="button button-ruby" href="/#quote">Plan Your Apartment Move</a>
            <a className="button button-outline" href={business.phones[0].href}>Call {business.phones[0].display}</a>
          </div>
        </div>
      </div>
    </section>
  );
}

const servicePhotos = [
  {
    src: "/images/hf-residential-premium.webp",
    href: "/services/residential-removals",
    label: "Residential Removals",
    copy: "Home moving support planned around access, inventory, and final placement.",
    alt: "HF Removals Adelaide mover handing a pot plant to customers at the door of their new home, with the HF truck and cartons behind",
  },
  {
    src: "/images/hf-packing-premium.webp",
    href: "/services/packing-unpacking",
    label: "Packing & Protection",
    copy: "Protective preparation with heavy blankets, shrink wrap, and complimentary mattress covers.",
    alt: "HF Removals Adelaide movers shrink-wrapping a mattress and padded furniture inside a home",
  },
  {
    src: "/images/hf-office-premium.webp",
    href: "/services/office-commercial-removals",
    label: "Office & Workplace Moves",
    copy: "Coordinated commercial moves for workstations, IT equipment, and archives.",
    alt: "HF Removals Adelaide movers wheeling cartons, office chairs and a filing cabinet into a city office building",
  },
  {
    src: "/images/hf-interstate-premium.webp",
    href: "/services/interstate-removals",
    label: "Interstate Removals",
    copy: "Long-distance moving connecting Adelaide to Melbourne, Sydney, Brisbane, and Perth.",
    alt: "HF Removals Adelaide truck parked at a home while two movers carry a sofa to the door",
  },
] as const;

function ServicePhotosSection() {
  return (
    <section className="section service-photos-section" aria-label="HF moving services gallery">
      <div className="container">
        <SectionHeading
          eyebrow="Work in Motion"
          title={<>The Right Equipment for <em>Every Kind of Move</em></>}
          copy="Explore our fleet, careful furniture wrapping, and commercial relocation support in action."
          light
        />
        <div className="service-photo-grid">
          {servicePhotos.map((photo, index) => (
            <a className="service-photo-card" href={photo.href} key={photo.src}>
              <Image src={photo.src} alt={photo.alt} width={1672} height={941} sizes="(max-width: 680px) calc(100vw - 32px), (max-width: 1280px) 50vw, 600px" />
              <span className="service-photo-shade" />
              <span className="service-photo-copy">
                <small>{String(index + 1).padStart(2, "0")}</small>
                <strong>{photo.label}</strong>
                <span>{photo.copy}</span>
                <b>Explore service →</b>
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

function BookingHowItWorksSection() {
  const steps = [
    ["Tell us about your move", "Enter your pickup and destination, move details and the service you need."],
    ["Choose an available time", "See available booking times and choose the one that works for you."],
    ["Review your booking", "Check your move details, selected service and booking time."],
    ["Confirm your move", "Confirm your booking online. No advance payment is required — your final price is calculated after your move is completed."],
  ] as const;
  return (
    <section className="section booking-steps-section">
      <div className="container">
        <SectionHeading eyebrow="Book Your Move Online" title={<>Simple. Clear. <em>Secure.</em></>} copy="Your move booked in a few easy steps." center />
        <ol className="booking-steps">
          {steps.map(([title, copy], index) => (
            <li className="booking-step" key={title}>
              <span className="booking-step-number">{String(index + 1).padStart(2, "0")}</span>
              <h3>{title}</h3>
              <p>{copy}</p>
            </li>
          ))}
        </ol>
        <div className="booking-steps-cta">
          <BookNowButton location="how_it_works">Book Now <span>→</span></BookNowButton>
        </div>
      </div>
    </section>
  );
}

function PricingSection() {
  return (
    <section className="section pricing-section" id="pricing">
      <div className="container">
        <SectionHeading
          eyebrow="Transparent Billing Rates"
          title={<>Published Reference Rates, <em>Clearly Explained</em></>}
          copy="Local Adelaide moves use published 30-minute billing increments. Interstate routes below show supplied per-cubic-metre reference rates."
        />
        <div className="local-pricing">
          {localPricing.map((item) => (
            <article className="price-card" key={item.name}>
              <span className="ruby-dot" aria-hidden="true" />
              <h3>{item.name}</h3>
              <div className="price-value">
                <strong>{item.halfHour}</strong>
                <span>/ 30 min</span>
              </div>
              <p className="price-hourly">{item.hourly} per hour</p>
              <ul className="price-features">
                <li>
                  <CheckIcon size={13} style={{ display: "inline-block", verticalAlign: "-2px", marginRight: "7px" }} />
                  Full truck equipped with blankets & straps
                </li>
                <li>
                  <CheckIcon size={13} style={{ display: "inline-block", verticalAlign: "-2px", marginRight: "7px" }} />
                  Complimentary mattress protection wrap
                </li>
                <li>
                  <CheckIcon size={13} style={{ display: "inline-block", verticalAlign: "-2px", marginRight: "7px" }} />
                  Final quote confirms access, inventory and move scope
                </li>
                <li>
                  <CheckIcon size={13} style={{ display: "inline-block", verticalAlign: "-2px", marginRight: "7px" }} />
                  {business.insurance}; terms apply
                </li>
              </ul>
              <div className="package-cta-row">
                <BookNowButton location="pricing" packageId={item.name.startsWith("3") ? "3-men" : "2-men"}>
                  Book Now <span>→</span>
                </BookNowButton>
                <a className="package-quote-link" href="/#quote">Not ready? Get a Quote instead</a>
              </div>
              <p className="package-trust-line">No advance payment required · final price calculated after completion</p>
            </article>
          ))}
        </div>
        <p className="pricing-disclosure">
          3-hour minimum service + 1-hour call-out fee. The call-out covers truck fuel and basic transport charges.
          Additional service time is billed in 30-minute increments at your selected package rate. Your final price
          is calculated when the job is completed.
        </p>

        <div className="payment-info-panel">
          <h3>No Advance Payment Required</h3>
          <p>Book online without an advance payment — choose your time, review your booking and confirm it.</p>
          <p>Your final price is calculated once your move is completed, based on the 3-hour minimum service plus the separate 1-hour call-out fee.</p>
        </div>

        <div className="interstate-table">
          <div className="table-intro">
            <p className="eyebrow">Interstate Volume Pricing</p>
            <h3>Route Reference Rates</h3>
            <p>Calculated per cubic metre (m³); final pricing depends on the confirmed route, volume and move scope.</p>
            <a className="button button-ruby" href="/interstate">View All Routes</a>
          </div>
          <div className="table-routes">
            {interstatePricing.map((item) => (
              <a href={`/interstate/${item.slug}`} key={item.slug} className="table-route-row">
                <div className="route-name">
                  <strong>{item.label}</strong>
                  <span>Final timing is confirmed with your quote</span>
                </div>
                <div className="route-cost">
                  <strong>{item.price}</strong>
                  <small>{item.unit}</small>
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function VolumeGuidanceSection() {
  return (
    <section className="volume-guidance" aria-labelledby="volume-guidance-title">
      <div className="container">
        <div className="volume-heading">
          <p className="eyebrow">Truck Volume Estimator</p>
          <h2 id="volume-guidance-title">
            How Much Space <em>Does Your Move Need?</em>
          </h2>
          <p>We supply the right sized vehicle to prevent multiple trips and keep move costs efficient.</p>
        </div>
        <div className="volume-grid">
          {business.truckVolumeGuidance.map((item) => (
            <article key={item.label}>
              <span>{item.label}</span>
              <strong>{item.volume}</strong>
              <p>{item.examples.join(" · ")}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function ReviewsSection() {
  const google = business.googleBusiness;
  return (
    <section className="section reviews-section" id="reviews" aria-labelledby="google-proof-title">
      <div className="container">
        <div className="reviews-header-grid">
          <div>
            <p className="eyebrow">Google Reviews</p>
            <h2 id="google-proof-title">What Our <em>Customers Say</em></h2>
            <p className="reviews-copy">
              View the current rating and customer feedback directly on Google before choosing your mover.
            </p>
          </div>
          <div className="rating-card-compact">
            <div className="rating-card-top">
              <span className="google-badge-pill">Google Verified</span>
              <span className="rating-stars" aria-hidden="true" style={{ display: "inline-flex", gap: "2px" }}>{[...Array(5)].map((_, i) => <StarIcon key={i} size={14} />)}</span>
            </div>
            <strong>{google.rating.toFixed(1)} / 5.0</strong>
            <p>Based on {google.reviewCount} customer reviews</p>
            <a href="https://maps.google.com/?cid=10700874558509895358" target="_blank" rel="noopener noreferrer" className="google-review-link">
              Read all reviews on Google <span>→</span>
            </a>
          </div>
        </div>

        <div className="reviews-cards-grid" aria-label="Customer reviews verified from supplied Google screenshots">
          {googleReviews.map((review) => (
            <article className="review-card" key={review.name}>
              <div>
                <div className="review-card-head">
                  <span className="review-stars" aria-label="5 out of 5 stars" style={{ display: "inline-flex", gap: "2px" }}>{[...Array(5)].map((_, i) => <StarIcon key={i} size={13} />)}</span>
                  <span className="review-source">Google</span>
                </div>
                <blockquote className={`review-content ${review.complete ? "" : "is-excerpt"}`}>
                  {!review.complete && <span>Verified visible excerpt</span>}
                  “{review.content}”
                </blockquote>
              </div>
              <div className="review-author-wrap">
                <span className="review-avatar" aria-hidden="true">{review.initials}</span>
                <div>
                  <strong>{review.name}</strong>
                  <span>{review.detail}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function LeadershipSection() {
  return (
    <section className="section leadership" aria-labelledby="leadership-title">
      <div className="container leadership-grid">
        <div className="portrait-wrap">
          <div className="portrait-backdrop" />
          <img src={business.ceoImage} alt="Muhammad Rasheed, CEO of HF Removals Adelaide" width="800" height="1000" loading="lazy" />
          <span className="portrait-accent" />
        </div>
        <div>
          <SectionHeading eyebrow="Company Leadership" title={<>Meet <em>{business.ceo.name}</em></>} />
          <p className="leader-title">{business.ceo.title}</p>
          <p>
            HF Removals Adelaide receives enquiries from its Elizabeth Vale base for local, commercial and listed interstate moves. Each quote is scoped around inventory, access, protection and destination details.
          </p>
          <div className="leader-stats">
            <div>
              <strong>{business.googleBusiness.reviewCount}</strong>
              <span>Google Reviews</span>
            </div>
            <div>
              <strong>Up to $1M</strong>
              <span>Insurance; terms apply</span>
            </div>
            <div>
              <strong>{business.googleBusiness.hoursLabel.replace("Open ", "")}</strong>
              <span>Availability</span>
            </div>
          </div>
          <a className="button button-ruby" href="/about">Learn More About HF <span>→</span></a>
        </div>
      </div>
    </section>
  );
}

function PackingSection() {
  return (
    <section className="section packing-section">
      <div className="container packing-grid">
        <div>
          <p className="eyebrow">Protection & Preparation</p>
          <h2>We Protect Your Belongings <em>Like Our Own</em></h2>
          <p>Every HF Removals truck arrives fully stocked with professional-grade moving blankets, tie-down ratchet straps, and heavy-duty trolleys.</p>
          <div className="check-list">
            {business.packingMaterials.map((item) => (
              <span key={item}>
                <b aria-hidden="true"><CheckIcon size={13} /></b> {item}
              </span>
            ))}
          </div>
          <a className="button button-ruby" href="/services/packing-unpacking">Explore Packing Services</a>
        </div>
        <div className="insurance-panel">
          <span className="panel-number">VERIFIED BUSINESS COVERAGE</span>
          <strong>Up to<br /><em>{business.insuranceAmount}</em></strong>
          <h3>Public Liability & Transit Insurance</h3>
          <p>{business.insuranceQualifier}</p>
        </div>
      </div>
    </section>
  );
}

function ProcessSection() {
  const steps = [
    ["Request a Quote", "Submit your move dates, suburbs, and inventory for review."],
    ["Scope & Review", "We confirm access, truck size, and exact inclusions."],
    ["Professional Packing", "Furniture is wrapped and secured with protective gear."],
    ["Careful Transport", "Belongings are secured for transport; applicable insurance terms depend on the move scope."],
    ["Room Placement", "Boxes and furniture placed exactly where you want them."],
  ];
  return (
    <section className="section process-section">
      <div className="container">
        <SectionHeading eyebrow="Our Simple 5-Step Process" title={<>A Clear Moving Plan from <em>Booking to Placement</em></>} light />
        <ol className="process-line">
          {steps.map(([title, copy], index) => (
            <li key={title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{title}</h3>
              <p>{copy}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function ContactMapSection() {
  const google = business.googleBusiness;
  return (
    <section className="contact-map-section" aria-labelledby="contact-map-title">
      <div className="container contact-map-grid">
        <div>
          <p className="eyebrow">Elizabeth Vale Operations Base</p>
          <h2 id="contact-map-title">Servicing All Adelaide & Regional SA</h2>
          <p>{business.address.full}</p>
          <dl>
            <div>
              <dt>Hours</dt>
              <dd>{google.hoursLabel}</dd>
            </div>
            <div>
              <dt>Direct Phone</dt>
              <dd><a href={business.phones[0].href}>{business.phones[0].display}</a></dd>
            </div>
            <div>
              <dt>Plus Code</dt>
              <dd>{google.plusCode}</dd>
            </div>
          </dl>
          <a className="button button-ruby" href={google.directionsUrl} target="_blank" rel="noopener noreferrer">
            Get Directions on Google Maps
          </a>
        </div>
        <div className="map-frame">
          <iframe
            src={google.mapEmbedUrl}
            width="600"
            height="450"
            style={{ border: 0, width: "100%", minHeight: "420px" }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            title="Google Map showing HF Removals Adelaide"
          />
        </div>
      </div>
    </section>
  );
}

function AreasSection() {
  const homepageAreaSlugs = [
    "elizabeth", "munno-para", "angle-vale", "andrews-farm", "gawler",
    "mawson-lakes", "golden-grove", "modbury", "tea-tree-gully",
    "mount-barker", "morphett-vale", "west-lakes", "woodville", "findon",
  ];
  const homepageAreas = homepageAreaSlugs
    .map((slug) => hfServiceAreaRecords.find((area) => area.slug === slug))
    .filter((area): area is (typeof hfServiceAreaRecords)[number] => Boolean(area));
  return (
    <section className="section areas-section" id="areas">
      <div className="container">
        <SectionHeading
          eyebrow="Adelaide & Regional Coverage"
          title={<>Removalists Across <em>Adelaide</em></>}
          copy="Explore local planning pages for Adelaide's northern growth corridor, the north-east, the Hills, southern suburbs and western areas."
          light
        />
        <div className="area-links">
          {homepageAreas.map((area) => (
            <a key={area.slug} href={`/areas/${area.slug}`}>
              <span>{area.name} removals</span>
              <b>↗</b>
            </a>
          ))}
          <a href="/areas/playford"><span>Playford hub</span><b>↗</b></a>
          <a href="/areas"><span>View all service areas</span><b>↗</b></a>
          <a href="/adelaide-removalists">
            <span>Adelaide Metro Hub</span>
            <b>↗</b>
          </a>
        </div>
      </div>
    </section>
  );
}

export function FaqSection({ faqs = standardMoveFaqs, title = "Frequently Asked Questions" }: { faqs?: { question: string; answer: string }[]; title?: string }) {
  return (
    <section className="section faq-section" id="faq">
      <div className="container faq-grid">
        <SectionHeading eyebrow="Answers & Guidance" title={title} copy="Have a specific question about your upcoming move? Contact our team during the published business hours." />
        <div className="faq-list">
          {faqs.map((faq, index) => (
            <details key={index} className="faq-item">
              <summary>
                <span>{faq.question}</span>
                <span className="faq-plus" aria-hidden="true">+</span>
              </summary>
              <p>{faq.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function QuoteStrip({ quotePrimary = false }: { quotePrimary?: boolean } = {}) {
  if (quotePrimary) {
    return (
      <section className="quote-strip">
        <div className="container">
          <div>
            <p className="eyebrow">Ready To Plan Your Move?</p>
            <h2>Get Your Free, Transparent Quote From HF Removals</h2>
            <p className="quote-strip-lead">Share your route, inventory and access details and HF will scope the job.</p>
          </div>
          <div className="quote-strip-actions">
            <a className="button button-ruby" href="/#quote">Get a Quote <span>→</span></a>
            <a className="button button-outline" href={business.phones[0].href}>Call {business.phones[0].display}</a>
          </div>
        </div>
      </section>
    );
  }
  return (
    <section className="quote-strip">
      <div className="container">
        <div>
          <p className="eyebrow">Ready To Move?</p>
          <h2>Book Your Adelaide Move Today</h2>
          <p className="quote-strip-lead">Choose your move details, select an available time and confirm your booking online.</p>
        </div>
        <div className="quote-strip-actions">
          <BookNowButton location="final_cta">Book Now <span>→</span></BookNowButton>
          <a className="button button-outline" href={business.phones[0].href}>Call {business.phones[0].display}</a>
        </div>
        <p className="quote-strip-fallback">
          Not ready to book? <a href="/#quote">Get a Free Quote →</a>
        </p>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div className="footer-brand">
          <img src={business.logo} alt="HF Removals Adelaide" width={business.logoWidth} height={business.logoHeight} loading="lazy" decoding="async" />
          <p className="footer-tagline">“{business.tagline}”</p>
          <address>
            <a href={business.phones[0].href} className="footer-phone">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: "inline-block", verticalAlign: "-2px", marginRight: "6px" }}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
              {business.phones[0].display} (Primary)
            </a>
            <a href={business.phones[1].href}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: "inline-block", verticalAlign: "-2px", marginRight: "6px" }}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
              {business.phones[1].display} (Secondary)
            </a>
            <a href={`mailto:${business.emails[0]}`}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: "inline-block", verticalAlign: "-2px", marginRight: "6px" }}><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>
              {business.emails[0]}
            </a>
            <span>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: "inline-block", verticalAlign: "-2px", marginRight: "6px" }}><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
              {business.address.full}
            </span>
            <span>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="var(--hf-gold-500)" stroke="none" aria-hidden="true" style={{ display: "inline-block", verticalAlign: "-2px", marginRight: "6px" }}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
              {business.googleBusiness.rating.toFixed(1)} Google Rating · {business.googleBusiness.reviewCount} Reviews
            </span>
          </address>
        </div>
        <div>
          <h3>Services</h3>
          {services.map((item) => (
            <a href={`/services/${item.slug}`} key={item.slug}>{item.eyebrow}</a>
          ))}
        </div>
        <div>
          <h3>Service Areas</h3>
          {areas.map((item) => (
            <a href={`/areas/${item.slug}`} key={item.slug}>{item.eyebrow}</a>
          ))}
          <a href="/adelaide-removalists">Adelaide Metro Overview</a>
        </div>
        <div>
          <h3>Interstate Routes</h3>
          {interstateRoutes.map((item) => (
            <a href={`/interstate/${item.slug}`} key={item.slug}>{item.eyebrow}</a>
          ))}
          <a href="/pricing">Removalist Prices & Hourly Rates</a>
          <a href="/guides">Moving Guides & Checklists</a>
        </div>
      </div>
      <div className="container footer-bottom">
        <span>© {new Date().getFullYear()} HF Removals Adelaide · Legal name: {business.legalName}</span>
        <span>
          <a href="/privacy">Privacy Policy</a>
          <a href="/terms">Website Terms</a>
        </span>
      </div>
      <div className="container developer-credit-wrap">
        <ABDeveloperCredit />
      </div>
    </footer>
  );
}

export function SiteFrame({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <MotionExperience />
      <UtilityBar />
      <Header />
      <main id="main">{children}</main>
      <Footer />
      <SideQuoteTab />
      <MobileStickyCta />
    </>
  );
}

export function HomePage() {
  return (
    <SiteFrame>
      <section className="hero">
        <picture>
          <source
            media="(max-width: 640px)"
            srcSet="/images/hf-hero-mobile-480.webp 480w, /images/hf-hero-mobile-768.webp 768w"
            sizes="100vw"
          />
          <img
            className="hero-image"
            src="/images/hf-hero-truck-1792.webp"
            srcSet="/images/hf-hero-truck-480.webp 480w, /images/hf-hero-truck-768.webp 768w, /images/hf-hero-truck-1024.webp 1024w, /images/hf-hero-truck-1440.webp 1440w, /images/hf-hero-truck-1792.webp 1792w"
            sizes="100vw"
            alt="HF Removals Adelaide truck and movers outside a modern Adelaide home"
            width="1792"
            height="1008"
            fetchPriority="high"
          />
        </picture>
        <div className="hero-overlay" />
        <div className="container hero-grid">
          <div className="hero-copy">
            <div className="hero-badge">
              <StarIcon size={12} className="hero-badge-star" />
              <span>{business.googleBusiness.rating.toFixed(1)} RATED ADELAIDE REMOVALISTS ({business.googleBusiness.reviewCount} REVIEWS)</span>
            </div>
            <h1>
              Adelaide <em>Removalists</em>
              <br />
              You Can Rely On
            </h1>
            <p className="hero-lead">
              HF is an Adelaide moving company for home, apartment, office and interstate moves, with published reference rates. Coverage includes {business.insurance}, subject to applicable policy terms.
            </p>
            <p className="hero-book-line">Book your move online in minutes — choose your date, confirm your booking, and we take it from there.</p>
            <div className="hero-actions">
              <BookNowButton location="hero">
                Book Now <span>→</span>
              </BookNowButton>
              <a className="button button-outline" href={business.phones[0].href}>
                Call {business.phones[0].display}
              </a>
            </div>
            <p className="hero-quote-fallback">
              Not ready to book? <a href="#quote">Get a Free Quote</a>
            </p>
            <div className="hero-proof-pills">
              <span>
                <CheckIcon size={12} />
                Local Adelaide Crew
              </span>
              <span>
                <CheckIcon size={12} />
                Up to $1M Insurance
              </span>
              <span>
                <CheckIcon size={12} />
                Free Mattress Wraps
              </span>
              <span>
                <CheckIcon size={12} />
                {business.googleBusiness.hoursLabel}
              </span>
            </div>
          </div>
          <QuoteForm />
        </div>
      </section>

      <TrustBar />
      <ServiceTicker />
      <ServicesGrid />
      <section className="section home-intent-section">
        <div className="container">
          <SectionHeading
            eyebrow="Adelaide moving services"
            title={<>Choose the right <em>moving support</em></>}
            copy="Whether you are planning house moving, local removals, furniture support or a longer route, start with the service that matches the job and share the access and inventory details that shape the quote."
          />
          <div className="home-intent-links">
            <a href="/services/residential-removals"><strong>House movers in Adelaide</strong><span>Residential removals for homes, apartments and townhouses.</span></a>
            <a href="/services/furniture-removals"><strong>Furniture removalists Adelaide</strong><span>Plan large furniture, access, protection and placement.</span></a>
            <a href="/services/office-commercial-removals"><strong>Office movers Adelaide</strong><span>Workplace relocation around furniture, equipment and loading access.</span></a>
            <a href="/services/interstate-removals"><strong>Adelaide interstate removals</strong><span>Route, inventory, volume and access planning for longer moves.</span></a>
            <a href="/services/packing-unpacking"><strong>Packing services Adelaide</strong><span>Prepare, protect and label belongings before moving day.</span></a>
            <a href="/areas"><strong>Local removals Adelaide</strong><span>Browse the service-area directory and nearby planning pages.</span></a>
            <a href="/pricing"><strong>Adelaide removalist prices</strong><span>Compare crew rates, minimum service and call-out fees.</span></a>
            <a href="/services/backloading"><strong>Backloading enquiries</strong><span>Share your destination, volume and date flexibility for review.</span></a>
          </div>
        </div>
      </section>
      <BookingHowItWorksSection />
      <ApartmentAccessSection />
      <PricingSection />
      <VolumeGuidanceSection />
      <ServicePhotosSection />
      <ProcessSection />
      <ReviewsSection />
      <PackingSection />
      <LeadershipSection />
      <ContactMapSection />
      <FaqSection />
      <ServiceTicker locations />
      <AreasSection />
      <QuoteStrip />
    </SiteFrame>
  );
}

function PageHero({
  eyebrow,
  title,
  description,
  price,
  unit,
  media,
  quotePrimary = false,
}: {
  eyebrow: string;
  title: string;
  description: string;
  price?: string;
  unit?: string;
  media?: { src: string; alt: string; label: string };
  /** True for pages describing a service the /book wizard cannot actually
   * complete (interstate routes, backloading, etc.) — never send a
   * customer into a booking flow they can't finish. "Get a Quote"
   * becomes primary and Call stays secondary; no Book Now CTA at all. */
  quotePrimary?: boolean;
}) {
  return (
    <section className={`inner-hero ${media ? "inner-hero-media" : ""}`}>
      <div className="inner-orbit" aria-hidden="true" />
      <div className="container inner-hero-grid">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{description}</p>
          {quotePrimary ? (
            <div className="hero-actions">
              <a className="button button-ruby" href="/#quote">Get a Quote <span>→</span></a>
              <a className="button button-outline" href={business.phones[0].href}>Call {business.phones[0].display}</a>
            </div>
          ) : (
            <>
              <div className="hero-actions">
                <BookNowButton location="inner_hero">Book Now <span>→</span></BookNowButton>
                <a className="button button-outline" href={business.phones[0].href}>Call {business.phones[0].display}</a>
              </div>
              <p className="hero-quote-fallback">
                Not ready to book? <a href="/#quote">Get a Free Quote</a>
              </p>
            </>
          )}
          <div className="inner-proof" aria-label="HF business profile summary">
            <span><b>{business.googleBusiness.rating.toFixed(1)}★</b> Rating</span>
            <span><b>{business.googleBusiness.reviewCount}</b> Reviews</span>
            <span><b>Up to $1M</b> Insurance</span>
            <span><b>{business.googleBusiness.hoursShort}</b> Daily hours</span>
          </div>
        </div>
        {price ? (
          <div className="route-price">
            <span>Reference Rate</span>
            <strong>{price}</strong>
            <p>{unit}</p>
            <small>Final cost depends on volume and scope.</small>
          </div>
        ) : media ? (
          <figure className="inner-visual">
            <Image src={media.src} alt={media.alt} width={1672} height={941} sizes="(max-width: 900px) calc(100vw - 32px), (max-width: 1280px) 50vw, 600px" loading="eager" fetchPriority="high" />
            <figcaption>
              <span>HF Removals Adelaide</span>
              <strong>{media.label}</strong>
            </figcaption>
          </figure>
        ) : (
          <div className="inner-monogram">
            <img src={business.logo} alt="HF Removals Adelaide logo" width={business.logoWidth} height={business.logoHeight} loading="lazy" decoding="async" />
          </div>
        )}
      </div>
    </section>
  );
}

function mediaForPage(page: ContentPage) {
  if (page.kind === "route") return undefined;
  if (page.kind === "area")
    return {
      src: "/images/hf-residential-premium.webp",
      alt: "HF Removals Adelaide mover handing a pot plant to customers at the door of their new home, with the HF truck and cartons behind",
      label: "Local move planning",
    };
  if (page.kind === "guide") {
    if (page.slug.includes("office"))
      return {
        src: "/images/hf-office-premium.webp",
        alt: "HF Removals Adelaide movers wheeling cartons, office chairs and a filing cabinet into a city office building",
        label: "Practical moving guidance",
      };
    if (page.slug.includes("furniture") || page.slug.includes("packing"))
      return {
        src: "/images/hf-packing-premium.webp",
        alt: "HF Removals Adelaide movers shrink-wrapping a mattress and padded furniture inside a home",
        label: "Practical moving guidance",
      };
    return {
      src: "/images/hf-hero-truck-1024.webp",
      alt: "HF branded moving truck in an Adelaide streetscape",
      label: "Practical moving guidance",
    };
  }
  const serviceMedia: Record<string, { src: string; alt: string; label: string }> = {
    "office-commercial-removals": {
      src: "/images/hf-office-premium.webp",
      alt: "HF Removals Adelaide movers wheeling cartons, office chairs and a filing cabinet into a city office building",
      label: "Office & commercial moves",
    },
    "interstate-removals": {
      src: "/images/hf-interstate-premium.webp",
      alt: "HF Removals Adelaide truck parked at a home while two movers carry a sofa to the door",
      label: "Interstate moves",
    },
    backloading: {
      src: "/images/hf-interstate-premium.webp",
      alt: "HF Removals Adelaide truck parked at a home while two movers carry a sofa to the door",
      label: "Backloading enquiries",
    },
    "packing-unpacking": {
      src: "/images/hf-packing-premium.webp",
      alt: "HF Removals Adelaide movers shrink-wrapping a mattress and padded furniture inside a home",
      label: "Packing & protection",
    },
  };
  return (
    serviceMedia[page.slug] ?? {
      src: "/images/hf-residential-premium.webp",
      alt: "HF Removals Adelaide mover handing a pot plant to customers at the door of their new home, with the HF truck and cartons behind",
      label: "Residential moves",
    }
  );
}

function Breadcrumbs({ page }: { page: ContentPage }) {
  const area = page.kind === "area" ? hfServiceAreaRecords.find((item) => item.slug === page.slug) : undefined;
  const areaRegion = area?.region;
  const regionPage = areaRegion ? hfServiceAreaRecords.find((item) => item.name === areaRegion) : undefined;
  const group = page.kind === "route" ? "interstate" : `${page.kind}s`;
  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <a href="/">Home</a>
      <span>/</span>
      <a href={`/${group}`}>{group}</a>
      {areaRegion && regionPage && regionPage.slug !== area?.slug && <><span>/</span><a href={`/areas/${regionPage.slug}`}>{areaRegion}</a></>}
      <span>/</span>
      <span aria-current="page">{page.eyebrow}</span>
    </nav>
  );
}

type RelatedLink = { href: string; label: string; description: string };

// Rotated across the 139 area pages so their homepage links do not share one anchor.
const AREA_HOME_ANCHORS = ["Adelaide removalists", "Removalists across Adelaide", "Local Adelaide removalists"] as const;

function relatedLinksFor(page: ContentPage): RelatedLink[] {
  const shared: RelatedLink[] = [
    { href: "/pricing", label: "Removalist pricing", description: "Compare the supplied Adelaide and interstate pricing units." },
    { href: "/#quote", label: "Get a quote", description: "Send both addresses, inventory, access notes and your preferred date." },
  ];
  // Descriptive links back to the homepage, which owns the "Adelaide removalists" intent.
  // Anchors vary by page type so the sitewide pattern does not repeat one exact phrase.
  const homeLink = (label: string): RelatedLink => ({ href: "/", label, description: "See HF's moving services, published rates and quote form on the main page." });

  if (page.kind === "area") {
    const record = hfServiceAreaRecords.find((area) => area.slug === page.slug);
    const nearby = record
      ? (record.nearby.length ? record.nearby : hfServiceAreaRecords.filter((area) => area.region === record.region && area.slug !== page.slug).slice(0, 4).map((area) => area.name))
          .map((name) => hfServiceAreaRecords.find((area) => area.name === name))
          .filter((area): area is (typeof hfServiceAreaRecords)[number] => Boolean(area))
          .map((area) => ({ href: `/areas/${area.slug}`, label: `${area.name} removals`, description: `Review moving and access planning for ${area.name}.` }))
      : [];
    return [
      { href: "/areas", label: "Adelaide service areas", description: "Return to the directory to plan pickup and destination locations." },
      { href: "/services/residential-removals", label: "House removals", description: "Plan inventory, access, protection and destination placement." },
      { href: "/services/packing-unpacking", label: "Packing support", description: "Prepare cartons, furniture and high-care items before moving day." },
      record?.region === "Central Adelaide"
        ? { href: "/services/office-commercial-removals", label: "Office & commercial removalists", description: "Plan workplace furniture, equipment, building access and placement." }
        : { href: "/services/furniture-removals", label: "Furniture removalists in Adelaide", description: "Plan large furniture, access, protection and destination placement." },
      ...nearby,
      homeLink(AREA_HOME_ANCHORS[Math.max(0, hfServiceAreaRecords.findIndex((area) => area.slug === page.slug)) % AREA_HOME_ANCHORS.length]),
      ...shared,
    ];
  }

  if (page.slug === "residential-removals") {
    return [
      { href: "/adelaide-removalists", label: "Adelaide removalist services", description: "Compare local, apartment, office, interstate and packing support from HF." },
      { href: "/services/furniture-removals", label: "Furniture removalists", description: "Plan large furniture, access, protection and destination placement." },
      { href: "/services/packing-unpacking", label: "Packing support", description: "Prepare cartons, furniture and high-care items before moving day." },
      { href: "/areas", label: "Adelaide service areas", description: "Find local planning pages for the suburb and property access involved in your move." },
      homeLink("Removalists in Adelaide"),
      ...shared,
    ];
  }

  if (page.slug === "interstate-removals") {
    return [
      { href: "/interstate/adelaide-melbourne", label: "Adelaide to Melbourne removals", description: "Review the Melbourne route reference rate and inventory requirements." },
      { href: "/interstate/adelaide-sydney", label: "Adelaide to Sydney removals", description: "Prepare destination access and a useful volume estimate." },
      { href: "/interstate/adelaide-queensland", label: "Adelaide to Queensland removals", description: "Add the destination city, suburb and postcode to the enquiry." },
      { href: "/interstate/adelaide-perth", label: "Adelaide to Perth removals", description: "Plan bulky items, protection and longer-distance access." },
      { href: "/guides/preparing-interstate-move", label: "Prepare for an interstate move", description: "Use the inventory, route and packing checklist before requesting a quote." },
      homeLink("Removalists in Adelaide"),
      ...shared,
    ];
  }

  if (page.kind === "route") {
    return [
      { href: "/services/interstate-removals", label: "Interstate removals", description: "Understand the inventory and access details needed for an interstate enquiry." },
      { href: "/guides/preparing-interstate-move", label: "Interstate moving guide", description: "Prepare the route, volume and packing information before requesting a quote." },
      homeLink("Our Adelaide removalists"),
      ...shared,
    ];
  }

  if (page.kind === "guide") {
    const target = page.slug.includes("pricing") ? "/pricing" : page.slug.includes("interstate") || page.slug.includes("volume") ? "/services/interstate-removals" : page.slug.includes("office") ? "/services/office-commercial-removals" : page.slug.includes("packing") ? "/services/packing-unpacking" : page.slug.includes("furniture") ? "/services/furniture-removals" : "/services/residential-removals";
    const targetLabel = target === "/pricing" ? "Adelaide removalist prices and hourly rates" : services.find((service) => `/services/${service.slug}` === target)?.eyebrow ?? "House removals";
    return [
      { href: target, label: targetLabel, description: "Review the service and quote information for this planning topic." },
      { href: "/services", label: "Adelaide moving services", description: "Choose residential, office, interstate, backloading or packing support." },
      { href: "/areas", label: "Service areas", description: "Find moving-planning pages across Adelaide and selected regional corridors." },
      ...(target === "/services/interstate-removals" ? [{ href: "/services/backloading", label: "Backloading from Adelaide", description: "Ask whether available capacity suits your route, inventory and date flexibility." }] : []),
      homeLink("Our Adelaide removalists"),
      ...shared.filter((link) => link.href !== target),
    ];
  }

  // Choose complementary services deliberately: array order is not relevance.
  const relatedServiceSlugs: Record<string, string[]> = {
    "furniture-removals": ["residential-removals", "packing-unpacking", "interstate-removals"],
    "office-commercial-removals": ["furniture-removals", "packing-unpacking", "interstate-removals"],
    "packing-unpacking": ["residential-removals", "furniture-removals", "interstate-removals"],
    backloading: ["interstate-removals", "packing-unpacking", "furniture-removals"],
  };
  const serviceLinks = (relatedServiceSlugs[page.slug] ?? [])
    .map((slug) => services.find((service) => service.slug === slug))
    .filter((service): service is ContentPage => Boolean(service))
    .map((service) => ({
      href: `/services/${service.slug}`,
      label: service.eyebrow,
      description: service.description,
    }));
  const planningGuide = page.slug === "office-commercial-removals"
    ? guides.find((guide) => guide.slug.includes("office"))
    : page.slug === "packing-unpacking"
      ? guides.find((guide) => guide.slug.includes("packing"))
      : page.slug === "backloading"
        ? guides.find((guide) => guide.slug === "preparing-interstate-move")
        : guides.find((guide) => guide.slug === "adelaide-moving-checklist");
  return [
    ...serviceLinks,
    ...(planningGuide ? [{ href: `/guides/${planningGuide.slug}`, label: planningGuide.title, description: planningGuide.description }] : []),
    { href: "/areas", label: "Adelaide service areas", description: "Find pickup and destination planning information for your move." },
    { href: "/areas/adelaide-cbd", label: "Adelaide CBD moving access", description: "Prepare building access, loading and lift details." },
    { href: "/areas/north-adelaide", label: "North Adelaide move planning", description: "Review pickup and destination access before requesting a quote." },
    homeLink("Removalists in Adelaide"),
    ...shared,
  ];
}

function RelatedLinks({ page }: { page: ContentPage }) {
  return (
    <section className="related-links" aria-labelledby="related-links-title">
      <p className="eyebrow">Continue planning</p>
      <h2 id="related-links-title">Useful next steps for your move</h2>
      <div className="related-links-grid">
        {relatedLinksFor(page).map((link) => (
          <a href={link.href} key={link.href}>
            <strong>{link.label}</strong>
            <span>{link.description}</span>
            <b aria-hidden="true">→</b>
          </a>
        ))}
      </div>
    </section>
  );
}

// Services actually selectable/completable in the /book wizard today
// (see lib/booking's `services` seed — residential/furniture/office only).
// Interstate and backloading are per-cubic-metre quote-only, and
// packing-unpacking is a wizard add-on, not a standalone bookable
// service — none of the three can be booked as their own flow.
const BOOKABLE_SERVICE_SLUGS = new Set(["residential-removals", "furniture-removals", "office-commercial-removals"]);

export function DetailPage({ page }: { page: ContentPage }) {
  const area = page.kind === "area" ? hfServiceAreaRecords.find((item) => item.slug === page.slug) : undefined;
  const serviceHeadings: Record<string, string> = {
    "residential-removals": "House Removalists Adelaide",
    "furniture-removals": "Furniture Removalists Adelaide",
    "office-commercial-removals": "Office & Commercial Removalists Adelaide",
    "interstate-removals": "Interstate Removalists Adelaide",
    "packing-unpacking": "Packing & Unpacking Services Adelaide",
    backloading: "Backloading Enquiries from Adelaide",
  };
  const heading = area ? (area.name === "Playford" ? "Removalists Across Playford" : `Removalists in ${area.name}`) : page.kind === "service" ? serviceHeadings[page.slug] ?? page.title : page.title;
  // Areas are local-move coverage pages — genuinely bookable regardless
  // of slug. Guides are educational and don't map to one specific
  // service, so they get the neutral "Get a Quote" treatment rather than
  // guessing. Routes (interstate) are never bookable today.
  const isBookable = page.kind === "area" || (page.kind === "service" && BOOKABLE_SERVICE_SLUGS.has(page.slug));
  return (
    <SiteFrame>
      <PageHero eyebrow={page.eyebrow} title={heading} description={page.intro} price={page.price} unit={page.unit} media={mediaForPage(page)} quotePrimary={!isBookable} />
      <ServiceTicker />
      <section className="section detail-section">
        <div className="container">
          <Breadcrumbs page={page} />
          <div className="detail-grid">
            <article>
              <p className="eyebrow">What to plan</p>
              <h2>
                Practical details make a <em>clearer move</em>
              </h2>
              <div className="detail-bars">
                {page.highlights.map((item, index) => (
                  <div key={item}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <i />
                    <strong>{item}</strong>
                    <b />
                  </div>
                ))}
              </div>
            </article>
            <aside>
              {isBookable ? (
                <>
                  <p className="eyebrow">Ready to move?</p>
                  <h3>Book online in minutes</h3>
                  <p>Choose your move details, select an available time and confirm your booking online.</p>
                  <BookNowButton location="detail_sidebar">
                    Book Now <span>→</span>
                  </BookNowButton>
                  <a className="aside-call" href={business.phones[0].href}>
                    Or call {business.phones[0].display}
                  </a>
                  <a className="package-quote-link" href="/#quote">Not ready? Get a Quote instead</a>
                </>
              ) : (
                <>
                  <p className="eyebrow">Start your enquiry</p>
                  <h3>Share the essentials</h3>
                  <p>Both suburbs, move type, preferred date, and access notes help HF review the scope.</p>
                  <a className="button button-ruby" href="/#quote">
                    Get a Quote <span>→</span>
                  </a>
                  <a className="aside-call" href={business.phones[0].href}>
                    Or call {business.phones[0].display}
                  </a>
                </>
              )}
            </aside>
          </div>
          <div className="editorial-sections">
            {page.sections.map((section) => (
              <article key={section.title}>
                <h2>{section.title}</h2>
                <p>{section.body}</p>
              </article>
            ))}
          </div>
          <RelatedLinks page={page} />
        </div>
      </section>
      <FaqSection faqs={page.faqs} title={`Questions about ${page.eyebrow.toLowerCase()}`} />
      <QuoteStrip quotePrimary={!isBookable} />
    </SiteFrame>
  );
}

export function ListingPage({ kind }: { kind: "services" | "areas" | "interstate" | "guides" }) {
  const map = {
    services: {
      eyebrow: "HF services",
      title: "Moving support shaped around the job",
      description: "Explore residential, commercial, interstate, backloading and packing support.",
      items: services,
    },
    areas: {
      eyebrow: "Service areas",
      title: "Plan a move across Adelaide and regional SA",
      description: "Useful local planning pages for the areas listed in HF business material.",
      items: areas,
    },
    interstate: {
      eyebrow: "Interstate routes",
      title: "Volume-based connections from Adelaide",
      description: "Review route reference rates and prepare the inventory and access detail needed for a quote.",
      items: interstateRoutes,
    },
    guides: {
      eyebrow: "Moving guides",
      title: "Practical planning before moving day",
      description: "Customer-first checklists for pricing, packing, volume, apartments, offices and interstate preparation.",
      items: guides,
    },
  }[kind];
  return (
    <SiteFrame>
      <PageHero eyebrow={map.eyebrow} title={map.title} description={map.description} quotePrimary={kind === "interstate"} />
      <section className="section listing-section">
        <div className="container listing-grid">
            {map.items.map((item, index) => (
              <a key={item.slug} href={`/${kind}/${item.slug}`}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <h2>{item.eyebrow}</h2>
                <p>{item.description}</p>
                {kind === "services" && <ul className="listing-highlights">{item.highlights.slice(0, 2).map((highlight) => <li key={highlight}>{highlight}</li>)}</ul>}
                <b>Explore <i>→</i></b>
              </a>
          ))}
        </div>
      </section>
      <QuoteStrip quotePrimary={kind === "interstate"} />
    </SiteFrame>
  );
}

export function StaticPage({ type }: { type: "about" | "contact" | "pricing" | "adelaide" | "privacy" | "terms" }) {
  if (type === "pricing")
    return (
      <SiteFrame>
        <PageHero eyebrow="Clear billing units" title="Adelaide Removalist Prices & Hourly Rates" description="Compare the published rates for 2 or 3 movers and a truck, understand minimum service and call-out fees, and request a quote for your inventory and access." />
        <PricingSection />
        <section className="section detail-section">
          <div className="container">
            <nav className="breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span><span aria-current="page">Removalist pricing</span></nav>
            <div className="editorial-sections">
              <article><h2>How your local removalist cost is calculated</h2><p>Choose the crew package that suits your move. A 3-hour minimum service and a separate 1-hour call-out fee apply at the selected package rate. The call-out covers truck fuel and basic transport charges; it is not an extra hour of moving labour. Additional service time is billed in 30-minute increments. The final price is calculated after the move is completed.</p></article>
              <article><h2>What affects the time needed for your move?</h2><p>Prepare a room-by-room inventory, including garage and outdoor items. Tell HF about stairs, lift bookings, parking, the distance between the truck and each door, and furniture that needs special access planning. Loading, travel between addresses and unloading all need to be considered when discussing your move scope.</p></article>
              <article><h2>Compare the crew and packing requirements</h2><p>The published packages include 2 movers and a truck or 3 movers and a truck. Share your property size and inventory rather than choosing a package on price alone. Tell HF which items are already packed and whether you need <a href="/services/packing-unpacking">packing and unpacking support</a>, so the scope can be confirmed.</p></article>
              <article><h2>Interstate reference rates need a route and volume</h2><p>Interstate rates use cubic metres rather than the local hourly model. Provide both addresses, an item list, bulky-item dimensions, access notes and your preferred dates. Review <a href="/services/interstate-removals">interstate removal planning</a> and the route pages above; reference rates are not a fixed quote or a confirmed delivery schedule.</p></article>
              <article><h2>Get a quote for your Adelaide move</h2><p>Send both addresses, your preferred date, property size, inventory and access notes through the <a href="/#quote">move quote form</a>. For examples of how to compare estimates, read <a href="/guides/how-removalist-pricing-works">how removalist pricing works</a>. This page remains the place to check HF’s published rates.</p></article>
            </div>
          </div>
        </section>
        <VolumeGuidanceSection />
        <FaqSection faqs={standardMoveFaqs.slice(0, 2)} title="Adelaide removalist pricing questions" />
        <QuoteStrip />
      </SiteFrame>
    );
  if (type === "about")
    return (
      <SiteFrame>
        <PageHero eyebrow="About HF Removals Adelaide" title="Clear communication, careful handling, practical support" description="HF plans local and interstate moves around the details supplied by each customer." />
        <LeadershipSection />
        <ReviewsSection />
        <ProcessSection />
        <PackingSection />
        <QuoteStrip />
      </SiteFrame>
    );
  if (type === "contact")
    return (
      <SiteFrame>
        <PageHero eyebrow="Contact HF" title="Let’s start with the details of your move" description="Call, email or send the quote form with both addresses, date, property size and move type." />
        <section className="section contact-section">
          <div className="container contact-grid">
            <div>
              <p className="eyebrow">Contact details</p>
              <h2>Talk to HF Removals Adelaide</h2>
              <a href={business.phones[0].href}>
                <span>Primary phone</span>
                {business.phones[0].display}
              </a>
              <a href={business.phones[1].href}>
                <span>Secondary phone</span>
                {business.phones[1].display}
              </a>
              <a href={`mailto:${business.emails[0]}`}>
                <span>Email enquiries</span>
                {business.emails[0]}
              </a>
              <address>
                <span>Business base</span>
                {business.address.full}
                <small>{business.googleBusiness.hoursLabel}. Serving all Adelaide metro, hills, and regional SA.</small>
              </address>
            </div>
            <QuoteForm compact />
          </div>
        </section>
        <ContactMapSection />
        <ReviewsSection />
        <QuoteStrip />
      </SiteFrame>
    );
  if (type === "adelaide")
    return (
      <SiteFrame>
        <PageHero eyebrow="Adelaide moving guide" title="Adelaide moving services, pricing and planning" description="Compare HF's Adelaide moving services, supplied reference rates, packing support and practical move-planning resources before requesting a tailored quote." />
        <ServicesGrid />
        <ApartmentAccessSection />
        <PricingSection />
        <ProcessSection />
        <AreasSection />
        <QuoteStrip />
      </SiteFrame>
    );
  const privacy = type === "privacy";
  return (
    <SiteFrame>
      <PageHero
        eyebrow={privacy ? "Privacy" : "Website terms"}
        title={privacy ? "How enquiry information is handled" : "Using the HF Removals Adelaide website"}
        description={privacy ? "A concise explanation of the information used to respond to move enquiries." : "General website information and important limits around published pricing and coverage wording."}
      />
      <section className="section legal">
        <div className="container prose">
          <h2>{privacy ? "Enquiry information" : "General information"}</h2>
          <p>
            {privacy
              ? "When you submit a quote enquiry, the details you provide are used to review and respond to your move request. The form includes contact, route, date, property and move-scope information."
              : "Website content is general information. A quote for an individual move depends on the confirmed inventory, access, route, packing requirements and other scope details."}
          </p>
          <h2>{privacy ? "Contact and delivery" : "Pricing and insurance wording"}</h2>
          <p>
            {privacy
              ? `HF can also be contacted directly at ${business.emails[0]} or ${business.phones[0].display}. Quote-form details are sent to HF through Web3Forms, a third-party form-delivery service, so the information you enter is shared with that provider for delivery of your enquiry.`
              : "Published prices are reference rates reproduced from supplied business material. Interstate prices are per cubic metre, not total move prices. Insurance references are subject to applicable policy terms and the individual move scope."}
          </p>
          <h2>Contact</h2>
          <p>
            Questions can be sent to <a href={`mailto:${business.emails[0]}`}>{business.emails[0]}</a>.
          </p>
        </div>
      </section>
    </SiteFrame>
  );
}
