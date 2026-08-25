# HF Removals Adelaide

Premium multi-route website for HF Removals Adelaide, built with Next.js and deployed exclusively on Vercel.

## Local development

Requires Node.js 22.13 or newer.

```powershell
npm ci
npm run dev
npm run build
npm test
npm run lint
```

For the responsive Chromium QA suite, install the browser once and run:

```powershell
npx playwright install chromium
npm run test:browser
```

## Production domain

The canonical production origin is `https://www.hfremovalsadelaide.com.au`. Metadata, Open Graph URLs, structured data, robots.txt and the sitemap all read from the central site configuration in `lib/site-data.ts`. The `.com` hostname permanently redirects to the canonical Australian domain.

## Quote delivery

The homepage and Contact quote forms submit to Web3Forms. JavaScript submissions keep the customer on-site and provide accessible success/error feedback. Browser validation, duplicate-submit protection and the existing honeypot are enabled. The Web3Forms access key is a public form identifier used by the browser, not a server-side secret.

## Supplied facts and media

Business details and published pricing are centralized in `lib/site-data.ts`. The source JSON and CSV contained truncated currency values, so readable rates were transcribed from the supplied Markdown summary and project brief. The hero is a generated project asset based on the supplied HF logo and approved visual direction. The CEO section uses the supplied original portrait rather than an identity-altering generated replacement.
