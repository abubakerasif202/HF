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

The homepage and Contact quote forms submit directly to FormSubmit for `hfremovalad@gmail.com`. Native browser validation runs before submission, FormSubmit's honeypot remains enabled, and successful submissions return to the originating production route with an on-site confirmation message.

The FormSubmit destination was activated by the mailbox owner on 24 August 2026. No form-delivery secret or environment variable is required.

## Supplied facts and media

Business details and published pricing are centralized in `lib/site-data.ts`. The source JSON and CSV contained truncated currency values, so readable rates were transcribed from the supplied Markdown summary and project brief. The hero is a generated project asset based on the supplied HF logo and approved visual direction. The CEO section uses the supplied original portrait rather than an identity-altering generated replacement.
