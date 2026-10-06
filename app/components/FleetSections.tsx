import Image from "next/image";
import { hfImages, truckPricing, services } from "../../lib/site-data";
import { CrewUpgradeNote, TruckCards } from "./TruckChooser";

const SIZE_STEPS = [...truckPricing].reverse();

/** Hero (right-hand side): a branded photograph of the crew and truck, with the three sizes as quick links. */
export function HeroFleetPanel() {
  return (
    <aside className="hero-fleet" aria-label="Our three truck sizes">
      <div className="hero-fleet-photo">
        <Image
          src={hfImages.heroFleet.src}
          alt={hfImages.heroFleet.alt}
          width={hfImages.heroFleet.width}
          height={hfImages.heroFleet.height}
          sizes="(max-width: 900px) 92vw, 42vw"
          quality={80}
        />
      </div>
      <ul className="hero-fleet-chips">
        {SIZE_STEPS.map((truck) => (
          <li key={truck.id}>
            <a href="#trucks">
              <strong>{truck.capacity}</strong>
              <span>{truck.name}</span>
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
}

type ValueIconName = "crew" | "scale" | "price" | "care" | "promise";

/** Non-vehicle pillar icons: people, size scale, dollar, box and shield. */
function ValueIcon({ name }: { name: ValueIconName }) {
  const common = { width: 26, height: 26, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  switch (name) {
    case "crew":
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3" />
          <path d="M3 20v-1a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v1" />
          <circle cx="17" cy="9" r="2.4" />
          <path d="M17 14a4 4 0 0 1 4 4v2" />
        </svg>
      );
    case "scale":
      return (
        <svg {...common}>
          <path d="M4 20V4m0 16h16" />
          <path d="M8 16v-4M12 16V8M16 16V5" />
        </svg>
      );
    case "price":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M14.8 9.2c-.5-1-1.5-1.5-2.8-1.5-1.6 0-2.7.8-2.7 2s1 1.7 2.7 2.1c1.7.4 2.9.9 2.9 2.2s-1.2 2-2.9 2c-1.4 0-2.5-.6-3-1.7M12 6v1.7M12 16.3V18" />
        </svg>
      );
    case "care":
      return (
        <svg {...common}>
          <path d="M21 8 12 3 3 8v8l9 5 9-5Z" />
          <path d="m3 8 9 5 9-5M12 13v8" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <path d="M12 21s8-3.6 8-10V5l-8-3-8 3v6c0 6.4 8 10 8 10Z" />
          <path d="m8.5 11.5 2.5 2.5 4.5-4.5" />
        </svg>
      );
  }
}

const VALUE_POINTS: { icon: ValueIconName; title: string; copy: string }[] = [
  { icon: "crew", title: "Professional crew", copy: "A trained 2-man crew comes with every truck." },
  { icon: "scale", title: "Right truck size", copy: "Choose the truck that suits your move." },
  { icon: "price", title: "Clear pricing", copy: "See the 30-minute rate before you enquire." },
  { icon: "care", title: "Careful handling", copy: "The same HF service whichever truck you choose." },
  { icon: "promise", title: "No fake promises", copy: "Choose what your move actually needs." },
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

        <div className="truck-band">
          <div className="truck-band-copy">
            <p className="eyebrow">Same team quality</p>
            <h3>
              Different truck. <em>Same HF service.</em>
            </h3>
            <p>
              Whether you choose our HR, MR or Small Truck, you get the same HF service every time: professional crew, careful handling and clear pricing.
            </p>
          </div>
          <div className="truck-band-gallery">
            <figure className="truck-band-main">
              <Image src={hfImages.crewService.src} alt={hfImages.crewService.alt} width={hfImages.crewService.width} height={hfImages.crewService.height} sizes="(max-width: 900px) 92vw, 30vw" />
            </figure>
            <figure className="truck-band-side">
              <Image src={hfImages.carefulHandling.src} alt={hfImages.carefulHandling.alt} width={hfImages.carefulHandling.width} height={hfImages.carefulHandling.height} sizes="(max-width: 900px) 92vw, 30vw" />
            </figure>
          </div>
        </div>

        <ul className="truck-values">
          {VALUE_POINTS.map((point) => (
            <li key={point.title}>
              <span className="truck-value-icon">
                <ValueIcon name={point.icon} />
              </span>
              <strong>{point.title}</strong>
              <span>{point.copy}</span>
            </li>
          ))}
        </ul>
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
                  <Image src={card.image} alt={card.alt} width={1672} height={941} sizes="(max-width: 640px) calc(100vw - 32px), (max-width: 1100px) 50vw, (max-width: 1488px) 25vw, 342px" loading="lazy" />
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
