import { areas, business, ContentPage, guides, interstatePricing, interstateRoutes, localPricing, services } from "../../lib/site-data";
import { Header, MobileStickyCta, OpeningSequence, QuoteForm } from "./SiteClient";

export function ServiceTicker({ locations = false }: { locations?: boolean }) {
  const items = locations
    ? ["ADELAIDE", "ELIZABETH VALE", "ELIZABETH", "SALISBURY", "BLAKEVIEW", "GAWLER", "ADELAIDE METRO"]
    : ["RESIDENTIAL REMOVALS", "OFFICE RELOCATIONS", "INTERSTATE MOVES", "BACKLOADING", "PACKING & UNPACKING"];
  const content = [...items, ...items];
  return <div className="ticker" tabIndex={0}><p className="sr-only">{items.join(", ")}. Focus pauses the moving ticker.</p><div className="ticker-track" aria-hidden="true">{content.map((item, index) => <span key={`${item}-${index}`}>{item}<b>◆</b></span>)}</div></div>;
}

function TrustBar() {
  const items = [`${business.googleBusiness.rating} Google rating`, `${business.googleBusiness.reviewCount} Google reviews`, business.googleBusiness.hoursLabel, business.insurance, "Local & interstate"];
  return <div className="trust-bar">{items.map((item, index) => <div key={item}><span>{String(index + 1).padStart(2, "0")}</span><p>{item}</p></div>)}</div>;
}

function SectionHeading({ eyebrow, title, copy, light = false }: { eyebrow: string; title: React.ReactNode; copy?: string; light?: boolean }) {
  return <div className={`section-heading ${light ? "light" : ""}`}><p className="eyebrow">{eyebrow}</p><h2>{title}</h2>{copy && <p>{copy}</p>}</div>;
}

function ServicesGrid() {
  return <section className="section services-section" id="services"><div className="container"><SectionHeading eyebrow="Our services" title={<>Moving solutions <em>tailored to you</em></>} copy="Choose the support that fits the property, inventory, route and level of packing help involved." /><div className="service-grid">{services.map((service, index) => <a className="service-card" href={`/services/${service.slug}`} key={service.slug}><span className="card-number">{String(index + 1).padStart(2, "0")}</span><div className="card-line" /><h3>{service.eyebrow}</h3><p>{service.description}</p><span className="card-link">Explore service <b>→</b></span></a>)}</div></div></section>;
}

const servicePhotos = [
  {
    src: "/images/hf-residential-removals.webp",
    href: "/services/residential-removals",
    label: "Residential removals",
    copy: "Home moving support planned around access, inventory and final placement.",
    alt: "HF Removals Adelaide team loading cartons into a moving truck outside a home",
  },
  {
    src: "/images/hf-furniture-removals.webp",
    href: "/services/residential-removals",
    label: "Furniture handling",
    copy: "Practical preparation and careful handling for furniture and larger household items.",
    alt: "HF Removals Adelaide movers carrying a sofa from a home",
  },
  {
    src: "/images/hf-office-removals.webp",
    href: "/services/office-commercial-removals",
    label: "Office relocations",
    copy: "Coordinated workplace moves for furniture, equipment and destination zones.",
    alt: "HF Removals Adelaide team moving office furniture and cartons",
  },
  {
    src: "/images/hf-interstate-removals.webp",
    href: "/services/interstate-removals",
    label: "Interstate moves",
    copy: "Long-distance moving support scoped around route, volume, access and protection.",
    alt: "HF Removals Adelaide interstate moving truck travelling at sunset",
  },
] as const;

function ServicePhotosSection() {
  return <section className="section service-photos-section" aria-label="HF moving services gallery"><div className="container"><SectionHeading eyebrow="Moving support in action" title={<>The right setup for <em>every kind of move</em></>} copy="Explore HF support for homes, furniture, workplaces and interstate relocations." light /><div className="service-photo-grid">{servicePhotos.map((photo, index) => <a className="service-photo-card" href={photo.href} key={photo.src}><img src={photo.src} alt={photo.alt} width="1672" height="941" loading="lazy" /><span className="service-photo-shade" /><span className="service-photo-copy"><small>{String(index + 1).padStart(2, "0")}</small><strong>{photo.label}</strong><span>{photo.copy}</span><b>Explore service →</b></span></a>)}</div></div></section>;
}

function PricingSection() {
  return <section className="section pricing-section"><div className="container"><SectionHeading eyebrow="Adelaide move rates" title={<>Simple pricing, <em>clearly measured</em></>} copy="Local rates use 30-minute billing units. Interstate reference rates are shown per cubic metre." /><div className="local-pricing">{localPricing.map((item, index) => <article className="price-card" key={item.name}><span className="ruby-dot" /><p className="price-kicker">Option {index + 1}</p><h3>{item.name}</h3><div className="price-value"><strong>{item.halfHour}</strong><span>/ 30 min</span></div><p>{item.hourly} per hour</p></article>)}</div><div className="interstate-table"><div className="table-intro"><p className="eyebrow">Interstate volume rates</p><h3>Route reference pricing</h3><p>Final move cost depends on the volume and scope of the move.</p></div><div>{interstatePricing.map((item) => <a href={`/interstate/${item.slug}`} key={item.slug}><span>{item.label}</span><strong>{item.price}<small>{item.unit}</small></strong></a>)}</div></div><p className="pricing-note">Published rates are reproduced from supplied HF business material. Ask HF which charges and terms apply to your individual move.</p></div></section>;
}

function VolumeGuidanceSection() {
  return <section className="volume-guidance" aria-labelledby="volume-guidance-title"><div className="container"><div className="volume-heading"><p className="eyebrow">Truck volume guidance</p><h2 id="volume-guidance-title">A practical starting point for <em>estimating volume</em></h2><p>These ranges are guidance only. Your inventory, access, packing and complete move scope determine the quote.</p></div><div className="volume-grid">{business.truckVolumeGuidance.map((item) => <article key={item.label}><span>{item.label}</span><strong>{item.volume}</strong><p>{item.examples.join(" · ")}</p></article>)}</div></div></section>;
}

function ReviewsSection() {
  const google = business.googleBusiness;
  return <section className="section reviews-section" aria-labelledby="google-proof-title"><div className="container reviews-grid"><div><p className="eyebrow">Verified Google profile snapshot</p><h2 id="google-proof-title">Trusted by Adelaide movers</h2><p className="reviews-copy">A strong public rating is one useful signal. The practical details of your own move still shape the quote, preparation and service scope.</p><p className="verification-note">Profile details verified {google.verifiedAt}.</p></div><div className="rating-card" aria-label={`${google.rating} out of 5 from ${google.reviewCount} Google reviews`}><span className="google-label">Google rating</span><strong>{google.rating}</strong><span className="rating-stars" aria-hidden="true">★★★★★</span><p>{google.reviewCount} reviews</p><small>{google.hoursLabel} · {google.category}</small></div></div></section>;
}

function ContactMapSection() {
  const google = business.googleBusiness;
  return <section className="contact-map-section" aria-labelledby="contact-map-title"><div className="container contact-map-grid"><div><p className="eyebrow">Elizabeth Vale location</p><h2 id="contact-map-title">Find HF Removals Adelaide</h2><p>{business.address}</p><dl><div><dt>Hours</dt><dd>{google.hoursLabel}</dd></div><div><dt>Category</dt><dd>{google.category}</dd></div><div><dt>Plus Code</dt><dd>{google.plusCode}</dd></div></dl><a className="button button-gold" href={google.directionsUrl}>Get directions</a><p className="verification-note">Google profile details verified {google.verifiedAt}. Please confirm before visiting; this address is not represented as a public showroom.</p></div><div className="map-frame"><iframe src={google.mapEmbedUrl} title="Google map showing HF Removals Adelaide in Elizabeth Vale" loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen /></div></div></section>;
}

function ProcessSection() {
  const steps = [["Enquire", "Share the addresses, date and essentials."], ["Scope the move", "Build the inventory and access picture."], ["Plan the move", "Confirm packing and placement details."], ["Moving day", "Work from the agreed practical plan."], ["Placement", "Direct items to their destination rooms."]];
  return <section className="section process-section"><div className="container"><SectionHeading eyebrow="The moving process" title={<>Five clear steps from <em>enquiry to placement</em></>} light /><ol className="process-line">{steps.map(([title, copy], index) => <li key={title}><span>{String(index + 1).padStart(2, "0")}</span><h3>{title}</h3><p>{copy}</p></li>)}</ol></div></section>;
}

function LeadershipSection() {
  return <section className="section leadership"><div className="container leadership-grid"><div className="portrait-wrap"><div className="portrait-backdrop" /><img src={business.ceoImage} alt="Muhammad Rasheed, CEO of HF Removals Adelaide" width="800" height="1000" loading="lazy" /><span className="portrait-accent" /></div><div><SectionHeading eyebrow="Leadership you can trust" title={<>Meet <em>Muhammad Rasheed</em></>} /><p className="leader-title">CEO, HF Removals Adelaide</p><p>HF Removals Adelaide focuses on making the moving process clear, organised and easier for customers.</p><p>From local moves through to interstate relocations, the team works around the details of each move, including access, inventory, packing requirements and destination.</p><p>Muhammad Rasheed leads HF Removals Adelaide with a focus on clear communication, careful handling and practical moving support.</p><a className="text-link" href="/about">About HF Removals Adelaide <span>→</span></a></div></div></section>;
}

function PackingSection() {
  return <section className="section packing-section"><div className="container packing-grid"><div><p className="eyebrow">Protection & preparation</p><h2>Pack with the move <em>in mind</em></h2><p>Tell HF which items need added preparation so the right support can be discussed before moving day.</p><div className="check-list">{business.packingMaterials.map((item) => <span key={item}><b>✓</b>{item}</span>)}</div><a className="button button-gold" href="/services/packing-unpacking">Packing support</a></div><div className="insurance-panel"><span className="panel-number">01 — COVERAGE WORDING</span><strong>Up to<br /><em>$1,000,000</em></strong><h3>Public Liability & Transit Insurance</h3><p>{business.insuranceQualifier}</p></div></div></section>;
}

function AreasSection() {
  return <section className="section areas-section"><div className="container"><SectionHeading eyebrow="Local service areas" title={<>Move planning across <em>Adelaide and beyond</em></>} copy="HF accepts enquiries across the listed Adelaide areas and South Australian regional locations. No suburb page represents a separate branch." light /><div className="map-lines" aria-hidden="true"><span /><span /><span /><b>HF</b></div><div className="area-links">{areas.map((area) => <a key={area.slug} href={`/areas/${area.slug}`}>{area.eyebrow}<span>↗</span></a>)}<a href="/adelaide-removalists">Adelaide Metro planning<span>↗</span></a></div></div></section>;
}

function QuoteStrip() {
  return <section className="quote-strip"><div className="container"><div><p className="eyebrow">Planning a move?</p><h2>Tell us where you&apos;re moving from — and where you&apos;re going.</h2></div><div><a className="button button-ruby" href="/#quote">Get a free quote</a><a className="button button-outline" href={business.phones[0].href}>Call {business.phones[0].display}</a></div></div></section>;
}

function Footer() {
  return <footer className="site-footer"><div className="container footer-grid"><div className="footer-brand"><img src={business.logo} alt="HF Removals Adelaide" width="1679" height="937" /><p>{business.tagline}</p><address><a href={business.phones[0].href}>{business.phones[0].display}</a><a href={business.phones[1].href}>{business.phones[1].display}</a><a href={`mailto:${business.emails[0]}`}>{business.emails[0]}</a><span>{business.address}</span><span>{business.googleBusiness.rating} Google rating · {business.googleBusiness.reviewCount} reviews</span></address></div><div><h3>Services</h3>{services.map((item) => <a href={`/services/${item.slug}`} key={item.slug}>{item.eyebrow}</a>)}</div><div><h3>Areas</h3>{areas.map((item) => <a href={`/areas/${item.slug}`} key={item.slug}>{item.eyebrow}</a>)}</div><div><h3>Plan your move</h3>{interstateRoutes.map((item) => <a href={`/interstate/${item.slug}`} key={item.slug}>{item.eyebrow}</a>)}<a href="/guides">Moving guides</a></div></div><div className="container footer-bottom"><span>© {new Date().getFullYear()} HF Removals Adelaide</span><span><a href="/privacy">Privacy</a><a href="/terms">Terms</a></span></div></footer>;
}

export function SiteFrame({ children, intro = false }: { children: React.ReactNode; intro?: boolean }) {
  return <><a className="skip-link" href="#main">Skip to content</a>{intro && <OpeningSequence />}<Header /><main id="main">{children}</main><Footer /><MobileStickyCta /></>;
}

export function HomePage() {
  return <SiteFrame intro><section className="hero"><img className="hero-image" src="/images/hf-hero-truck-1792.webp" srcSet="/images/hf-hero-truck-480.webp 480w, /images/hf-hero-truck-768.webp 768w, /images/hf-hero-truck-1024.webp 1024w, /images/hf-hero-truck-1440.webp 1440w, /images/hf-hero-truck-1792.webp 1792w" sizes="100vw" alt="HF branded moving truck in an Adelaide streetscape" width="1792" height="896" fetchPriority="high" /><div className="hero-overlay" /><div className="container hero-grid"><div className="hero-copy"><p className="eyebrow hero-eyebrow">Adelaide local & interstate removalists</p><h1>Adelaide <em>Removalists</em><br />You Can<br />Rely On</h1><p className="hero-lead">From the first box to the final placement, HF Removals Adelaide provides carefully planned local and interstate moving support.</p><div className="hero-actions"><a className="button button-gold" href="#quote">Get a free quote</a><a className="button button-outline" href={business.phones[0].href}>Call us now</a></div><div className="hero-proof"><span>{business.googleBusiness.rating} Google rating</span><span>{business.googleBusiness.reviewCount} reviews</span><span>{business.googleBusiness.hoursLabel}</span></div></div><QuoteForm /></div><div className="container trust-wrap"><TrustBar /></div></section><ServiceTicker /><ServicesGrid /><ServicePhotosSection /><PricingSection /><VolumeGuidanceSection /><ProcessSection /><PackingSection /><LeadershipSection /><ReviewsSection /><ServiceTicker locations /><AreasSection /><QuoteStrip /></SiteFrame>;
}

function PageHero({ eyebrow, title, description, price, unit }: { eyebrow: string; title: string; description: string; price?: string; unit?: string }) {
  return <section className="inner-hero"><div className="inner-orbit" aria-hidden="true" /><div className="container inner-hero-grid"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p><div className="hero-actions"><a className="button button-gold" href="/#quote">Get a free quote</a><a className="button button-outline" href={business.phones[0].href}>Call HF</a></div></div>{price ? <div className="route-price"><span>Reference rate</span><strong>{price}</strong><p>{unit}</p><small>Final cost depends on volume and scope.</small></div> : <div className="inner-monogram"><img src={business.logo} alt="" width="1679" height="937" /></div>}</div></section>;
}

function Breadcrumbs({ page }: { page: ContentPage }) {
  const group = page.kind === "route" ? "interstate" : `${page.kind}s`;
  return <nav className="breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span><a href={`/${group}`}>{group}</a><span>/</span><span aria-current="page">{page.eyebrow}</span></nav>;
}

export function DetailPage({ page }: { page: ContentPage }) {
  const heading = page.kind === "service" || page.kind === "area" ? `${page.eyebrow}: ${page.title}` : page.title;
  return <SiteFrame><PageHero eyebrow={page.eyebrow} title={heading} description={page.intro} price={page.price} unit={page.unit} /><ServiceTicker /><section className="section detail-section"><div className="container"><Breadcrumbs page={page} /><div className="detail-grid"><article><p className="eyebrow">What to plan</p><h2>Practical details make a <em>clearer move</em></h2><div className="detail-bars">{page.highlights.map((item, index) => <div key={item}><span>{String(index + 1).padStart(2, "0")}</span><i /><strong>{item}</strong><b /></div>)}</div></article><aside><p className="eyebrow">Start your enquiry</p><h3>Share the essentials</h3><p>Addresses, date, property size, move type and access notes help HF review the scope.</p><a className="button button-ruby" href="/#quote">Request a quote</a></aside></div><div className="editorial-sections">{page.sections.map((section, index) => <article key={section.title}><span>{String(index + 1).padStart(2, "0")}</span><h3>{section.title}</h3><p>{section.body}</p></article>)}</div></div></section><FaqSection faqs={page.faqs} title={`Questions about ${page.eyebrow.toLowerCase()}`} /><QuoteStrip /></SiteFrame>;
}

function FaqSection({ faqs, title }: { faqs: { question: string; answer: string }[]; title: string }) {
  return <section className="section faq-section"><div className="container faq-grid"><SectionHeading eyebrow="Frequently asked" title={title} /> <div>{faqs.map((faq) => <details key={faq.question}><summary>{faq.question}<span>+</span></summary><p>{faq.answer}</p></details>)}</div></div></section>;
}

export function ListingPage({ kind }: { kind: "services" | "areas" | "interstate" | "guides" }) {
  const map = {
    services: { eyebrow: "HF services", title: "Moving support shaped around the job", description: "Explore residential, commercial, interstate, backloading and packing support.", items: services },
    areas: { eyebrow: "Service areas", title: "Plan a move across Adelaide and regional SA", description: "Useful local planning pages for the areas listed in HF business material.", items: areas },
    interstate: { eyebrow: "Interstate routes", title: "Volume-based connections from Adelaide", description: "Review route reference rates and prepare the inventory and access detail needed for a quote.", items: interstateRoutes },
    guides: { eyebrow: "Moving guides", title: "Practical planning before moving day", description: "Customer-first checklists for pricing, packing, volume, apartments, offices and interstate preparation.", items: guides },
  }[kind];
  return <SiteFrame><PageHero eyebrow={map.eyebrow} title={map.title} description={map.description} /><section className="section listing-section"><div className="container listing-grid">{map.items.map((item, index) => <a key={item.slug} href={`/${kind}/${item.slug}`}><span>{String(index + 1).padStart(2, "0")}</span><h2>{item.eyebrow}</h2><p>{item.description}</p><b>Explore <i>→</i></b></a>)}</div></section><QuoteStrip /></SiteFrame>;
}

function AdelaideHubSection() {
  const pillars = [
    ["Residential planning", "Build a room-by-room inventory and describe access at both Adelaide properties before moving day."],
    ["Commercial coordination", "Name site contacts, group furniture and equipment, and share loading or lift requirements."],
    ["Packing choices", "Decide whether you need complete packing, selected-room help or protection for particular furniture."],
    ["Interstate connections", "Use the published per-m³ route figures as references, then confirm volume, destination and scope."],
  ];
  return <section className="section adelaide-hub"><div className="container"><div className="hub-intro"><div><p className="eyebrow">Adelaide moving overview</p><h2>Start with the property, <em>not a generic package</em></h2></div><p>Adelaide moves can involve a house, apartment, workplace, interstate destination or packing-only requirement. HF reviews the information you provide across the complete job: addresses, access, inventory, timing, packing and placement.</p></div><div className="hub-pillars">{pillars.map(([title, copy], index) => <article key={title}><span>{String(index + 1).padStart(2, "0")}</span><h3>{title}</h3><p>{copy}</p></article>)}</div><div className="hub-planning"><h3>Details to prepare for an Adelaide quote</h3><ul><li>Both addresses or suburbs</li><li>Preferred moving date</li><li>Property size and move type</li><li>Inventory or volume estimate</li><li>Stairs, lifts and parking access</li><li>Packing and protection needs</li></ul></div></div></section>;
}

export function StaticPage({ type }: { type: "about" | "contact" | "pricing" | "adelaide" | "privacy" | "terms" }) {
  if (type === "pricing") return <SiteFrame><PageHero eyebrow="Clear billing units" title="Pricing for Adelaide and interstate moves" description="Compare supplied local time-based rates and interstate per-cubic-metre reference rates." /><PricingSection /><VolumeGuidanceSection /><QuoteStrip /></SiteFrame>;
  if (type === "about") return <SiteFrame><PageHero eyebrow="About HF Removals Adelaide" title="Clear communication, careful handling, practical support" description="HF plans local and interstate moves around the details supplied by each customer." /><LeadershipSection /><ReviewsSection /><ProcessSection /><PackingSection /><QuoteStrip /></SiteFrame>;
  if (type === "contact") return <SiteFrame><PageHero eyebrow="Contact HF" title="Let’s start with the details of your move" description="Call, email or send the quote form with both addresses, date, property size and move type." /><section className="section contact-section"><div className="container contact-grid"><div><p className="eyebrow">Contact details</p><h2>Talk to HF Removals Adelaide</h2><a href={business.phones[0].href}><span>Primary phone</span>{business.phones[0].display}</a><a href={business.phones[1].href}><span>Secondary phone</span>{business.phones[1].display}</a><a href={`mailto:${business.emails[0]}`}><span>Email</span>{business.emails[0]}</a><address><span>Business address</span>{business.address}<small>{business.googleBusiness.hoursLabel}. Please confirm before visiting; this address is not represented as a public showroom.</small></address></div><QuoteForm compact /></div></section><ContactMapSection /><ReviewsSection /><QuoteStrip /></SiteFrame>;
  if (type === "adelaide") return <SiteFrame><PageHero eyebrow="Adelaide removalists" title="A practical Adelaide moving hub" description="Compare services, pricing, packing options and planning considerations in one place." /><AdelaideHubSection /><ServicesGrid /><PricingSection /><ProcessSection /><AreasSection /><QuoteStrip /></SiteFrame>;
  const privacy = type === "privacy";
  return <SiteFrame><PageHero eyebrow={privacy ? "Privacy" : "Website terms"} title={privacy ? "How enquiry information is handled" : "Using the HF Removals Adelaide website"} description={privacy ? "A concise explanation of the information used to respond to move enquiries." : "General website information and important limits around published pricing and coverage wording."} /><section className="section legal"><div className="container prose"><h2>{privacy ? "Enquiry information" : "General information"}</h2><p>{privacy ? "When you submit a quote enquiry, the details you provide are used to review and respond to your move request. The form includes contact, route, date, property and move-scope information." : "Website content is general information. A quote for an individual move depends on the confirmed inventory, access, route, packing requirements and other scope details."}</p><h2>{privacy ? "Contact and delivery" : "Pricing and insurance wording"}</h2><p>{privacy ? `HF can also be contacted directly at ${business.emails[0]} or ${business.phones[0].display}. Online form delivery is only enabled when the server-side provider is configured.` : "Published prices are reference rates reproduced from supplied business material. Interstate prices are per cubic metre, not total move prices. Insurance references are subject to applicable policy terms and the individual move scope."}</p><h2>Contact</h2><p>Questions can be sent to <a href={`mailto:${business.emails[0]}`}>{business.emails[0]}</a>.</p></div></section></SiteFrame>;
}
