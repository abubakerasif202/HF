/**
 * Derives the review-milestone figures shown by ReviewMilestoneCard from the
 * verified Google Business Profile numbers in site-data. Nothing here invents
 * data: the milestone is the verified count rounded DOWN to the nearest
 * hundred, so "500+" can only appear once the profile really shows 500+.
 */
export interface GoogleReviewStats {
  rating: number;
  reviewCount: number;
}

export interface ReviewMilestone {
  /** Verified review count, e.g. 500. */
  count: number;
  /** Milestone rounded down to the nearest hundred, e.g. 500. */
  milestone: number;
  /** Display figure, e.g. "500+". Falls back to the exact count below 100. */
  figure: string;
  /** One-decimal rating, e.g. "5.0". */
  ratingLabel: string;
  /** Plain-language summary for screen readers and crawlers. */
  summary: string;
}

const MILESTONE_STEP = 100;

export function reviewMilestone(stats: GoogleReviewStats): ReviewMilestone {
  const count = Math.max(0, Math.floor(stats.reviewCount));
  const ratingLabel = stats.rating.toFixed(1);
  if (count < MILESTONE_STEP) {
    return {
      count,
      milestone: count,
      figure: String(count),
      ratingLabel,
      summary: `${count} Google reviews with a ${ratingLabel} out of 5 rating`,
    };
  }
  const milestone = Math.floor(count / MILESTONE_STEP) * MILESTONE_STEP;
  return {
    count,
    milestone,
    figure: `${milestone}+`,
    ratingLabel,
    summary: `${milestone}+ Google reviews with a ${ratingLabel} out of 5 rating`,
  };
}
