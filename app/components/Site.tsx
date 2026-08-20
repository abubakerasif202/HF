import { areas, business, ContentPage, guides, interstatePricing, interstateRoutes, localPricing, services } from "../../lib/site-data";
import { Header, MobileStickyCta, OpeningSequence, QuoteForm } from "./SiteClient";

export function ServiceTicker({ locations = false }: { locations?: boolean }) {
  const items = locations
    ? ["ADELAIDE", "ELIZABETH VALE", "ELIZABETH", "SALISBURY", "BLAKEVIEW", "GAWLER", "ADELAIDE METRO"]
    : ["RESIDENTIAL REMOVALS", "OFFICE RELOCATIONS", "INTERSTATE MOVES", "BACKLOADING", "PACKING & UNPACKING"];
  const content = [...items, ...items];
  return <div className="ticker" aria-label={items.join(", ")}><div className="ticker-track">{content.map((item, index) => <span key={`${item}-${index}`}>{item}<b aria-hidden="true">◆</b></span>)}</div></div>;
}

function TrustBar() {
  const items = [business.insurance, "Transparent quoting", "Local & interstate", "Packing & unpacking", "Careful handling"];
  return <div className="trust-bar">{items.map((item, index) => <div key={item}><span>{String(index + 1).padStart(2, "0")}</span><p>{item}</p></div>)}</div>;
}

function SectionHeading({ eyebrow, title, copy, light = false }: { eyebrow: string; title: React.ReactNode; copy?: string; light?: boolean }) {
  return <div className={`section-heading ${light ? "light" : ""}`}><p className="eyebrow">{eyebrow}</p><h2>{title}</h2>{copy && <p>{copy}</p>}</div>;
}

function ServicesGrid() {
  return <section className="section services-section" id="services"><div className="container"><SectionHeading eyebrow="Our services" title={<>Moving solutions <em>tailored to you</em></>} copy="Choose the support that fits the property, inventory, route and level of packing help involved." /><div className="service-grid">{services.map((service, index) => <a className="service-card" href={`/services/${service.slug}`} key={service.slug}><span className="card-number">{String(index + 1).padStart(2, "0")}</span><div className="card-line" /><h3>{service.eyebrow}</h3><p>{service.description}</p><span className="card-link">Explore service <b>→</b></span></a>)}</div></div></section>;
}

function PricingSection() {
  return <section className="section pricing-section"><div className="container"><SectionHeading eyebrow="Adelaide move rates" title={<>Simple pricing, <em>clearly measured</em></>} copy="Local rates use 30-minute billing units. Interstate reference rates are shown per cubic metre." /><div className="local-pricing">{localPricing.map((item, index) => <article className="price-card" key={item.name}><span className="ruby-dot" /><p className="price-kicker">Option {index + 1}</p><h3>{item.name}</h3><div className="price-value"><strong>{item.halfHour}</strong><span>/ 30 min</span></div><p>{item.hourly} per hour</p></article>)}</div><div className="interstate-table"><div className="table-intro"><p className="eyebrow">Interstate volume rates</p><h3>Route reference pricing</h3><p>Final move cost depends on the volume and scope of the move.</p></div><div>{interstatePricing.map((item) => <a href={`/interstate/${item.slug}`} key={item.slug}><span>{item.label}</span><strong>{item.price}<small>{item.unit}</small></strong></a>)}</div></div><p className="pricing-note">Published rates are reproduced from supplied HF business material. Ask HF which charges and terms apply to your individual move.</p></div></section>;
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
  return <footer className="site-footer"><div className="container footer-grid"><div className="footer-brand"><img src={business.logo} alt="HF Removals Adelaide" width="1679" height="937" /><p>{business.tagline}</p><address><a href={business.phones[0].href}>{business.phones[0].display}</a><a href={`mailto:${business.emails[0]}`}>{business.emails[0]}</a><span>{business.address}</span></address></div><div><h3>Services</h3>{services.map((item) => <a href={`/services/${item.slug}`} key={item.slug}>{item.eyebrow}</a>)}</div><div><h3>Areas</h3>{areas.map((item) => <a href={`/areas/${item.slug}`} key={item.slug}>{item.eyebrow}</a>)}</div><div><h3>Plan your move</h3>{interstateRoutes.map((item) => <a href={`/interstate/${item.slug}`} key={item.slug}>{item.eyebrow}</a>)}<a href="/guides">Moving guides</a></div></div><div className="container footer-bottom"><span>© {new Date().getFullYear()} HF Removals Adelaide</span><span><a href="/privacy">Privacy</a><a href="/terms">Terms</a></span></div></footer>;
}

export function SiteFrame({ children, intro = false }: { children: React.ReactNode; intro?: boolean }) {
  return <><a className="skip-link" href="#main">Skip to content</a>{intro && <OpeningSequence />}<Header /><main id="main">{children}</main><Footer /><MobileStickyCta /></>;
}

export function HomePage() {
  return <SiteFrame intro><section className="hero"><img className="hero-image" src="/images/hf-hero-truck-1792.webp" srcSet="/images/hf-hero-truck-480.webp 480w, /images/hf-hero-truck-768.webp 768w, /images/hf-hero-truck-1024.webp 1024w, /images/hf-hero-truck-1440.webp 1440w, /images/hf-hero-truck-1792.webp 1792w" sizes="100vw" alt="HF branded moving truck in an Adelaide streetscape" width="1792" height="896" fetchPriority="high" /><div className="hero-overlay" /><div className="container hero-grid"><div className="hero-copy"><p className="eyebrow hero-eyebrow">Adelaide local & interstate removalists</p><h1>Adelaide <em>Removalists</em><br />You Can<br />Rely On</h1><p className="hero-lead">From the first box to the final placement, HF Removals Adelaide provides carefully planned local and interstate moving support.</p><div className="hero-actions"><a className="button button-gold" href="#quote">Get a free quote</a><a className="button button-outline" href={business.phones[0].href}>Call us now</a></div><div className="hero-proof"><span>Local & interstate</span><span>Residential & commercial</span><span>Packing support</span></div></div><QuoteForm /></div><div className="container trust-wrap"><TrustBar /></div></section><ServiceTicker /><ServicesGrid /><LeadershipSection /><PricingSection /><ProcessSection /><PackingSection /><ServiceTicker locations /><AreasSection /><QuoteStrip /></SiteFrame>;
}

function PageHero({ eyebrow, title, description, price, unit }: { eyebrow: string; title: string; description: string; price?: string; unit?: string }) {
  return <section className="inner-hero"><div className="inner-orbit" aria-hidden="true" /><div className="container inner-hero-grid"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p><div className="hero-actions"><a className="button button-gold" href="/#quote">Get a free quote</a><a className="button button-outline" href={business.phones[0].href}>Call HF</a></div></div>{price ? <div className="route-price"><span>Reference rate</span><strong>{price}</strong><p>{unit}</p><small>Final cost depends on volume and scope.</small></div> : <div className="inner-monogram"><img src={business.logo} alt="" width="1679" height="937" /></div>}</div></section>;
}

function Breadcrumbs({ page }: { page: ContentPage }) {
  const group = page.kind === "route" ? "interstate" : `${page.kind}s`;
  return <nav className="breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span><a href={`/${group}`}>{group}</a><span>/</span><span aria-current="page">{page.eyebrow}</span></nav>;
}

export function DetailPage({ page }: { page: ContentPage }) {
  return <SiteFrame><PageHero eyebrow={page.eyebrow} title={page.title} description={page.intro} price={page.price} unit={page.unit} /><ServiceTicker /><section className="section detail-section"><div className="container"><Breadcrumbs page={page} /><div className="detail-grid"><article><p className="eyebrow">What to plan</p><h2>Practical details make a <em>clearer move</em></h2><div className="detail-bars">{page.highlights.map((item, index) => <div key={item}><span>{String(index + 1).padStart(2, "0")}</span><i /><strong>{item}</strong><b /></div>)}</div></article><aside><p className="eyebrow">Start your enquiry</p><h3>Share the essentials</h3><p>Addresses, date, property size, move type and access notes help HF review the scope.</p><a className="button button-ruby" href="/#quote">Request a quote</a></aside></div><div className="editorial-sections">{page.sections.map((section, index) => <article key={section.title}><span>{String(index + 1).padStart(2, "0")}</span><h3>{section.title}</h3><p>{section.body}</p></article>)}</div></div></section><FaqSection faqs={page.faqs} title={`Questions about ${page.eyebrow.toLowerCase()}`} /><QuoteStrip /></SiteFrame>;
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
  if (type === "pricing") return <SiteFrame><PageHero eyebrow="Clear billing units" title="Pricing for Adelaide and interstate moves" description="Compare supplied local time-based rates and interstate per-cubic-metre reference rates." /><PricingSection /><QuoteStrip /></SiteFrame>;
  if (type === "about") return <SiteFrame><PageHero eyebrow="About HF Removals Adelaide" title="Clear communication, careful handling, practical support" description="HF plans local and interstate moves around the details supplied by each customer." /><LeadershipSection /><ProcessSection /><PackingSection /><QuoteStrip /></SiteFrame>;
  if (type === "contact") return <SiteFrame><PageHero eyebrow="Contact HF" title="Let’s start with the details of your move" description="Call, email or send the quote form with both addresses, date, property size and move type." /><section className="section contact-section"><div className="container contact-grid"><div><p className="eyebrow">Contact details</p><h2>Talk to HF Removals Adelaide</h2><a href={business.phones[0].href}><span>Primary phone</span>{business.phones[0].display}</a><a href={business.phones[1].href}><span>Secondary phone</span>{business.phones[1].display}</a><a href={`mailto:${business.emails[0]}`}><span>Email</span>{business.emails[0]}</a><address><span>Business address</span>{business.address}<small>Please confirm before visiting; this site does not represent the address as a public showroom.</small></address></div><QuoteForm compact /></div></section></SiteFrame>;
  if (type === "adelaide") return <SiteFrame><PageHero eyebrow="Adelaide removalists" title="A practical Adelaide moving hub" description="Compare services, pricing, packing options and planning considerations in one place." /><AdelaideHubSection /><ServicesGrid /><PricingSection /><ProcessSection /><AreasSection /><QuoteStrip /></SiteFrame>;
  const privacy = type === "privacy";
  return <SiteFrame><PageHero eyebrow={privacy ? "Privacy" : "Website terms"} title={privacy ? "How enquiry information is handled" : "Using the HF Removals Adelaide website"} description={privacy ? "A concise explanation of the information used to respond to move enquiries." : "General website information and important limits around published pricing and coverage wording."} /><section className="section legal"><div className="container prose"><h2>{privacy ? "Enquiry information" : "General information"}</h2><p>{privacy ? "When you submit a quote enquiry, the details you provide are used to review and respond to your move request. The form includes contact, route, date, property and move-scope information." : "Website content is general information. A quote for an individual move depends on the confirmed inventory, access, route, packing requirements and other scope details."}</p><h2>{privacy ? "Contact and delivery" : "Pricing and insurance wording"}</h2><p>{privacy ? `HF can also be contacted directly at ${business.emails[0]} or ${business.phones[0].display}. Online form delivery is only enabled when the server-side provider is configured.` : "Published prices are reference rates reproduced from supplied business material. Interstate prices are per cubic metre, not total move prices. Insurance references are subject to applicable policy terms and the individual move scope."}</p><h2>Contact</h2><p>Questions can be sent to <a href={`mailto:${business.emails[0]}`}>{business.emails[0]}</a>.</p></div></section></SiteFrame>;
}
