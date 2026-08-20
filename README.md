# HF Removals Adelaide

Premium multi-route website for HF Removals Adelaide, built with vinext for OpenAI Sites hosting.

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

The form validates in the browser and again on the server. Set `QUOTE_ENDPOINT_URL` to a server-side lead endpoint that accepts JSON. `QUOTE_BEARER_TOKEN` is optional and remains server-side. When no endpoint is configured, the form opens a prefilled email to the branded HF address instead of displaying a fake success state.

Copy `.env.example` to `.env.local` for local configuration. Hosted values are managed through Sites environment settings.

## Supplied facts and media

Business details and published pricing are centralized in `lib/site-data.ts`. The source JSON and CSV contained truncated currency values, so readable rates were transcribed from the supplied Markdown summary and project brief. The hero is a generated project asset based on the supplied HF logo and approved visual direction. The CEO section uses the supplied original portrait rather than an identity-altering generated replacement.
