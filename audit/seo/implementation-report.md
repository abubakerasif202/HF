# HF SEO implementation — 2026-10-02

## Evidence and architecture

GSC priorities use the user's supplied 90-day summary and query/page examples (2026-07-04 through 2026-10-01), not a downloaded full export. Repository verified as `C:\Users\abuba\HF`, branch `main`, remote `https://github.com/abubakerasif202/HF.git`. Existing package/package-lock and audit/final changes were present before this task and preserved.

Next.js 16.3.6 / React 19 App Router, TypeScript, Node >=22.13.0; inspected Node 22.23.1 and npm 10.9.8. Vercel hosting confirmed by live response headers, repository CI on main push/PR, and cron config in vercel.json. Server-rendered homepage, catch-all static/content routes, dedicated generated area routes; separate booking, administration and API routes. No middleware/proxy in the checkout. No hosting/environment values were modified.

`lib/site-data.ts` owns business identity, contact details, supplied rates, service/guide/route content and canonical origin. `lib/hf-service-areas.ts` builds existing area pages from seeds, regional profiles and local editorial profiles. `app/components/Site.tsx` renders public templates, landmarks, links, breadcrumbs, rates and footer; SiteClient.tsx owns navigation, animation and quote interactivity. Forms retain the existing Web3Forms or feature-flagged Supabase/Resend bridge. Assets are local WebP images with dimensions, responsive homepage srcsets, a high-priority hero and lazy secondary images. Existing CSS typography and visual identity remain.

Metadata lives in app/page.tsx, app/[...slug]/page.tsx and dedicated area routes, with metadataBase in app/layout.tsx. Sitemap and robots are Next metadata routes. All discovery URLs already use the canonical www origin. Private/admin and API paths are excluded from crawl discovery; booking pages have noindex and remain crawlable. Existing business schema deliberately omits third-party aggregateRating and Review markup.

## Findings and implemented changes

- The homepage already has the appropriate Adelaide Removalists & Movers title. Preserved it and its ranking content; refined its description with a quote CTA and minimum/call-out qualification.
- Catch-all detail resolution accepted extra path segments, allowing arbitrary duplicate content URLs. It now requires exactly two segments and returns 404 for invalid descendants.
- Pricing was indexable, self-canonical and in the sitemap; weak performance was not an observed noindex issue. Its main body largely repeated the homepage rate cards. Added a specific prices/hourly-rates H1, billing explanation, cost factors, crew/packing requirements, enquiry instructions and a distinct guide link. Existing rates and booking terms remain unchanged.
- Shared general FAQs diluted service purpose. Added relevant service FAQs, practical sections and clean service-specific H1s. Retained published service facts and all six service URLs.
- Route pages were largely one repeated template. Added distinct Melbourne/Sydney/Perth/Queensland destination preparation plus inventory, pickup/delivery, packing and capacity considerations without transit-time or fixed-price promises.
- Improved the 12 existing priority areas with distinct preparation content/FAQs; added editorial profiles for North Adelaide, Woodcroft and Campbelltown without creating new URLs. Replaced an unsupported claim about regular local jobs with neutral location guidance.
- Related-link defaults were generic and duplicated the pricing link on interstate pages. Added topic-matched guide destinations, selected local service links and clear commercial pricing anchors. Homepage links to pricing and backloading; area pages link to the directory and nearby pages.
- Added WebPage identifiers and visible FAQ schema to content pages, and BreadcrumbList to static pages. All providers reference the same homepage business entity. Changed editorial headings to H2 while retaining their CSS presentation.
- Browser form submission diagnostics exposed an invalid HTML phone pattern under Unicode `v` rules. Escaped its parentheses and hyphen in SiteClient.tsx, preserving accepted phone formats and restoring native validation. Added browser checks for valid and invalid phone values.
- Sitemap/robots already met the canonical and crawlability requirements; preserved their implementations. Full crawl results are in validation-results.json.

## Files changed

Production source: `app/page.tsx`, `app/[...slug]/page.tsx`, `app/components/Site.tsx`, `app/components/SiteClient.tsx`, `app/globals.css`, `lib/site-data.ts`, `lib/hf-service-areas.ts`.

Validation and documentation: `tests/rendered-html.test.mjs`, `tests/seo-regression.test.mjs`, `audit/final/final.spec.cjs` (optional output directory only), `audit/seo/page-intent-map.md`, `audit/seo/validate-seo.mjs`, `audit/seo/implementation-report.md`.

Generated evidence: `audit/seo/validation-results.json`, `audit/seo/validation-console.txt`, `audit/seo/test-results.txt`, `audit/seo/build-results.txt`, `audit/seo/browser-suite-results.txt`, and screenshots/diagnostics under `audit/seo/browser/`. Existing dirty audit/final output and package changes remain separate from this scope.

## Redirect map and infrastructure boundary

| Request | Intended final destination |
| --- | --- |
| HTTPS non-www `/{path}?{query}` | `https://www.hfremovalsadelaide.com.au/{path}?{query}` |
| `/contact-us` or `/contact-us/` | `https://www.hfremovalsadelaide.com.au/contact` |
| `/about-us` or `/about-us/` | `https://www.hfremovalsadelaide.com.au/about` |
| `/interstate-removal-services` with/without slash | `https://www.hfremovalsadelaide.com.au/services/interstate-removals` |
| `/blog` with/without slash | `https://www.hfremovalsadelaide.com.au/guides` |
| canonical content path with trailing slash | same www path without trailing slash |
| `.com` alternate hosts | canonical www `.com.au` host |

Application rules already perform permanent 308 redirects directly to the final www path and preserve queries, including combined legacy-host requests. Live Vercel handling preempts the application: HTTPS non-www legacy path first returns 301 to the same legacy path on www, followed by the application 308. HTTP first returns 308 to HTTPS on the same host, adding another hop. Ordinary HTTPS non-www homepage correctly reaches www in one 301 hop. Do not report the legacy/HTTP live chains as fixed by code.

For HTTPS alias legacy requests to reach the final URL in one hop, the alias must serve this same project so its combined redirect table can run, rather than use the current domain-level host redirect. Confirm project binding/certificate before changing it. Vercel's HTTP-to-HTTPS edge behavior runs before application routing; validate platform support for a combined scheme/host/path redirect. Retain permanent safe redirects if the edge cannot combine them. No DNS/domain settings were changed during this repository implementation.

## Remaining risks and deployment

Final validation: install completed (`npm install --ignore-scripts --no-audit --no-fund`, no dependency changes introduced); lint and typecheck passed; production build passed (174 generated pages); all 167 tests passed with zero failed/skipped; all 36 existing browser tests passed on the final build. SEO validator exited 0 with 168 sitemap URLs checked, zero invalid canonicals/metadata/schema/indexability/alt failures, zero broken links/orphans/duplicate metadata, 56 mobile/desktop checks without overflow/runtime errors/invalid input patterns, eight local redirect probes and 12 live redirect probes. Browser suite's remaining provider 500 diagnostic is the deliberately mocked error-state test. Review and diff hygiene passed.

At the initial implementation checkpoint, changes were local and reviewed. Release verification is a separate phase; use the release evidence files for deployed status. Deploy the focused diff through the existing Git/Vercel flow, excluding unrelated dirty files. Run `node audit/seo/validate-seo.mjs --live` after deployment to verify the released titles/content, canonical tags, robots, sitemap and malformed-route 404s. Domain legacy/HTTP chains need hosting-level follow-up. No new prices, ratings, insurance, hours, coverage or transit times were invented. Existing supplied profile ratings/hours/insurance wording may need ongoing business confirmation; this task is not a fresh independent verification of those claims.

Browser checks detect rendering/overflow/console problems; they are not a field Core Web Vitals measurement. Use GSC CWV/CrUX or PageSpeed after deployment to assess LCP, INP and CLS. No unused dependency removals were made because package changes predated this work and booking/quote functionality must be preserved. Google Business Profile and external backlinks remain external work.

## Search Console follow-up

Compare the next complete 28 days after deployment with the preceding 28 days, using matching search type/country/device filters. Separate HF-branded queries from non-brand, compare clicks/impressions/CTR/position, and inspect ranking URL for each cluster in page-intent-map.md. Track interstate, packing, pricing, 12 priority area pages and each route separately. Check moving services Adelaide/moving companies Adelaide/movers Adelaide snippets and ranking URLs; assess apartment and business queries without creating new pages by default.

Check www/non-www distribution, Google-selected versus declared canonicals, sitemap processing, redirect/404 reports and representative URL Inspection renders. Historical non-www rows do not prove current duplication. FAQ markup is visible-content parity, not a promise of FAQ rich results. Allow recrawl and avoid reacting to short-term position changes with wholesale homepage edits. Verify conversions and quote/booking performance alongside SEO before a second content pass.
