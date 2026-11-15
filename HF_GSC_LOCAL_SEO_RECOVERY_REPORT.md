# HF Removals Adelaide: GSC Local SEO Recovery Report

Branch: `seo/gsc-local-ctr-recovery`. Data: GSC export `gsc_20261115_042849` (current 2026-10-16 to 2026-11-11, previous 2026-09-18 to 2026-10-15).

## 1. Matched-period comparison

| Window | Days | Clicks | Impressions | CTR | Avg pos |
|---|---:|---:|---:|---:|---:|
| Previous (all) | 28 | 227 | 16,108 | 1.41% | 10.84 |
| Previous (first 27 days, matched) | 27 | 216 | 15,432 | 1.40% | 10.90 |
| Current | 27 | 166 | 22,341 | 0.74% | 10.78 |

Matched-period change: clicks -23% (216 to 166), impressions +45%, average position essentially flat. Query-level files are whole-period aggregates, so branded/non-branded splits below use 28 vs 27 days.

## 2. Branded vs non-branded

Brand queries (`hf removals adelaide`, `... reviews`, `hf removals`):

| | Clicks | Impressions | CTR |
|---|---:|---:|---:|
| Previous | 103 | 626 | 16.5% |
| Current | 42 | 324 | 13.0% |

Total clicks fell 61 (227 to 166). Brand clicks fell 61 (103 to 42). Everything else, including anonymised queries, was 124 clicks in both periods. So the entire net click loss is branded.

Non-branded query rows: 52 to 53 clicks on 12.5k to 17.5k impressions (CTR 0.41% to 0.30%).

## 3. Root causes supported by evidence

- **Brand demand fell, rankings did not.** `hf removals adelaide` stayed at position about 1.6 while impressions fell 427 to 209. Fewer people searched the brand. There is no evidence of a penalty or ranking loss.
- **Generic rankings improved, clicks did not follow.** The homepage rose for `removalists adelaide` (7.0 to 3.6), `adelaide removalists` (9.1 to 4.1), `furniture removalists adelaide` (10.8 to 5.9) and `house movers adelaide` (5.9 to 1.9). Impressions grew about 45% but non-brand clicks stayed flat. CTR at positions 2.5 to 4.6 is 0.6 to 1.2%, far below normal organic CTR for those positions.
- **Likely causes of the low CTR, not provable from GSC:** map pack, ads or AI features above the organic result, and non-human impression inflation. Desktop is the weak segment (0.44% CTR on 13.6k impressions) versus mobile (1.20%).
- **Reason for the brand demand drop is unknown.** It could be seasonality, a stopped offline or paid activity, or fewer repeat or referral searches. Check Google Business Profile (GBP) Insights and any paid activity in the earlier period.
- **Pricing-page mismatch:** for `removalists adelaide prices` the homepage ranks about 7.8 and `/pricing` about 21.8. The `/pricing` title ("Removalist Pricing Adelaide") did not match the query terms "prices" or "hourly rates", even though its H1 does.

## 4. Keyword-to-page mapping (from `query_page_current.csv`)

| Cluster | Owner page | Evidence |
|---|---|---|
| A: Adelaide removalists, movers, moving company, removals | `/` | Ranks 2.5 to 5.9 for all of these |
| B: near me, local | `/` (map-pack dependent) | `removalists near me` 315 impressions at pos 14.8 |
| C: cheap, affordable, prices, hourly rates | `/pricing` (title fixed); `/` holds secondary rankings | `cheap removalists adelaide` pos 9.7; `/pricing` pos 21.8 |
| D: house | `/services/residential-removals` | Homepage currently ranks instead; service page pos 24 |
| D: furniture | `/services/furniture-removals` | As above, pos 21.7 |
| D: office | `/services/office-commercial-removals` | Pos 28 |
| D: packing | `/services/packing-unpacking` | Pos 15 |
| D: interstate | `/services/interstate-removals` and `/interstate/*` routes | Melbourne and Sydney routes pos 15 to 16; commit `5b04102` already targets them and has not yet had time to show effect |

No keyword volumes were invented.

## 5. Before and after metadata

| URL | Before | After |
|---|---|---|
| `/` description | "Removalists and movers in Adelaide for house, furniture, office and interstate moves. From $69/30 min; minimum service and call-out apply. Request a quote." | "Local Adelaide removalists and movers for house, furniture, office and interstate moves. Clear truck-and-crew rates from $69/30 min; minimum service and call-out apply. Free quotes." |
| `/` title | unchanged ("Removalists Adelaide & Movers \| HF Removals Adelaide") | unchanged, to protect top-5 rankings |
| `/pricing` title | "Removalist Pricing Adelaide \| HF Removals Adelaide" | "Removalist Prices Adelaide & Hourly Rates \| HF Removals Adelaide" |
| `/pricing` description | "Compare Adelaide moving rates from $69/30 min. Choose your truck and crew; minimum service and a separate call-out fee apply. Request a quote." | "Adelaide removalist prices and hourly rates from $69/30 min ($138/hour) with a 2-man crew. Compare Small, MR and HR trucks; minimum service and call-out apply. Free quotes." |

All figures are derived at build time from `lib/site-data.ts`, so they cannot drift from the approved package table. "Free quotes" is an owner-confirmed fact (2026-10-15).

## 6. Files modified

- `app/page.tsx` (homepage description)
- `app/[...slug]/page.tsx` (pricing title and description)
- `tests/rendered-html.test.mjs` (updated the two assertions that pin these strings)

## 7. Internal links and content

No new links or body content were added. The homepage already links to every cluster-D service page, `/pricing` ("Adelaide removalist prices") and `/areas`. The pricing page already explains per-30-minute and per-hour billing, the 3-hour minimum, the call-out fee and interstate per-m³ reference rates. The pricing source was verified: Small $69, MR $74, HR $79 per 30 minutes with 2 movers, and 3 movers + truck $99 per 30 minutes (truck assigned to suit the load). Nowhere is $158/hour presented as the standard rate for every truck.

## 8. Mobile and conversion checks

**Not run.** The 320 to 1440px visual pass and the Playwright browser suite (`npm run test:browser`) were not executed in this session. Only metadata changed, so layout and forms were not touched.

## 9. Test results

- `npm run typecheck`: passed.
- `npm run lint`: 0 errors, 1 warning (a scratch file in `.remember/`, unrelated).
- `npm test` (build plus 238 node tests): 231 pass, 7 fail.
  - The rendered-HTML tests covering the changed title and descriptions pass.
  - The 7 failures are quote-form tests (5), the phone-pattern test, and the admin-authorisation test. They fall in files with pre-existing uncommitted changes that are not part of this work (`app/components/SiteClient.tsx` has a stricter phone `pattern` that rejects the test number `(0491) 704-136`, and the `app/admin` layout files). These failures were **not** confirmed against a clean checkout. Resolve them before the next deploy.

## 10. Remaining risks

- Brand clicks are down 59% with no code-level cause found. Investigate GBP Insights, paid or offline activity, and review velocity.
- Low CTR at strong positions is probably a SERP-layout issue. Metadata tweaks are small levers.
- `removalists near me` depends on GBP proximity and relevance. Ensure GBP categories, services, hours and photos match the site.
- Homepage ranks for house and furniture queries where the dedicated service pages should. Keep the homepage and service-page titles distinct, and do not over-optimise either.
- Unrelated uncommitted work in the tree (admin, dispatch, `SiteClient.tsx`) was left untouched and is not committed on this branch.

## 11. 28-day monitoring

Compare against the 27-day baseline above:

- Non-branded clicks (baseline 124) and impressions.
- Homepage CTR for `removalists adelaide`, `removalist adelaide` and `movers adelaide` (baseline 0.6 to 1.2%).
- `/pricing` position and clicks for `removalists adelaide prices` (baseline pos 21.8).
- Brand impressions, clicks and CTR for `hf removals adelaide` (baseline 209 impressions, 31 clicks).
- Desktop CTR (baseline 0.44%).
- GBP calls, direction requests and website clicks.
- Quote-form submissions and booking starts.
