# CLAUDE.md

Guidance for Claude Code and other AI assistants working in this repository.

## What this is

A marketing website for **HF Removals Adelaide**, an Australian removalist
business. It is a statically-generated multi-route Next.js App Router site
deployed on Vercel. There is no database, no API layer, no auth, and no
server-side mutation: every route renders from constants in `lib/site-data.ts`,
and the only outbound write is the quote form POSTing to a third-party form
service.

Because it is a real business site, **content accuracy is a hard requirement**,
not a stylistic preference. See "Content integrity rules" below — the test suite
enforces several of them.

## Stack

| Concern | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, Turbopack), React 19 |
| Language | TypeScript 5.9, `strict: true`, `@/*` → repo root |
| Styling | Tailwind v4 (`@import "tailwindcss"` only) + one hand-written stylesheet |
| Tests | `node --test` against a real production server |
| Node | >= 22.13 (`engines`) |
| Hosting | Vercel |

## Commands

```bash
npm ci           # install (lockfile is authoritative)
npm run dev      # next dev
npm run build    # next build
npm test         # next build && node --test tests/rendered-html.test.mjs
npm run typecheck# tsc --noEmit --incremental false
npm run lint     # eslint . (ignores .next, dist, audit/)
```

`npm test` builds first and then boots `next start` on port 31487 inside the
test file, so it is slow but exercises the real rendered HTML and the real
compiled CSS. There is no watch mode and no unit-test layer.

`npm run test:browser` runs the Playwright audit specs (see "Audit harness").

All 14 tests pass, and typecheck and lint are clean. Treat any failure as caused
by your change.

The form provider has changed several times: FormSubmit, then Web3Forms
(`9af5a6c`), then Formspree (`6cbc9ae`), then back to **Web3Forms** in
`54c369f`. Web3Forms is current, and it is the sole provider — there should be
no `formspree.io`, `formsubmit.co`, `_subject`, `_captcha`, `_honey` or `_next`
anywhere in the source, and the quote-flow test asserts their absence. Check
`quoteFormEndpoint` in `lib/site-data.ts` before believing any prose about the
provider, this file included. Dated entries in `DESIGN_AUDIT.md` still name
older providers because they record what was true on those dates; leave that
history alone.

## Layout

```
app/
  layout.tsx              root <html>, global metadata, icons, preconnects
  page.tsx                homepage + MovingCompany/WebPage/FAQPage JSON-LD
  [...slug]/page.tsx      every other route: static, listing and detail pages
  not-found.tsx           404 (noindex)
  robots.ts, sitemap.ts   generated from lib/site-data
  globals.css             ~3,100 lines; the entire design system
  chatgpt-auth.ts         ChatGPT header-based auth helper — currently unused
  components/
    Site.tsx              all server components / page compositions (~1,090 ln)
    SiteClient.tsx        all "use client" components (~660 ln)
    patterns/
      PricingBreakdownPattern.tsx   reusable pricing block — currently unused
lib/site-data.ts          single source of truth for every business fact
tests/rendered-html.test.mjs
audit/                    ad-hoc Playwright QA harness (not part of npm test)
brand/                    high-res masters, deliberately outside public/
public/images/            shipped, optimised WebP derivatives
DESIGN_AUDIT.md           dated log of design/QA findings and decisions
```

### Routing

Only two page files exist. `app/page.tsx` is the homepage; **every other route**
is served by the catch-all `app/[...slug]/page.tsx`, which dispatches on the
first slug segment:

- `staticPages` map → `about`, `contact`, `pricing`, `adelaide-removalists`,
  `privacy`, `terms` → `<StaticPage type=…>`
- `listingPages` map → `services`, `areas`, `interstate`, `guides` →
  `<ListingPage kind=…>`
- otherwise `findContentPage(slug)` → `<DetailPage page=…>` for
  `/services/*`, `/areas/*`, `/interstate/*`, `/guides/*`
- no match → `notFound()`

`generateStaticParams()` prerenders from `indexablePaths`. **Adding a route means
adding it to `lib/site-data.ts`** (a `ContentPage` in `services`/`areas`/
`interstateRoutes`/`guides`, or an entry in the map plus `indexablePaths`) — not
creating a new file under `app/`.

### Server vs client split

`Site.tsx` has no `"use client"`; it composes pages and is where new sections
belong. Anything needing state, effects or browser APIs goes in `SiteClient.tsx`
(`UtilityBar`, `MotionExperience`, `Header`, `QuoteForm`, `MobileStickyCta`) and
is imported by `Site.tsx`. Keep that boundary — do not add `"use client"` to
`Site.tsx`.

`SiteFrame` wraps every page with skip link, scroll-progress, utility bar,
header, `<main id="main">`, footer and mobile sticky CTA.

## Conventions

### `lib/site-data.ts` is the single source of truth

Phone numbers, emails, address, rates, the Google rating/review count, insurance
wording, packing materials, image paths, nav, FAQs and all page copy live here.
Components import them; they never retype them.

The test suite actively enforces this. `tests/rendered-html.test.mjs` strips
comments from `Site.tsx`, `SiteClient.tsx` and `app/page.tsx` and asserts none of
them contains a literal `4.9`, `417`, or a `$NN/30min`-shaped rate. Use
`business.googleBusiness.rating`, `business.googleBusiness.reviewCount` and
`entryLocalRate` instead. `googleReviews` likewise lives in site-data, not in a
component.

### Origin constants

`siteOrigin` (`https://www.hfremovalsadelaide.com.au`) is the **single canonical
production origin**. It drives canonicals, sitemap, robots, Open Graph/Twitter
URLs and JSON-LD `@id`s. It is declared once in `lib/site-data.ts` and a test
asserts that exact literal; `business.domain` derives from it.

Note the TLD: the canonical domain is **`.com.au`**. The `.com` domain is a
duplicate, and both it and the superseded `hf-removals-adelaide.vercel.app`
alias must not appear in rendered output — a test asserts
`hfremovalsadelaide.com` never appears without the `.au`.

`next.config.ts` holds one `redirects()` table with three groups, in this order:

1. **Legacy paths** — `/about-us`, `/contact-us`, `/interstate-removal-services`,
   `/blog`, each with its trailing-slash twin, pointing at the current route.
2. **Non-canonical hosts** — `www.hfremovalsadelaide.com`, the `.com` apex, the
   `.com.au` apex and the Vercel alias, all to the canonical www host with the
   path preserved.
3. **Trailing-slash normalisation** (`/:path+/` → `/:path+`), last so a request
   on a non-canonical host reaches the canonical host before the slash is
   stripped.

`skipTrailingSlashRedirect: true` is set so the legacy trailing-slash entries
reach their replacement directly instead of normalising first.

Host matching is on exact host, so per-branch preview URLs and `localhost` are
untouched and local development still works. Tests assert specific rules by
grepping the config file **as text**, so keep `destination` values as inline
string literals rather than refactoring them into a shared constant — that
refactor passes typecheck and fails the tests.

Beware when merging: this file has produced a clean merge with two `redirects()`
keys in one object literal, where the second silently overrides the first while
typecheck and lint still pass. After any merge, confirm there is exactly one.

**DNS is not part of the repo:** each host must have a record pointing at Vercel
and be added to the Vercel project for its redirect to be reachable.

Use `canonical(path)` rather than string-concatenating the origin.

### Styling

All CSS is hand-written in `app/globals.css` under `====`-banner section
comments, using `--hf-*` custom properties defined on `:root` (green/gold is the
supplied logo palette; ruby is the action/interaction layer added in `8947435`).
Tailwind is imported but utility classes are essentially unused — **match the
existing semantic-class approach**; do not start sprinkling Tailwind utilities.

Several CSS rules exist to fix specific, measured mobile-overflow defects and are
asserted by tests (`min-width: 0` on `.form-grid` and its labels, the 430px
single-column collapse, `.mobile-menu` `overflow-y`/`overscroll-behavior`, the
four-track `.detail-bars` grid, `.packing-grid > *`, the `.insurance-panel`
container query). Do not remove them casually. Any grid/flex child holding
unbreakable content needs `min-width: 0`.

`@media (prefers-reduced-motion: reduce)` neutralises animation globally; new
motion must respect it, and `MotionExperience` already checks the media query in
JS.

### Images

Masters live in `brand/originals/` and are deliberately **not** under `public/` —
a test asserts they 404 in production. `public/images/` holds only optimised WebP
derivatives at the sizes actually rendered (e.g. `hf-logo-384.webp` covers the
176px footer mark at 2× DPR). Regenerate derivatives from the masters; never
hand-edit `public/images/`. `next/image` is not used: native `<img>`/`<picture>`
with explicit `width`/`height`, `srcSet` and `sizes`, and the ESLint rules
`@next/next/no-img-element` and `no-html-link-for-pages` are off on purpose
(native anchors give direct canonical navigation).

### SEO / structured data

JSON-LD is emitted inline per route via `dangerouslySetInnerHTML`. Homepage emits
`MovingCompany` + `WebPage` + `FAQPage`; detail pages emit `Service`/`Article` +
`BreadcrumbList`; listing pages emit `CollectionPage` + `ItemList` built from the
matching `lib/site-data.ts` collection; static pages emit their mapped type.

**Do not add `aggregateRating` or `Review` markup.** The 4.9/417 figures come from
the business's Google profile, and marking third-party ratings as first-party
risks a manual action. The visible reviews section cites Google and links out
instead. Two tests guard this.

Only the homepage carries `FAQPage`; a test asserts service pages do not.
Canonicals must not have trailing slashes.

### Quote form

`QuoteForm` in `SiteClient.tsx` posts to **Web3Forms**; both
`quoteFormEndpoint` and `web3FormsAccessKey` live in `lib/site-data.ts` and a
test asserts each literal. `onSubmit` builds a `FormData` from the form, appends
`access_key`, `fetch`es the endpoint and parses the JSON reply, treating
`success !== true` as an error, then shows an inline message — so the visitor
never leaves the page. Native browser validation runs before submit, a `_gotcha`
honeypot is present, and `subject`, `from_name`, `source_page` and
`move_category` ride along as hidden inputs.

Note that `access_key` is appended in JS rather than rendered as a hidden input,
while the `<form>` still carries `action={quoteFormEndpoint}` `method="POST"`.
The scripted path is the working one; a no-JS native submit would post without
the key. Keep that in mind before describing the form as a progressive-
enhancement fallback.

There is **no API route of this project's own** — tests assert `SiteClient.tsx`
contains no `fetch("/api/quote…")`. The Web3Forms access key is a publishable,
client-side identifier by design; it is not a secret. There are no environment
variables in this project.

### Content integrity rules

Tested and non-negotiable:

- No unsourced superlatives: `five-star`, `fully insured`, `no hidden fees`,
  `on-time every time`, `#1 Adelaide`, `award-winning`, `200+ happy` etc. must
  not appear.
- No invented reviewers or placeholder names.
- Insurance is always "**up to** $1,000,000 … subject to applicable policy terms",
  never "fully insured".
- Interstate prices are **per-m³ reference rates**, never a total move price —
  every place they appear must say so.
- Local rates are published per 30 minutes with the hourly equivalent.

## Accessibility

Recurring patterns that tests or prior audits locked in: skip link to `#main`;
the move-type chooser uses `role="radiogroup"`/`role="radio"` with arrow-key
handling (an earlier `role="tab"` version was invalid ARIA and is asserted
against); decorative SVGs and the ticker track are `aria-hidden` with an
`sr-only` text equivalent; the map iframe has a title, `loading="lazy"` and
`referrerpolicy`; the 404 page is `noindex`.

## Audit harness

`audit/` contains standalone Playwright specs (`baseline/`, `final/`) that
measure live layout geometry — scroll width vs client width, hash-jump accuracy,
console/network errors — against a local server on port 3100. `@playwright/test`
is a devDependency and `npm run test:browser` runs the `final/` config; these
specs are separate from `npm test` and are not part of the default gate.
`audit/` is excluded from ESLint. Screenshots are gitignored.
`DESIGN_AUDIT.md` is the dated write-up of what each pass found and what was
deliberately left alone (including the known misspelled truck livery in two
supplied photographs, accepted by the owner).

## Working agreements

- Branch work as instructed; do not push to `main`.
- Run `npm run typecheck`, `npm run lint` and `npm test` before pushing; all
  three should be clean.
- Change a business fact in `lib/site-data.ts` and nowhere else.
- When you change something the tests describe in prose (the form provider, the
  origin, an asset name), update the assertions in the same commit.
- Add a dated section to `DESIGN_AUDIT.md` for design/QA passes with measured
  findings.
