# HF Removals Adelaide — Product Design Audit

Audit date: 21 August 2026

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

No testimonials, awards, clients, statistics or operational claims were invented. Existing prices, phone numbers, addresses, leadership information, coverage wording and Google profile data remain centralised in `lib/site-data.ts`. The new content explains how to prepare a move enquiry and does not imply guarantees.

## Verification

- `npm run typecheck` — passed
- `npm run lint` — passed
- `npm test` — passed: production build, 38 generated pages and 5 test groups
- Quote API validation and rate limiting — passed existing coverage
- Browser interaction QA — passed for optional disclosure, mobile menu open/Escape close, active navigation, page overflow and contextual hero imagery
- Final screenshots captured at 1440, 1024, 768 and 390 pixels

## Screenshot inventory

Key before/after files are stored under:

- `audit/before/desktop/`
- `audit/before/mobile/`
- `audit/after/desktop/`
- `audit/after/tablet/`
- `audit/after/mobile/`

