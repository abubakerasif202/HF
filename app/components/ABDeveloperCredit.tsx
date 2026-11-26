export const AB_STUDIO_URL = "https://www.abwebstudio.com.au/";

export function ABDeveloperCredit() {
  return (
    <div className="developer-credit">
      <span className="developer-credit-label">Designed &amp; Developed by</span>
      <a
        className="developer-credit-link"
        href={AB_STUDIO_URL}
        target="_blank"
        rel="noopener noreferrer sponsored"
        aria-label="Visit AB Digital Solutions"
      >
        <img
          src="/branding/ab-digital-solutions-watermark.webp"
          alt="AB Digital Solutions"
          width="672"
          height="309"
          loading="lazy"
          decoding="async"
        />
        <span className="developer-credit-arrow" aria-hidden="true">↗</span>
      </a>
      <span className="developer-credit-promo">Need a website for your business? <a href={AB_STUDIO_URL} target="_blank" rel="noopener noreferrer sponsored">AB Web Studio — Web design &amp; SEO ↗</a></span>
    </div>
  );
}
