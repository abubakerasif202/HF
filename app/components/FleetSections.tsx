import { truckPricing, services } from "../../lib/site-data";
import { TruckIllustration, truckWidthRatio } from "./FleetVisuals";
import { CrewUpgradeNote, TruckCards } from "./TruckChooser";

const SIZE_STEPS = [...truckPricing].reverse();

/** Hero (right-hand side): the three truck sizes drawn to scale. Illustration, not fleet photography. */
export function HeroFleetPanel() {
  return (
    <aside className="hero-fleet" aria-label="Our three truck sizes">
      <p className="hero-fleet-kicker">Three trucks · one standard of service</p>
      <div className="hero-fleet-lineup">
        {SIZE_STEPS.map((truck) => (
          <div className="hero-fleet-item" key={truck.id} style={{ flexBasis: `${truckWidthRatio(truck.truckClass!) * 100}%` }}>
            <TruckIllustration truckClass={truck.truckClass!} label={truck.alt} />
            <p className="hero-fleet-label">
              <strong>{truck.capacity}</strong>
              <span>{truck.sizeLabel}</span>
            </p>
          </div>
        ))}
      </div>
      <a className="hero-fleet-link" href="#trucks">
        Compare the trucks and rates <span aria-hidden="true">↓</span>
      </a>
      <p className="hero-fleet-note">Illustration of truck sizes, drawn to scale against each other.</p>
    </aside>
  );
}

const VALUE_POINTS = [
  { title: "Professional crew", copy: "A trained 2-man crew comes with every truck." },
  { title: "Right truck size", copy: "Choose the truck that suits your move." },
  { title: "Clear pricing", copy: "See the 30-minute rate before you enquire." },
  { title: "Careful handling", copy: "The same HF service whichever truck you choose." },
  { title: "No fake promises", copy: "Choose what your move actually needs." },
];

export function TruckSection() {
  return (
    <section className="section truck-section" id="trucks" aria-labelledby="trucks-heading">
      <div className="container">
        <div className="truck-section-head">
          <p className="eyebrow">The right truck for every move</p>
          <h2 id="trucks-heading">
            Choose the Right Truck <em>for Your Move</em>
          </h2>
          <p>
            Different moves need different trucks. Choose the size that suits your move and get the same professional HF Removals service whichever option you choose.
          </p>
        </div>

        <ol className="truck-scale" aria-label="Truck sizes from smallest to largest">
          {SIZE_STEPS.map((truck, index) => (
            <li key={truck.id}>
              <strong>{truck.capacity}</strong>
              <span>{truck.sizeLabel}</span>
              {index < SIZE_STEPS.length - 1 && <i aria-hidden="true">→</i>}
            </li>
          ))}
        </ol>

        <TruckCards location="home_trucks" />
        <CrewUpgradeNote />

        <ul className="truck-values">
          {VALUE_POINTS.map((point) => (
            <li key={point.title}>
              <strong>{point.title}</strong>
              <span>{point.copy}</span>
            </li>
          ))}
        </ul>

        <div className="truck-band">
          <div className="truck-band-copy">
            <p className="eyebrow">Same team quality</p>
            <h3>
              Different truck. <em>Same HF service.</em>
            </h3>
            <p>
              Big house? {truckPricing[0].name} — {truckPricing[0].capacity}. Medium move? {truckPricing[1].name} — {truckPricing[1].capacity}. Apartment or smaller move? {truckPricing[2].name} — {truckPricing[2].capacity}. No fake promises — just the right truck, the right crew and the same quality HF service.
            </p>
          </div>
          <picture className="truck-band-photo">
            <img
              src="/images/hf-furniture-removals.webp"
              alt="HF Removals crew carrying a wrapped sofa into an Adelaide home with the truck loading in the background"
              width="1672"
              height="941"
              loading="lazy"
              decoding="async"
            />
          </picture>
        </div>
      </div>
    </section>
  );
}

const FIT_CARDS = [
  {
    slug: "residential-removals",
    image: "/images/hf-residential-removals.webp",
    alt: "HF Removals crew and truck at an Adelaide family home",
    title: "House moves",
    copy: "Large home? Choose the capacity that matches the load.",
    trucks: "HR or MR Truck",
  },
  {
    slug: "apartment",
    href: "/services/residential-removals",
    image: "/images/hf-apartment-removals.webp",
    alt: "HF Removals crew unloading boxes with a hand trolley outside a modern home",
    title: "Apartment moves",
    copy: "Smaller access and a smaller move? Choose the smaller truck.",
    trucks: "Small Truck",
  },
  {
    slug: "office-commercial-removals",
    image: "/images/hf-office-removals.webp",
    alt: "HF Removals crew moving office furniture",
    title: "Office relocations",
    copy: "Match the truck size to your workplace relocation.",
    trucks: "MR or HR Truck",
  },
  {
    slug: "furniture-removals",
    image: "/images/hf-furniture-removals.webp",
    alt: "Two HF Removals movers carrying a sofa",
    title: "Furniture removals",
    copy: "A few pieces or a full lounge suite? Pick the truck that fits.",
    trucks: "Small or MR Truck",
  },
] as const;

export function TruckFitSection() {
  const knownSlugs = new Set(services.map((service) => service.slug));
  return (
    <section className="section truck-fit-section" id="services" aria-labelledby="truck-fit-heading">
      <div className="container">
        <div className="truck-section-head">
          <p className="eyebrow">Adelaide moving services</p>
          <h2 id="truck-fit-heading">
            We don&apos;t force every customer <em>into the same truck</em>
          </h2>
          <p>Start with the service that matches your job, then pick the truck size that fits it.</p>
        </div>
        <ul className="truck-fit-grid">
          {FIT_CARDS.map((card) => {
            const href = "href" in card ? card.href : `/services/${card.slug}`;
            const valid = knownSlugs.has(card.slug) || "href" in card;
            return (
              <li key={card.title}>
                <a className="truck-fit-card" href={valid ? href : "/services/residential-removals"}>
                  <img src={card.image} alt={card.alt} width="1672" height="941" loading="lazy" decoding="async" />
                  <span className="truck-fit-body">
                    <span className="truck-fit-chip">{card.trucks}</span>
                    <strong>{card.title}</strong>
                    <span>{card.copy}</span>
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
