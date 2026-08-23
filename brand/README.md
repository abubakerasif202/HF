# Brand originals

Supplied HF Removals Adelaide source artwork and photography.

These files sit **outside `public/`** deliberately: they are the high-resolution
masters used to derive the optimised assets that ship, and serving them would add
several megabytes to the deployed site for no user benefit.

| Master | Derived, shipped asset |
| --- | --- |
| `hf-logo-2026-source.png` (1254px) | `public/images/hf-logo-384.webp`, `public/favicon.ico`, `public/icon-96.png`, `public/apple-touch-icon.png` |
| `hf-logo-2026-800.webp` | superseded by `hf-logo-384.webp` |
| `hf-logo-source.jpg`, `hf-logo-transparent.png`, `hf-logo-header-mark.png` | previous logo generation, retained for reference |
| `muhammad-rasheed-original.jpeg` | `public/images/muhammad-rasheed-ceo.webp` |

Regenerate derived assets from the masters rather than editing `public/images/` by hand.
