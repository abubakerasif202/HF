import { business } from "../../lib/site-data";
import { reviewMilestone } from "../../lib/review-milestone";
import { ReviewMilestoneFx } from "./ReviewMilestoneFx";
import "./review-milestone.css";

type Variant = "feature" | "compact";

interface ReviewMilestoneCardProps {
  variant?: Variant;
  /** Analytics/test hook describing where the card is placed. */
  placement?: string;
}

const STAR_PATH = "M12 2.6l2.9 5.9 6.5.95-4.7 4.6 1.1 6.45L12 17.45 6.2 20.5l1.1-6.45-4.7-4.6 6.5-.95z";

function MilestoneStars({ size }: { size: number }) {
  return (
    <span className="rm-stars" aria-hidden="true">
      {Array.from({ length: 5 }, (_, index) => (
        <span className="rm-star" key={index} style={{ "--i": index } as React.CSSProperties}>
          <svg width={size} height={size} viewBox="0 0 24 24">
            <path d={STAR_PATH} />
          </svg>
        </span>
      ))}
    </span>
  );
}

function AdelaideSkyline() {
  // Stylised, generic low-rise city silhouette (decorative only).
  return (
    <svg className="rm-skyline" viewBox="0 0 1200 160" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path d="M0 160V118h40v-14h26v14h22V92h30v26h18V70h14V52h10v18h14v48h24V96h36v22h20V80h22V64h28v16h18v38h30V88h20V60h8V40h6v20h8v28h22v30h26V100h40v18h18V74h34v44h24V92h20V58h16V30h4v28h16v34h22v26h30v-20h36v20h20V84h28V66h22v18h16v34h34V96h26v22h22V78h18V56h10v22h18v40h28v-24h40v24h22V90h30v28h26v-16h34v16h18V82h22v36H1200V160z" />
    </svg>
  );
}

function FeatureCard({ figure, count, ratingLabel, summary, listingUrl }: CardContent) {
  return (
    <div className="rm-card rm-card--feature" data-rm-card>
      <span className="rm-border" aria-hidden="true"><i /></span>
      <span className="rm-bg" aria-hidden="true">
        <i className="rm-glow" />
        <i className="rm-spotlight" />
        <svg className="rm-rings" viewBox="0 0 400 400" focusable="false">
          <circle cx="200" cy="200" r="190" className="rm-ring rm-ring--outer" />
          <circle cx="200" cy="200" r="150" className="rm-ring rm-ring--inner" />
        </svg>
        <span className="rm-particles" data-rm-particles />
        <AdelaideSkyline />
      </span>

      <div className="rm-content">
        <h2 className="rm-rank" id="review-milestone-title">
          <span className="rm-rank-text">Trusted by Adelaide</span>
        </h2>
        <MilestoneStars size={44} />
        <p className="rm-figure-wrap">
          <span className="rm-sr">{summary}</span>
          <span className="rm-figure" aria-hidden="true">
            <span className="rm-figure-depth" data-rm-figure="depth" data-value={figure} />
            <span className="rm-figure-face" data-rm-figure>{figure}</span>
          </span>
          <span className="rm-figure-label" aria-hidden="true">Google Reviews</span>
        </p>
        <p className="rm-rating" aria-hidden="true">
          <b>{ratingLabel}</b> average rating on Google
        </p>
        <p className="rm-tagline">{count} reviews. One incredible milestone.</p>
        <p className="rm-thanks">Thank you, Adelaide, for your trust.</p>
        <a className="rm-cta" href={listingUrl} target="_blank" rel="noopener noreferrer" data-rm-magnetic>
          <span>Read Our Google Reviews</span>
          <i aria-hidden="true">→</i>
          <span className="rm-sr"> (opens Google Maps in a new tab)</span>
        </a>
      </div>
    </div>
  );
}

function CompactCard({ figure, ratingLabel, summary, listingUrl }: CardContent) {
  return (
    <div className="rm-card rm-card--compact" data-rm-card>
      <span className="rm-border" aria-hidden="true"><i /></span>
      <span className="rm-bg" aria-hidden="true">
        <i className="rm-glow" />
      </span>
      <div className="rm-content">
        <p className="rm-compact-figure">
          <span className="rm-sr">{summary}</span>
          <span className="rm-figure" aria-hidden="true">
            <span className="rm-figure-depth" data-rm-figure="depth" data-value={figure} />
            <span className="rm-figure-face" data-rm-figure>{figure}</span>
          </span>
        </p>
        <div className="rm-compact-copy">
          <MilestoneStars size={22} />
          <p className="rm-compact-title">
            <span className="rm-rank-text">Trusted by Adelaide</span>
          </p>
          <p className="rm-compact-detail" aria-hidden="true">
            Google reviews · <b>{ratingLabel}</b> average rating
          </p>
        </div>
        <a className="rm-cta rm-cta--compact" href={listingUrl} target="_blank" rel="noopener noreferrer">
          <span>Read Our Google Reviews</span>
          <i aria-hidden="true">→</i>
          <span className="rm-sr"> (opens Google Maps in a new tab)</span>
        </a>
      </div>
    </div>
  );
}

interface CardContent {
  figure: string;
  count: number;
  ratingLabel: string;
  summary: string;
  listingUrl: string;
}

/**
 * Google review milestone card. All copy is server-rendered from the
 * verified figures in site-data, so search engines and users without
 * JavaScript get the complete content; ReviewMilestoneFx only layers on
 * decorative motion.
 */
export function ReviewMilestoneCard({ variant = "compact", placement = variant }: ReviewMilestoneCardProps) {
  const google = business.googleBusiness;
  const stats = reviewMilestone({ rating: google.rating, reviewCount: google.reviewCount });
  const content: CardContent = { ...stats, listingUrl: google.listingUrl };
  const isFeature = variant === "feature";
  return (
    <section
      className={`rm-section rm-section--${variant}`}
      aria-labelledby={isFeature ? "review-milestone-title" : undefined}
      aria-label={isFeature ? undefined : `Google reviews: ${stats.summary}`}
      data-placement={placement}
    >
      <div className="container">
        <ReviewMilestoneFx variant={variant} target={stats.milestone} figure={stats.figure}>
          {isFeature ? <FeatureCard {...content} /> : <CompactCard {...content} />}
        </ReviewMilestoneFx>
      </div>
    </section>
  );
}
