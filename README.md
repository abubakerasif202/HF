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

## Quote delivery

The homepage and Contact quote forms submit directly to [Web3Forms](https://web3forms.com) via a native `POST` to `https://api.web3forms.com/submit`. Native browser validation runs before submission, a `botcheck` honeypot field is included, and successful submissions return to the originating route on the public Vercel production alias (`?quote=sent#quote`) with an on-site confirmation message.

The Web3Forms access key is a publishable, client-side key by design — it is not a secret, and no form-delivery environment variable is required. There is no API route and no client-side `fetch`; the browser posts the form directly.

## Supplied facts and media

Business details and published pricing are centralized in `lib/site-data.ts`. The source JSON and CSV contained truncated currency values, so readable rates were transcribed from the supplied Markdown summary and project brief. The hero is a generated project asset based on the supplied HF logo and approved visual direction. The CEO section uses the supplied original portrait rather than an identity-altering generated replacement.
