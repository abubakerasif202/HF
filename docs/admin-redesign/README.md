# HF Private Operations — admin redesign (before / after)

All screenshots are rendered from the **real admin code** against the local mock-Supabase
harness (`audit/admin-visual/`) using clearly **synthetic fixture data** ("Sample Customer 01",
`@example.invalid`). No production data or credentials appear in these images. The "before" set was
captured from the unmodified code at `d8bd08c` (no screenshot was supplied separately).

| | Before | After |
|---|---|---|
| Dashboard 1440 | ![](before-dashboard-1440.webp) | ![](after-dashboard-1440-light.webp) |
| Dashboard dark | — | ![](after-dashboard-1440-dark.webp) |
| Dashboard 390 | ![](before-dashboard-390.webp) | ![](after-dashboard-390.webp) |
| Quote CRM | ![](before-quotes-1440.webp) | ![](after-quotes-1440.webp) |
| Quote detail drawer | — | ![](after-quotes-drawer-1440.webp) |
| Bookings | — | ![](after-bookings-1440.webp) |
| Calendar | — | ![](after-calendar-1440.webp) |
| Vehicles | — | ![](after-vehicles-1440.webp) |
| Pricing (dark) | — | ![](after-pricing-1440-dark.webp) |
| Login | — | ![](after-login-1440.webp) |

Reproduce: `node audit/admin-visual/run-app.mjs --rebuild` then `node audit/admin-visual/shoot.mjs <label> [--theme dark]`.
