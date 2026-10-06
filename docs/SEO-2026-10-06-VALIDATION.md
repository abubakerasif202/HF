# HF SEO validation, 6 October 2026

## Final local checks

- `npm test`: production build generated 173 static pages; **221 passed, 0 failed, 0 skipped** on the final source, including responsive image delivery changes.
- `npm run lint`: passed. `npm run typecheck`: passed. Existing installed dependencies were used; package manifests and lockfile edits belonging to earlier work were preserved and excluded from this commit.
- Existing Playwright suite: **36 passed**, including quote validation, package selection, mocked provider success/failure, duplicate-submit guard, menu focus and responsive layouts. The 221-test suite also covers mocked quote timeout handling. The 36-test suite ran after the commercial SEO edits; the later booking-heading/telephone and image fixes received a fresh production build/full 221-test run and targeted browser checks below.
- Final comprehensive runtime harness: **168 sitemap URLs** passed HTTP 200, canonical, title/description, single H1, JSON-LD parseability, indexability and image-alt checks. Zero duplicate metadata, broken internal URLs or orphan pages. Robots/sitemap, utility noindex, query canonical and genuine 404 assertions passed.
- **63 responsive checks** across nine representative routes at 320, 375, 390, 430, 768, 1440 and 1920px: no overflow, broken images, console/page errors, incorrect H1 counts or missing phone links. Includes the corrected booking page. This full matrix preceded only the subsequent four-card image-delivery optimization.
- Final image build: **7 additional homepage viewport checks passed** at the same widths. All four optimized service-card images returned 200 and loaded fully, with no overflow or console errors. Combined requested image bytes fell from 657,854 to 65,166 at six tested widths and 150,251 at 430px: **77.2–90.1% less transfer**. Mobile/desktop card screenshots were visually inspected; source photos, crops and layout are retained. This is standard-DPR browser/request evidence, not real-user CWV measurement. Details: `audit/2026-10-06/image-verification.json`.
- Code review approved the SEO, booking semantics, image optimization and runtime-harness changes; no remaining findings. `git diff --check` passed before release.

## Evidence and corrections

`audit/2026-10-06/verify.mjs` is the repeatable, GET-only verification harness. Local evidence is saved in `runtime.json`, `runtime-initial.json`, browser findings and screenshots. No lead, appointment, booking, payment or inventory mutation was performed by the runtime harness. Existing quote tests use mocked Web3Forms responses; real inbox delivery was not tested.

An initial test run had one stale-build homepage-description assertion after metadata was edited during compilation. A fresh build resolved it; subsequent complete runs passed. The initial strict browser audit identified duplicate booking H1s and absent booking telephone links; the source was corrected and the full matrix passed with strict gates restored. Initial observations are retained separately.

Slow-scroll screenshot inspection revealed four oversized source requests and led to responsive image optimization. Some fullpage screenshots show browser compositor/sticky-header artifacts; normal viewport captures and DOM checks confirm one header/main/footer and visible scroll-reveal content. Screenshots are not used to claim duplicate HTML or real-user performance.

The first targeted image verifier also selected an unrelated reused apartment image and failed its four-card count gate. The selector was corrected to the actual card grid and rerun with a fresh page per width; the final seven checks passed. The pre-existing baseline audit tool refreshed its generated `audit/seo/validation-results.json`; generated older audit outputs and unrelated package changes were excluded from the release.

## Release and remaining limits

The release SHA, remote verification, CI/deployment status and live probes are reported separately after committing/pushing. A successful local build is not production deployment evidence.

HTTPS apex/legacy/trailing-slash redirects were verified permanent and direct with query preservation; HTTP still receives an earlier Vercel same-host HTTPS upgrade. No redirect configuration was changed. This platform limitation and GSC indexing/canonical follow-ups are documented in `SEO-2026-10-06-AUDIT.md`.

No real-user Core Web Vitals, Google-selected canonical, recent query-by-date comparison or live form inbox delivery is claimed. Existing location-template repetition remains an editorial opportunity requiring verified useful locality evidence; no ranking URLs were removed or deindexed.
