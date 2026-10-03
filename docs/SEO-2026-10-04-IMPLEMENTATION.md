# HF implementation — 4 October 2026

Implemented incrementally on the existing Next.js 16.3.6 site. No new marketing routes, business claims, reviews, rates or service areas were added. The homepage title/H1, canonical strategy, sitemap inventory, redirect configuration, established design and Web3Forms provider were preserved.

## Changes and reasons

- Six service pages: added distinct customer-fit, agreed-scope, preparation and handover guidance. Replaced repeated general FAQs where a service-specific question is more useful. The office page distinguishes physical moving from customer IT preparation; backloading explains separate date windows and capacity assessment without promising availability or discounts.
- Titles: furniture now uses `Furniture Removalists Adelaide | HF Removals Adelaide`; office uses `Office & Commercial Removalists Adelaide | HF Removals Adelaide`; packing uses `Packing & Unpacking Adelaide | HF Removals Adelaide`. These feed Open Graph and Twitter metadata too. House/interstate/backloading/home titles retain their existing wording.
- Internal links: replaced array-order related-service selection on furniture, office, packing and backloading pages with explicit complementary services, relevant planning guides and the area directory. Existing residential/interstate/area link relationships remain.
- Seven planning guides: replaced shared general-moving FAQs with two topic-specific questions each. The pricing guide retains its own calculation FAQs. FAQ schema reads the same content as the page.
- Schema: Service now declares serviceType and the relevant Adelaide/interstate scope. Homepage OpeningHoursSpecification reads unchanged days and times from lib/site-data.ts.
- Homepage copy: replaced the manual enquiry's `Instant Quote` label; removed unsupported damage-free and complimentary floor-runner/corner-guard promises.
- Images: apartment image, four gallery images and shared inner-page hero use responsive Next Image optimization. Hero media remains eager/high priority; below-fold images remain lazy. Sizes match the 680px gallery and 900px single-column breakpoints.
- Mobile navigation: added a 44px internal dialog close button, restored trigger focus on dismissal and prevented delayed focus retries from overriding navigation inside the menu.
- Quote form: separate origin/destination autocomplete sections; 20-second request/body timeout; preserved input/reference after uncertain delivery, with a call-before-retry message. No automatic POST retries. Provider, required fields, customer Reply-To and confirmed-success reset remain.
- Tests: complementary service links, schema scope, guide FAQ/schema parity, keyboard dismissal, input preservation, mocked provider success/failure/timeout and duplicate-submit prevention. Existing browser tests now fill the required date and reset email/date between submissions.
- .env.example: removed obsolete quote-bridge setup wording; Resend remains booking notification configuration.

## Verification and limitations

Final `npm test` built 173 static pages and passed 160 tests, with zero failures or skipped tests. Lint and typecheck passed. The final supported browser suite passed 36/36. Quote provider requests in tests were mocked; no lead was sent and inbox delivery was not tested.

The final-build crawl checked all 168 sitemap URLs: zero page failures, broken internal links/fragments, orphans, duplicate titles or duplicate descriptions. Robots and sitemap returned 200 with the canonical sitemap declaration. The final responsive rerun checked 11 representative pages at 320, 360, 375, 390, 412, 430, 768, 820, 1024, 1280, 1440 and 1920px: 132 checks, zero overflow, failed visible images, console errors, page errors or non-200 page responses. There are 44 viewport/full-page screenshots. Representative mobile-home and desktop-furniture screenshots were visually inspected.

The first final matrix logged network/DNS console errors in 43 checks. These failures remain in initial-final-matrix.json and production-verification.json. A focused probe and the full attribution rerun were clean; browser-verification.json contains the successful final responsive results and 142 aborted requests caused by navigation/context closure, without HTTP error responses. No external network errors were filtered out to manufacture a pass. Earlier lazy-image/canonical failures were test-harness issues corrected before the final crawl/matrix.

Read-only production probes returned 200 for the homepage, all six service pages, robots and sitemap. `/contact-us/?utm_source=audit` returned a permanent redirect to the canonical contact URL with the query preserved. These probes concern the pre-existing live release; this implementation has not been pushed or deployed.

At 640px/q75, measured image response sizes were 42,047 bytes (residential), 45,734 (office), 35,372 (packing), and 45,781 (apartment), versus originals of 216,978 / 262,490 / 187,722 / 284,476 bytes. That is 81–84% less per tested image. This is transfer-size evidence, not a live Core Web Vitals improvement claim.

Production-only npm audit reported zero vulnerabilities. Full audit reported five high-severity entries tracing through ESLint's Next plugin → fast-glob → micromatch → braces 3.0.3. [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) lists no patched version. npm proposes a major eslint-config-next downgrade to 14.2.35; this was not applied. Existing package/package-lock edits were preserved.

NAP matches the supplied values and remains in lib/site-data.ts. Google rating 5.0 and review count 451 are stored values with a 20 September verification date, not a live API feed. Keep them pending current official evidence; Birdeye's reported count does not replace Google evidence.

See SEO-2026-10-04-AUDIT.md for all 168 intended indexable routes, keyword ownership, remaining area-content opportunities and the monitoring plan. See SEO-OFFSITE-ACTIONS.md for uncompleted external listing and genuine Adelaide partnership recommendations. QA logs, raw network diagnostics and screenshots are in audit/2026-10-04/.
