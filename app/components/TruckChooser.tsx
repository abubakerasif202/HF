"use client";

import { useState } from "react";
import { crewUpgradePricing, findMovingPackage, truckPricing, type MovingPackageId } from "../../lib/site-data";
import { setSelectedTruck, useSelectedTruck } from "../../lib/truck-selection";
import { trackBookNowClick } from "./SiteClient";
import Image from "next/image";

/**
 * Price block shared by every truck surface. The 30-minute rate is the headline
 * figure; the hourly equivalent is supporting text only and never larger.
 */
function PriceBlock({ halfHour, hourly, size = "lg" }: { halfHour: string; hourly: string; size?: "lg" | "md" }) {
  return (
    <div className={`truck-price truck-price-${size}`}>
      <p className="truck-price-main">
        <span className="truck-price-amount">{halfHour}</span>
        <span className="truck-price-unit">/ 30 min</span>
      </p>
      <p className="truck-price-hourly">{hourly} / hr</p>
    </div>
  );
}

function goToQuote(): void {
  const target = document.getElementById("quote");
  if (!target) {
    // No quote form on this page: the selection is remembered, so hand over to the homepage form.
    window.location.href = "/#quote";
    return;
  }
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
}

/** The three truck cards on the homepage and pricing page. */
export function TruckCards({ location }: { location: string }) {
  const selected = useSelectedTruck();
  const [announcement, setAnnouncement] = useState("");

  function choose(id: MovingPackageId) {
    const pkg = findMovingPackage({ id });
    setSelectedTruck(id);
    setAnnouncement(pkg ? `${pkg.name} selected. Continue to the quote form below.` : "");
    goToQuote();
  }

  return (
    <>
      <ul className="truck-cards" aria-label="Truck options">
        {truckPricing.map((truck, index) => {
          const isSelected = selected === truck.id;
          return (
            <li className={`truck-card truck-card-${truck.truckClass?.toLowerCase()} ${isSelected ? "is-selected" : ""} ${index === 0 ? "is-featured" : ""}`} key={truck.id}>
              <div className="truck-card-photo">
                <Image
                  src={truck.image.src}
                  alt={truck.alt}
                  fill
                  sizes="(max-width: 900px) 92vw, 32vw"
                  quality={80}
                  style={{ objectFit: "cover", objectPosition: truck.image.objectPosition }}
                />
                {index === 0 && <span className="truck-card-ribbon">Largest truck</span>}
                <p className="truck-card-story">
                  <strong>{truck.story.question}</strong> {truck.story.answer}
                </p>
              </div>
              <div className="truck-card-body">
                <div className="truck-card-head">
                  <h3>{truck.name}</h3>
                  <p className="truck-card-spec">
                    <strong>{truck.capacity}</strong> · {truck.crewLabel}
                  </p>
                </div>
                <PriceBlock halfHour={truck.halfHour} hourly={truck.hourly} />
                <p className="truck-card-headline">{truck.bestForLine}</p>
              <button type="button" className="button button-ruby truck-card-cta" aria-pressed={isSelected} onClick={() => choose(truck.id)}>
                {isSelected ? <>Selected: {truck.name} <span aria-hidden="true">✓</span></> : <>Select {truck.name}</>}
              </button>
              <a className="truck-card-book" href={`/book?package=${truck.id}`} onClick={() => trackBookNowClick(location, truck.id)}>
                Or book {truck.name} online <span aria-hidden="true">→</span>
              </a>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="truck-announce" role="status" aria-live="polite">
        {announcement}
      </p>
    </>
  );
}

/** Secondary crew-upgrade prompt: three movers is an add-on, not a fourth headline truck. */
export function CrewUpgradeNote() {
  const upgrade = crewUpgradePricing[0];
  const selected = useSelectedTruck();
  return (
    <p className="truck-upgrade">
      Need an extra pair of hands? <strong>{upgrade.name}</strong> is {upgrade.halfHour} / 30 min ({upgrade.hourly} per hour); we confirm the truck to suit your load.{" "}
      <button
        type="button"
        className="truck-upgrade-link"
        aria-pressed={selected === upgrade.id}
        onClick={() => {
          setSelectedTruck(upgrade.id as MovingPackageId);
          goToQuote();
        }}
      >
        Choose 3 movers
      </button>
    </p>
  );
}
