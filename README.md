# HF Removals Adelaide

Premium multi-route marketing site for HF Removals Adelaide, built with Next.js (App Router) and deployed on Vercel.

## Local development

Requires Node.js 22.13 or newer (see `.nvmrc`).

```powershell
npm ci
npm run dev
npm run build
npm test
npm run lint
npm run typecheck
```

`npm test` runs a production build, then boots `next start` on ports 3117 and 3118 and asserts against the real HTTP responses.

## Deploying to Vercel

Vercel auto-detects Next.js — no `vercel.json` is required. Import the repository, then set the environment variables below under **Project Settings → Environment Variables**.

| Variable | Required | Purpose |
| --- | --- | --- |
| `QUOTE_ENDPOINT_URL` | yes, for online delivery | HTTPS endpoint that accepts validated quote enquiry JSON. Must be `https:`. |
| `QUOTE_BEARER_TOKEN` | optional | Sent as `Authorization: Bearer …` to that endpoint. Server-side only. |

Copy `.env.example` to `.env.local` for local configuration.

## Quote delivery

The form validates in the browser and again on the server. When `QUOTE_ENDPOINT_URL` is not configured the API returns `503`, and the form opens a prefilled email to the branded HF address rather than showing a fake success state.

Anti-abuse on the endpoint is a honeypot field, a minimum form dwell time measured on the client, and a per-IP / per-email request limiter.

> **Known limitation.** The limiter keeps its counters in process memory. Serverless instances do not share memory and are recycled, so the limit is best-effort — it blunts naive floods but is not durable abuse protection. Move it to a shared store (Upstash Redis or Vercel KV) before relying on it. See `isRateLimited` in `app/api/quote/route.ts`.

## Supplied facts and media

Business details and published pricing are centralized in `lib/site-data.ts`. Interstate rates live only in `interstatePricing`; route pages look them up by slug so the two cannot drift apart. The source JSON and CSV contained truncated currency values, so readable rates were transcribed from the supplied Markdown summary and project brief. The hero is a generated project asset based on the supplied HF logo and approved visual direction. The CEO section uses the supplied original portrait rather than an identity-altering generated replacement.

## Migration note

This site previously targeted Cloudflare Workers via `vinext` and OpenAI Sites hosting. That toolchain and its scaffolding have been removed; `app/` and `lib/` needed no changes, as they were already standard App Router code.
