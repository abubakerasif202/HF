# HF Removals Adelaide — Product Design Audit

Audit date: 21 August 2026

## Production domain, form and brand refresh — 25 August 2026

- Switched canonical, Open Graph, schema, robots and sitemap output to `https://www.hfremovalsadelaide.com.au` through the central site origin. The duplicate `.com` host now permanently redirects to the Australian domain.
- Expanded the ruby conversion layer across the most important pricing surfaces: the popular local-rate card, package selector prices and selected state, route prices and primary quote actions. Green and gold remain the foundation so the supplied logo retains its intended balance.
- Configured Web3Forms as the sole quote-delivery provider, with accessible in-page success/error feedback, duplicate-submit protection and a honeypot.
- Updated the privacy disclosure and regression tests to match the actual form processor.
- Regenerated the optimized header/footer logo, browser icons and 1200×630 social image directly from the latest supplied transparent PNG; the repository's existing high-resolution reference master remains archived separately.
- Kept the confirmed Gmail address as the published contact mailbox; no unverified domain mailbox was introduced.
- Added the missing Playwright dependency and a portable Chromium test command. The current execution environment blocked the browser-binary download, so the new run is limited to the fully passing rendered-route suite; the stored multi-viewport browser audit remains the visual baseline because the layout system was not changed.

## Rate update and 3D viewer removal — 24 August 2026

Published local rates updated to $79 per 30 minutes ($158/hr) for 2 movers and a
truck, and $99 per 30 minutes ($198/hr) for 3 movers and a truck.

The figures were retyped as literals in five places outside `lib/site-data.ts`:
the homepage trust strip, the quote form's rate banner, two truck options in the
3D viewer and the homepage meta description. They now read `entryLocalRate`, so
the next change is a single edit.

The 3D fleet viewer was removed at the owner's request. Alongside the component,
this drops the `three` and `@types/three` dependencies, 514 lines of component
code, 328 lines of CSS and a ~506KB client chunk.

It also removes a defect at its source rather than by workaround. The viewer was
`ssr: false`, so its placeholder was roughly 1.5k pixels shorter than the mounted
section and the browser performed hash jumps against the pre-mount layout; a cold
load of `/#reviews` previously landed 894px short on desktop and 1710px short at
320px. The realignment added for that is gone with the component, and both cases
now land correctly on their own.

One unsourced figure disappeared with the viewer: it advertised interstate moves
"From $135 / m³", which matches none of the published route rates ($119.43 to
$186.06).

## Service photography refresh — 24 August 2026

Replaced the four service images with owner-supplied HF-branded scenes:
residential handover, packing/mattress protection, city office move and a loaded
truck at a home. Same 1672x941 dimensions as the assets they replace, re-encoded
to WebP q74 (525KB total across four lazy-loaded images, up from 407KB).

Alt text was rewritten to describe what each new image actually shows. The
interstate slot previously claimed "travelling on an Australian highway at
sunset", which is not what the new photograph depicts.

The apartment/CBD section now uses the office scene, since the residential image
is a suburban handover and that section is about multi-storey and CBD access. Its
image box also drops from 480px to 320px tall under 600px wide, which lifts the
visible portion of the frame on a phone from roughly a third to a half.

**Known defect, shipped at the owner's direction:** the truck livery in the
interstate and office images carries generated-text errors — "HF RMOVALS" on the
cab in both, plus "LOCAL & INTESTATE" and "STORAGEE SOLUTIONS" on the office
image. These were raised before use and accepted in favour of keeping the scenes.
Regenerating those two frames with corrected livery is the outstanding follow-up.

## Re-audit: layout, assets and semantics — 24 August 2026

Follow-up pass against the production build. Findings below were verified by measuring
live layout geometry, not by inspection alone.

### Fixed

- **Hidden horizontal overflow at mobile widths.** `<main>` measured 355px of content
  inside a 320px viewport. Three independent causes, each previously masked by an
  ancestor clipping `overflow-x` rather than resolved: `<fieldset>`'s default
  `min-inline-size: min-content` stopped the quote grid shrinking; the unbreakable
  `$1,000,000` figure set a 339px min-content floor on the insurance panel; and the
  five-step process list held two columns below 480px. `main.scrollWidth` now equals
  the viewport at every tested width.
- **Detail-page label crushed into a 6px track.** `.detail-bars` rows render four
  children (number, connector, label, dot) against only three declared grid columns,
  so the label was auto-placed into the trailing 8px track and overflowed on all 22
  service, area, route and guide pages. The connector `<i>` also had no rule at all.
- **Favicon was still the generic blue starter glyph**, contradicting the previous
  entry in this document. Replaced with icons generated from the HF truck lockup,
  plus an apple-touch-icon that was missing entirely.
- **~4MB of unreferenced assets were being served** from `public/` (a 2.28MB `og.png`
  superseded by `og.webp`, three legacy logo files, the original portrait and three
  Next.js starter SVGs). Masters moved to `brand/originals/`; `public/` is now 1.6MB.
- **419KB logo rendered at 96px.** Header and footer now use a 384px derivative
  (55KB) that still covers the largest render at 2x DPR.
- **Invalid ARIA on the move-type chooser.** `role="tab"` without tabpanels,
  `aria-controls` or arrow-key handling is not a valid tabset; it is a two-option
  choice, so it now uses `radiogroup`/`radio` with `aria-checked`.
- 404 responses are now `noindex`; the quote form's two-column grid stacks below
  430px; the packing checklist stacks below 520px; the mobile menu contains its own
  scroll chaining.

### Superseded production-origin note

The previous Vercel-alias redirect decision was superseded on 25 August 2026 when the
new `.com` production domain and Web3Forms flow were confirmed.

## Logo, motion and responsive QA — 24 August 2026

- Replaced the previous HF-only header mark with the supplied green, gold and ruby truck lockup across the header, footer, favicon metadata, inner-page brand art and social-sharing image.
- Preserved the exact uploaded PNG as the master source and generated an 800px lossless WebP for the live UI.
- Added restrained logo entrance, hover gleam, hero drift, page scroll progress and staggered viewport reveals.
- Kept animation progressive-enhancement only: content remains visible without JavaScript and all motion collapses under `prefers-reduced-motion`.
- Improved keyboard access to desktop dropdowns and upgraded the mobile menu with an animated close state, focus trapping and Escape-to-close.
- Fixed the mobile menu stacking context so it occupies the full viewport outside the backdrop-filtered sticky header.
- Updated and optimized the Open Graph image so social previews use the supplied truck logo.

Validation completed at desktop and mobile widths with no horizontal overflow, TypeScript and ESLint passing, and the production build generating all 37 routes with all five rendered-route test groups passing.

## Scope reviewed

- Homepage
- Services listing and all five service detail pages
- Areas listing and all five area detail pages
- Interstate listing and all four route pages
- Guides listing and all eight guide pages
- Adelaide removalists hub
- Pricing, About, Contact, Privacy, Terms and 404 templates
- Desktop, laptop/tablet and mobile layouts at 1440, 1024, 768 and 390 pixels

The site is data-driven, so representative pages from each shared template were captured and visually compared while automated route tests covered the complete static route inventory.

## Findings and implementation

### High severity

| Finding | User impact | Implemented fix |
| --- | --- | --- |
| The homepage quote form presented seven required fields plus optional details at once. | High mobile effort and a long first screen could suppress enquiries. | Reduced the initial request to five essentials. Email, date, property size and notes now use a clearly labelled optional disclosure. The server validation and rate-limit key support the shorter flow. |
| Inner-page heroes relied on a large heading and decorative monogram with little service context. | Service, area and guide pages felt repetitive and visually sparse. | Added page-aware HF service photography, descriptive captions and a verified profile summary. Route pages retain the supplied rate card. |
| Mobile service and imagery sections stacked every card vertically. | Excessive page length made discovery slower. | Converted these sections to contained, snap-aligned horizontal galleries with a visible next-card edge. The document itself retains no horizontal overflow. |

### Medium severity

| Finding | User impact | Implemented fix |
| --- | --- | --- |
| Navigation did not identify the current page. | Weaker orientation, especially inside nested service and guide routes. | Added pathname-aware styling and `aria-current="page"` to desktop and mobile navigation. |
| Detail pages moved quickly from brief planning copy to FAQs. | Customers lacked a consistent framework for preparing a useful enquiry. | Added a premium quote-readiness section covering addresses/access, inventory/volume, packing support and placement. |
| Detail-page quote cards provided only one action. | Call-preferring users had to look elsewhere. | Added a direct phone alternative using the existing primary business number. |
| Four-item guide sections did not fill the original fixed three-column grid consistently. | Uneven whitespace and weak rhythm on desktop. | Replaced the fixed grid with a responsive auto-fit layout. |

### Lower severity and polish

- Strengthened dark-surface text contrast and content readability.
- Tightened inner-page display typography on smaller screens.
- Added semantic fieldsets and legends to the quote form.
- Added clear open/close feedback to optional-form disclosure.
- Added active-state feedback to mobile navigation.
- Kept 44-pixel-or-larger mobile interaction targets, visible keyboard focus, skip navigation and reduced-motion behaviour.
- Confirmed the supplied uploaded logo is byte-identical to the existing source logo already used to generate the transparent and header assets.

## Content integrity

No testimonials, awards, clients, statistics or operational claims were invented. The review section uses only customer names, ratings, complete text and clearly labelled visible excerpts supported by user-supplied Google Business Profile screenshots. Existing prices, phone numbers, addresses, leadership information, coverage wording and Google profile data remain centralised in `lib/site-data.ts`. The new content explains how to prepare a move enquiry and does not imply guarantees.

## Verification

- `npm run typecheck` — passed
- `npm run lint` — passed
- `npm test` — passed: production build, 38 generated pages and 5 test groups
- Web3Forms endpoint, field mapping, honeypot, native validation, loading state and success/error flow — covered by rendered-HTML regression tests
- Browser interaction QA — passed for optional disclosure, mobile menu open/Escape close, active navigation, page overflow and contextual hero imagery
- Final screenshots captured at 1440, 1024, 768 and 390 pixels

## Screenshot inventory

Key before/after files are stored under:

- `audit/before/desktop/`
- `audit/before/mobile/`
- `audit/after/desktop/`
- `audit/after/tablet/`
- `audit/after/mobile/`

