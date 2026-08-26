import React from "react";
import { localPricing, interstatePricing } from "@/lib/site-data";

export interface PricingTierItem {
  name: string;
  halfHour: string;
  hourly: string;
  note?: string;
  badge?: string;
  isPopular?: boolean;
  features?: string[];
  ctaText?: string;
  ctaHref?: string;
}

export interface InterstateRouteItem {
  slug: string;
  label: string;
  price: string;
  unit: string;
  timingNote?: string;
}

export interface PricingBreakdownPatternProps extends Omit<React.ComponentProps<"section">, "title"> {
  eyebrow?: string;
  title?: React.ReactNode;
  subtitle?: string;
  localTiers?: PricingTierItem[];
  interstateRoutes?: InterstateRouteItem[];
  interstateHeading?: string;
  interstateSubtitle?: string;
  allRoutesHref?: string;
  onSelectTier?: (tier: PricingTierItem) => void;
  className?: string;
}

const DEFAULT_LOCAL_FEATURES: string[] = [
  "Moving blankets and heavy-duty straps available on the truck",
  "Complimentary mattress and side-table protective wraps",
  "Published 30-minute billing; final quote confirms the move scope",
  "Up to $1,000,000 Public Liability & Transit Insurance; policy terms and move scope apply",
];

/**
 * Reusable Pricing & Rates Breakdown pattern component.
 * Mobile-first layout adhering strictly to StyleSeed design tokens and semantic CSS surfaces.
 */
export function PricingBreakdownPattern({
  eyebrow = "Transparent Billing Rates",
  title = <>Published Reference Rates, <em>Clearly Explained</em></>,
  subtitle = "Local Adelaide moves use published 30-minute billing increments. Interstate routes below show the supplied per-cubic-metre reference rates.",
  localTiers,
  interstateRoutes,
  interstateHeading = "Interstate Volume Pricing",
  interstateSubtitle = "Calculated per cubic metre (m³); final pricing depends on the confirmed route, volume and move scope.",
  allRoutesHref = "/interstate",
  onSelectTier,
  className = "",
  ...restProps
}: PricingBreakdownPatternProps) {
  // Map site data defaults if custom tiers are not provided
  const tiers: PricingTierItem[] = localTiers ?? localPricing.map((item: (typeof localPricing)[number]) => ({
    name: item.name,
    halfHour: item.halfHour,
    hourly: item.hourly,
    note: item.note,
    features: DEFAULT_LOCAL_FEATURES,
    ctaText: "Request Quote for This Option",
    ctaHref: "/#quote",
  }));

  const routes: InterstateRouteItem[] = interstateRoutes ?? interstatePricing.map((r: (typeof interstatePricing)[number]) => ({
    slug: r.slug,
    label: r.label,
    price: r.price,
    unit: r.unit,
    timingNote: "Final timing confirmed with quote",
  }));

  return (
    <section
      data-slot="pricing-breakdown-pattern"
      className={["section pricing-section", className].filter(Boolean).join(" ")}
      aria-labelledby="pricing-breakdown-title"
      {...restProps}
    >
      <div className="container">
        {/* Header Block */}
        <div className="section-head text-center mb-10">
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h2 id="pricing-breakdown-title" className="section-title">
            {title}
          </h2>
          {subtitle && <p className="section-copy max-w-2xl mx-auto">{subtitle}</p>}
        </div>

        {/* Local Tier Cards Grid */}
        <div className="local-pricing">
          {tiers.map((tier) => (
            <article
              key={tier.name}
              className={["price-card", tier.isPopular && "price-card--popular"].filter(Boolean).join(" ")}
              data-popular={tier.isPopular ? "true" : undefined}
            >
              <span className="ruby-dot" aria-hidden="true" />
              
              <div>
                {tier.badge && (
                  <p className="price-kicker font-medium text-xs tracking-wider uppercase mb-2">
                    {tier.badge}
                  </p>
                )}
                <h3>{tier.name}</h3>

                <div className="price-value">
                  <strong>{tier.halfHour}</strong>
                  <span>/ 30 min</span>
                </div>
                <p className="price-hourly">{tier.hourly} per hour</p>

                {tier.features && tier.features.length > 0 && (
                  <ul className="price-features">
                    {tier.features.map((feature, fIdx) => (
                      <li key={fIdx}>
                        <span aria-hidden="true">✓ </span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                {onSelectTier ? (
                  <button
                    type="button"
                    onClick={() => onSelectTier(tier)}
                    className="button button-ruby w-full min-h-[44px] flex items-center justify-center font-semibold"
                  >
                    {tier.ctaText || "Select Option"}
                  </button>
                ) : (
                  <a
                    href={tier.ctaHref || "/#quote"}
                    className="button button-ruby w-full min-h-[44px] flex items-center justify-center font-semibold"
                  >
                    {tier.ctaText || "Request a Quote"}
                  </a>
                )}
              </div>
            </article>
          ))}
        </div>

        {/* Interstate Volume Pricing Pattern Section */}
        {routes && routes.length > 0 && (
          <div className="interstate-table">
            <div className="table-intro">
              <p className="eyebrow">{interstateHeading}</p>
              <h3>Route Reference Rates</h3>
              <p>{interstateSubtitle}</p>
              {allRoutesHref && (
                <a className="button button-ruby inline-flex min-h-[44px] items-center justify-center px-5" href={allRoutesHref}>
                  View All Routes
                </a>
              )}
            </div>

            <div className="table-routes">
              {routes.map((route) => (
                <a
                  href={`/interstate/${route.slug}`}
                  key={route.slug}
                  className="table-route-row"
                >
                  <div className="route-name">
                    <strong>{route.label}</strong>
                    {route.timingNote && (
                      <span>{route.timingNote}</span>
                    )}
                  </div>
                  <div className="route-cost">
                    <strong>{route.price}</strong>
                    <small>{route.unit}</small>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default PricingBreakdownPattern;
