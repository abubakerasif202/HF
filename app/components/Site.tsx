import { areas, business, ContentPage, entryLocalRate, googleReviews, guides, interstatePricing, interstateRoutes, localPricing, services, standardMoveFaqs } from "../../lib/site-data";
import { Header, MobileStickyCta, MotionExperience, QuoteForm, UtilityBar } from "./SiteClient";

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
      title: `${business.googleBusiness.rating} Google Rating`,
      desc: `${business.googleBusiness.reviewCount}+ Verified Adelaide Reviews`,
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
                  <li key={h}>✓ {h}</li>
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
    { title: "Stairways & Tight Hallways", desc: "Expert manoeuvring for oversized lounges, double fridges, and king beds without wall marks." },
    { title: "Common Area & Floor Protection", desc: "Complimentary floor runners, corner guards, and mattress protection to safeguard shared spaces." },
  ];

  return (
    <section className="section apartment-section" aria-labelledby="apartment-title">
      <div className="container apartment-grid">
        <div className="apartment-media">
          <img src="/images/hf-apartment-removals.webp" alt="HF Removals Adelaide crew moving labelled cartons into a residential property" width="1672" height="941" loading="lazy" />
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
                <span className="point-check">✓</span>
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
              <img src={photo.src} alt={photo.alt} width="1672" height="941" loading="lazy" />
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

function PricingSection() {
  return (
    <section className="section pricing-section" id="pricing">
      <div className="container">
        <SectionHeading
          eyebrow="Transparent Billing Rates"
          title={<>Published Reference Rates, <em>Clearly Explained</em></>}
          copy="Local Adelaide moves use fair 30-minute billing increments. Interstate moves are charged on clear per-cubic-metre rates."
        />
        <div className="local-pricing">
          {localPricing.map((item, index) => (
            <article className={`price-card ${index === 0 ? "price-card--popular" : ""}`} key={item.name}>
              {index === 0 && <span className="price-popular-badge">Most Popular</span>}
              <span className="ruby-dot" aria-hidden="true" />
              <p className="price-kicker">{index === 0 ? "Most Popular for 1-3 Bedrooms" : "Ideal for 3-5 Bedrooms & Large Homes"}</p>
              <h3>{item.name}</h3>
              <div className="price-value">
                <strong>{item.halfHour}</strong>
                <span>/ 30 min</span>
              </div>
              <p className="price-hourly">{item.hourly} per hour</p>
              <ul className="price-features">
                <li>✓ Full truck equipped with blankets & straps</li>
                <li>✓ Complimentary mattress protection wrap</li>
                <li>✓ No extra charges for stairs (disclosed in brief)</li>
                <li>✓ {business.insurance}; terms apply</li>
              </ul>
              <a className="button button-ruby" href="/#quote">Book This Option</a>
            </article>
          ))}
        </div>

        <div className="interstate-table">
          <div className="table-intro">
            <p className="eyebrow">Interstate Volume Pricing</p>
            <h3>Route Reference Rates</h3>
            <p>Calculated per cubic metre (m³) so you only pay for the exact volume you transport.</p>
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
              <span className="rating-stars" aria-hidden="true">★★★★★</span>
            </div>
            <strong>{google.rating} / 5.0</strong>
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
                  <span className="review-stars" aria-label="5 out of 5 stars">★★★★★</span>
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
          <SectionHeading eyebrow="Company Leadership" title={<>Meet <em>Muhammad Rasheed</em></>} />
          <p className="leader-title">CEO & Founder, HF Removals Adelaide</p>
          <p>
            HF Removals Adelaide receives enquiries from its Elizabeth Vale base for local, commercial and listed interstate moves. Each quote is scoped around inventory, access, protection and destination details.
          </p>
          <div className="leader-stats">
            <div>
              <strong>{business.googleBusiness.reviewCount}+</strong>
              <span>5-Star Reviews</span>
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
                <b>✓</b> {item}
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
    ["Instant Quote", "Submit your move dates, suburbs, and inventory."],
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
  return (
    <section className="section areas-section" id="areas">
      <div className="container">
        <SectionHeading
          eyebrow="Adelaide & Regional Coverage"
          title={<>Local Move Planning Across <em>All Adelaide Suburbs</em></>}
          copy="Servicing Northern Suburbs, Southern Suburbs, Adelaide CBD, Western Coastal Areas, Adelaide Hills, and Regional SA."
          light
        />
        <div className="area-links">
          {areas.map((area) => (
            <a key={area.slug} href={`/areas/${area.slug}`}>
              <span>{area.eyebrow}</span>
              <b>↗</b>
            </a>
          ))}
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
        <SectionHeading eyebrow="Answers & Guidance" title={title} copy="Have a specific question about your upcoming move? Call our team anytime." />
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

function QuoteStrip() {
  return (
    <section className="quote-strip">
      <div className="container">
        <div>
          <p className="eyebrow">Ready For A Smooth Move?</p>
          <h2>Get Your Free, Transparent Quote From HF Removals Today.</h2>
        </div>
        <div className="quote-strip-actions">
          <a className="button button-ruby" href="/#quote">Request Free Quote <span>→</span></a>
          <a className="button button-outline" href={business.phones[0].href}>Call {business.phones[0].display}</a>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div className="footer-brand">
          <img src={business.logo} alt="HF Removals Adelaide" width={business.logoWidth} height={business.logoHeight} loading="lazy" decoding="async" />
          <p className="footer-tagline">“{business.tagline}”</p>
          <address>
            <a href={business.phones[0].href} className="footer-phone">
              📞 {business.phones[0].display} (Primary)
            </a>
            <a href={business.phones[1].href}>📞 {business.phones[1].display} (Secondary)</a>
            <a href={`mailto:${business.emails[0]}`}>✉️ {business.emails[0]}</a>
            <span>📍 {business.address.full}</span>
            <span>⭐ {business.googleBusiness.rating} Google Rating · {business.googleBusiness.reviewCount} Reviews</span>
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
          <a href="/pricing">Pricing Guide</a>
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
              <span className="hero-badge-star">★</span>
              <span>{business.googleBusiness.rating} RATED ADELAIDE REMOVALISTS ({business.googleBusiness.reviewCount}+ REVIEWS)</span>
            </div>
            <h1>
              Adelaide <em>Removalists</em>
              <br />
              You Can Rely On
            </h1>
            <p className="hero-lead">
              HF is an Adelaide moving company for home, apartment, office and interstate moves, with published reference rates. Coverage includes {business.insurance}, subject to applicable policy terms.
            </p>
            <div className="hero-actions">
              <a className="button button-ruby" href="#quote">
                Get a Free Quote <span>→</span>
              </a>
              <a className="button button-outline" href={business.phones[0].href}>
                Call {business.phones[0].display}
              </a>
            </div>
            <div className="hero-proof-pills">
              <span>✓ Local Adelaide Crew</span>
              <span>✓ Up to $1M Insurance</span>
              <span>✓ Free Mattress Wraps</span>
              <span>✓ {business.googleBusiness.hoursLabel}</span>
            </div>
          </div>
          <QuoteForm />
        </div>
      </section>

      <TrustBar />
      <ServiceTicker />
      <ServicesGrid />
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
}: {
  eyebrow: string;
  title: string;
  description: string;
  price?: string;
  unit?: string;
  media?: { src: string; alt: string; label: string };
}) {
  return (
    <section className={`inner-hero ${media ? "inner-hero-media" : ""}`}>
      <div className="inner-orbit" aria-hidden="true" />
      <div className="container inner-hero-grid">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{description}</p>
          <div className="hero-actions">
            <a className="button button-ruby" href="/#quote">Get a free quote <span>→</span></a>
            <a className="button button-outline" href={business.phones[0].href}>Call {business.phones[0].display}</a>
          </div>
          <div className="inner-proof" aria-label="HF business profile summary">
            <span><b>{business.googleBusiness.rating}★</b> Rating</span>
            <span><b>{business.googleBusiness.reviewCount}</b> Reviews</span>
            <span><b>Up to $1M</b> Insurance</span>
            <span><b>24h</b> Enquiries</span>
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
            <img src={media.src} alt={media.alt} width="1672" height="941" />
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
  const group = page.kind === "route" ? "interstate" : `${page.kind}s`;
  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <a href="/">Home</a>
      <span>/</span>
      <a href={`/${group}`}>{group}</a>
      <span>/</span>
      <span aria-current="page">{page.eyebrow}</span>
    </nav>
  );
}

export function DetailPage({ page }: { page: ContentPage }) {
  const heading = page.kind === "service" || page.kind === "area" ? `${page.eyebrow}: ${page.title}` : page.title;
  return (
    <SiteFrame>
      <PageHero eyebrow={page.eyebrow} title={heading} description={page.intro} price={page.price} unit={page.unit} media={mediaForPage(page)} />
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
              <p className="eyebrow">Start your enquiry</p>
              <h3>Share the essentials</h3>
              <p>Both suburbs, move type, preferred date, and access notes help HF review the scope.</p>
              <a className="button button-ruby" href="/#quote">
                Request a quote <span>→</span>
              </a>
              <a className="aside-call" href={business.phones[0].href}>
                Or call {business.phones[0].display}
              </a>
            </aside>
          </div>
          <div className="editorial-sections">
            {page.sections.map((section) => (
              <article key={section.title}>
                <h3>{section.title}</h3>
                <p>{section.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <FaqSection faqs={page.faqs} title={`Questions about ${page.eyebrow.toLowerCase()}`} />
      <QuoteStrip />
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
      <PageHero eyebrow={map.eyebrow} title={map.title} description={map.description} />
      <section className="section listing-section">
        <div className="container listing-grid">
          {map.items.map((item, index) => (
            <a key={item.slug} href={`/${kind}/${item.slug}`}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h2>{item.eyebrow}</h2>
              <p>{item.description}</p>
              <b>Explore <i>→</i></b>
            </a>
          ))}
        </div>
      </section>
      <QuoteStrip />
    </SiteFrame>
  );
}

export function StaticPage({ type }: { type: "about" | "contact" | "pricing" | "adelaide" | "privacy" | "terms" }) {
  if (type === "pricing")
    return (
      <SiteFrame>
        <PageHero eyebrow="Clear billing units" title="Pricing for Adelaide and interstate moves" description="Compare supplied local time-based rates and interstate per-cubic-metre reference rates." />
        <PricingSection />
        <VolumeGuidanceSection />
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
                <span>Primary phone (24/7)</span>
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
        <PageHero eyebrow="Adelaide moving hub" title="Services, pricing and move-planning resources" description="Compare Adelaide service options, published reference rates, packing support and practical planning considerations in one place." />
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
