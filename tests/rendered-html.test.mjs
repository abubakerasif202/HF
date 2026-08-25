import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import test, { after, before } from "node:test";

const port = 31_487;
const baseUrl = `http://127.0.0.1:${port}`;
let server;

before(async () => {
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd: new URL("..", import.meta.url),
    env: { ...process.env, NODE_ENV: "production" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let startupError = "";
  server.stderr.on("data", (chunk) => { startupError += chunk; });
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`Next.js exited during startup: ${startupError}`);
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Next.js did not start: ${startupError}`);
});

after(() => {
  server?.kill("SIGTERM");
});

async function render(path = "/", init = {}) {
  return fetch(`${baseUrl}${path}`, { headers: { accept: "text/html", ...(init.headers ?? {}) }, ...init });
}

test("renders the premium HF homepage without placeholder claims", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Adelaide[\s\S]*Removalists[\s\S]*You Can[\s\S]*Rely On/i);
  assert.match(html, /Tell us about your move/i);
  assert.match(html, /Muhammad Rasheed/i);
  // Brand lockup ships as the right-sized derivative, not the 419KB 800px master.
  assert.match(html, /hf-logo-384\.webp/i);
  assert.doesNotMatch(html, /hf-logo-2026(-source)?\.(webp|png)/i);
  assert.match(html, /muhammad-rasheed-ceo\.webp/i);
  assert.match(html, /hf-residential-premium\.webp/i);
  assert.match(html, /hf-packing-premium\.webp/i);
  assert.match(html, /hf-office-premium\.webp/i);
  assert.match(html, /hf-interstate-premium\.webp/i);
  assert.match(html, /hf-apartment-removals\.webp/i);
  assert.match(html, /hf-hero-mobile-480\.webp/i);
  assert.match(html, /hf-hero-mobile-768\.webp/i);
  assert.match(html, /Work in Motion/i);
  assert.match(html, /\$79/);
  assert.match(html, /\$119\.43/);
  assert.match(html, /4\.9 Google rating/i);
  assert.match(html, /417(?:<!-- -->)? reviews/i);
  assert.match(html, /Open 24 Hours/i);
  assert.match(html, /25–45 m³/i);
  assert.match(html, /40–60 m³/i);
  // The 4.9/417 figures are Google's, not reviews this site collects, so they must
  // not be marked up as first-party aggregateRating on the LocalBusiness node.
  assert.doesNotMatch(html, /AggregateRating|"ratingValue"/);
  assert.doesNotMatch(html, /"@type":"Review"/);
  // ...while the visible, Google-attributed section is unchanged.
  assert.match(html, /Read all reviews on Google/i);
  assert.match(html, /maps\.google\.com/);
  assert.match(html, /application\/ld\+json/);
  assert.match(html, /<title>Adelaide Removalists \| 4\.9★ Rated Local &amp; Interstate \| HF Removals<\/title>/i);
  assert.doesNotMatch(html, /HF Removals Adelaide \| HF Removals Adelaide<\/title>/i);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|5\.0 from|200\+ happy|#1 Adelaide|award.winning/i);
  assert.doesNotMatch(html, /Hamza Khan|Jessica Taylor|David Miller|Sarah Jenkins/i);
  assert.match(html, /Mishaal/i);
  assert.match(html, /Max Lazzaris/i);
  assert.match(html, /Ayan Ali/i);
  assert.match(html, /shagun sharma/i);
  assert.match(html, /Muhammad and the team at HF Removals provided an exceptional house moving service/i);
  assert.match(html, /Verified visible excerpt/i);
});

test("renders service, area, route, guide and contact routes", async () => {
  const paths = [
    ["/services/residential-removals", /A clear plan for moving home/i],
    ["/areas/salisbury", /Coordinate homes, units and workplaces/i],
    ["/interstate/adelaide-perth", /\$186\.06/i],
    ["/guides/office-relocation-checklist", /Office Relocation Checklist/i],
    ["/contact", /Talk to HF Removals Adelaide/i],
  ];
  for (const [path, pattern] of paths) {
    const response = await render(path);
    assert.equal(response.status, 200, path);
    assert.match(await response.text(), pattern, path);
  }

  const about = await render("/about");
  assert.match(await about.text(), /<title>About \| HF Removals Adelaide<\/title>/i);

  const contact = await render("/contact");
  const contactHtml = await contact.text();
  assert.match(contactHtml, /Google Map showing HF Removals Adelaide/i);
  assert.match(contactHtml, /4v1787515237189/i);
  assert.match(contactHtml, /referrerpolicy="strict-origin-when-cross-origin"/i);
  assert.match(contactHtml, /6MW7\+J5 Elizabeth Vale/i);
  assert.match(contactHtml, /loading="lazy"/i);
  assert.match(contactHtml, /Get directions/i);

  const service = await render("/services/residential-removals");
  assert.doesNotMatch(await service.text(), /FAQPage/);
});

test("serves crawl discovery endpoints and unique guide metadata", async () => {
  const robots = await render("/robots.txt");
  assert.equal(robots.status, 200);
  assert.match(robots.headers.get("content-type") ?? "", /text\/plain/);
  assert.match(await robots.text(), /Sitemap: https:\/\/www\.hfremovalsadelaide\.com\.au\/sitemap\.xml/);

  const sitemap = await render("/sitemap.xml");
  assert.equal(sitemap.status, 200);
  assert.match(sitemap.headers.get("content-type") ?? "", /xml/);
  assert.match(await sitemap.text(), /https:\/\/www\.hfremovalsadelaide\.com\.au\/services\/residential-removals/);

  const guide = await render("/guides/office-relocation-checklist");
  const html = await guide.text();
  assert.match(html, /<title>Office Relocation Checklist \| HF Removals Adelaide<\/title>/i);
  assert.doesNotMatch(html, /href="\/(?:services|areas|pricing|about|contact|guides|interstate|privacy|terms)[^"]*\/"/i);
});

test("renders one coherent, accessible Web3Forms quote flow", async () => {
  for (const path of ["/", "/contact"]) {
    const response = await render(path);
    assert.equal(response.status, 200, path);
    const html = await response.text();

    assert.match(html, /<form[^>]+action="https:\/\/api\.web3forms\.com\/submit"[^>]+method="POST"/i, path);
    assert.match(html, /name="subject"[^>]+value="New HF Removals Adelaide Quote Request"/i, path);
    assert.match(html, /name="from_name"[^>]+value="HF Removals Adelaide Website"/i, path);
    assert.match(html, /name="source_page"/i, path);
    assert.match(html, /<input(?=[^>]*name="_gotcha")(?=[^>]*tabindex="-1")[^>]*>/i, path);
    for (const field of ["name", "phone", "email", "moving_from", "moving_to", "move_type", "moving_package", "property_size", "preferred_moving_date", "details"]) {
      assert.match(html, new RegExp(`name="${field}"`, "i"), `${path}: ${field}`);
    }
    assert.match(html, /name="moving_package"[^>]+value="2 Men \+ Truck"/i, path);
    assert.match(html, /name="moving_package"[^>]+value="3 Men \+ Truck"/i, path);
  }

  const client = await readFile(new URL("../app/components/SiteClient.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(client, /fetch\(["']\/api\/quote/i);
  assert.match(client, /formData\.append\("access_key", web3FormsAccessKey\)/i);
  assert.match(client, /data\.success/i);
  assert.doesNotMatch(client, /formspree\.io|formsubmit\.co/i);
});

test("keeps verified rates, coverage wording and canonical route inventory centralized", async () => {
  const data = await readFile(new URL("../lib/site-data.ts", import.meta.url), "utf8");
  assert.match(data, /\$79/);
  assert.match(data, /\$99/);
  assert.match(data, /\$119\.43/);
  assert.match(data, /\$186\.06/);
  assert.match(data, /per m³/);
  assert.match(data, /Up to \$1,000,000 Public Liability & Transit Insurance/);
  assert.match(data, /rating: 4\.9/);
  assert.match(data, /reviewCount: 417/);
  assert.match(data, /verifiedAt: "2026-08-21"/);
  assert.match(data, /Complimentary mattress protection/);
  assert.doesNotMatch(data, /five-star|fully insured|no hidden fees|on-time every time/i);
  // Review excerpts belong with the other supplied business facts, not inside a component.
  assert.match(data, /export const googleReviews/);
  const site = await readFile(new URL("../app/components/Site.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(site, /const reviews = \[/);
  assert.match(site, /googleReviews\.map/);
  // Rating and count come from site-data, never retyped in components.
  const client = await readFile(new URL("../app/components/SiteClient.tsx", import.meta.url), "utf8");
  const home = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  for (const [label, source] of [["Site", site], ["SiteClient", client], ["page", home]]) {
    assert.doesNotMatch(stripComments(source), /4\.9|417/, `${label} should read the rating from site-data`);
  }
  // Local rates likewise: they were retyped in the trust strip, the quote form
  // banner and the homepage meta description.
  assert.match(data, /export const entryLocalRate/);
  for (const [label, source] of [["Site", site], ["SiteClient", client], ["page", home]]) {
    assert.doesNotMatch(stripComments(source), /\$\d{2,3}\s*\/\s*30 min|\$\d{2,3}\/30min/, `${label} should read rates from site-data`);
  }
});

async function builtCss() {
  const html = await (await render()).text();
  const hrefs = [...html.matchAll(/href="(\/_next\/static\/[^"]+\.css)"/g)].map((m) => m[1]);
  assert.ok(hrefs.length > 0, "expected at least one built stylesheet");
  const sheets = await Promise.all(hrefs.map(async (href) => (await fetch(`${baseUrl}${href}`)).text()));
  return sheets.join("\n");
}

test("quote fieldsets can shrink instead of overflowing narrow viewports", async () => {
  const css = await builtCss();
  // <fieldset> defaults to min-inline-size:min-content, so the optional-details grid
  // pushed ~32px past a 320px viewport. It was only invisible because an ancestor
  // clips overflow-x, which hid the symptom rather than fixing it.
  assert.match(css, /\.form-grid\{[^}]*min-width:0/);
  assert.match(css, /\.form-grid>label[^{]*\{[^}]*min-width:0/);
  // and the two-column field grid collapses to one column on small screens
  assert.match(css, /@media[^{]*max-width:\s*430px[^{]*\{[^}]*\.form-grid\{grid-template-columns:1fr\}/);
});

test("mobile menu contains its own scrolling", async () => {
  const css = await builtCss();
  assert.match(css, /\.mobile-menu\{[^}]*overflow-y:auto/);
  assert.match(css, /\.mobile-menu\{[^}]*overscroll-behavior:contain/);
});

test("ships HF-branded icons rather than the starter glyph", async () => {
  const html = await (await render()).text();
  assert.match(html, /rel="icon" href="\/favicon\.ico"/);
  assert.match(html, /rel="apple-touch-icon" href="\/apple-touch-icon\.png"/);
  assert.doesNotMatch(html, /favicon\.svg/);
  for (const [path, type] of [["/favicon.ico", /icon|image/], ["/icon-96.png", /image\/png/], ["/apple-touch-icon.png", /image\/png/]]) {
    const response = await fetch(`${baseUrl}${path}`);
    assert.equal(response.status, 200, path);
    assert.match(response.headers.get("content-type") ?? "", type, path);
  }
});

test("does not serve unreferenced starter or master assets", async () => {
  for (const path of ["/og.png", "/file.svg", "/globe.svg", "/window.svg", "/favicon.svg",
                      "/images/hf-logo-2026-source.png", "/images/hf-logo-source.jpg",
                      "/images/hf-logo-transparent.png", "/images/muhammad-rasheed-original.jpeg"]) {
    const response = await fetch(`${baseUrl}${path}`);
    assert.equal(response.status, 404, `${path} should not be served`);
  }
  // the assets actually referenced still resolve
  for (const path of ["/og.webp", "/images/hf-logo-384.webp"]) {
    assert.equal((await fetch(`${baseUrl}${path}`)).status, 200, path);
  }
});

test("move-type chooser uses valid ARIA for a two-option choice", async () => {
  const html = await (await render()).text();
  assert.match(html, /role="radiogroup"/);
  assert.match(html, /role="radio"[^>]*aria-checked/);
  // role="tab" without tabpanels/aria-controls/arrow-key handling was invalid ARIA
  assert.doesNotMatch(html, /class="form-tabs" role="tablist"/);
  assert.doesNotMatch(html, /role="tab"[^>]*aria-selected/);
});

test("the 404 page is not indexable", async () => {
  const response = await render("/definitely-not-a-real-page");
  assert.equal(response.status, 404);
  assert.match(await response.text(), /name="robots" content="noindex/);
});

test("the production origin is declared once and drives canonical output", async () => {
  const data = await readFile(new URL("../lib/site-data.ts", import.meta.url), "utf8");
  assert.match(data, /export const siteOrigin = "https:\/\/www\.hfremovalsadelaide\.com\.au"/);
  assert.match(data, /export const quoteFormEndpoint = "https:\/\/api\.web3forms\.com\/submit"/);
  assert.match(data, /export const web3FormsAccessKey = "a6214fc2-9669-49a0-abf4-4f8bd77c3f88"/);
  const html = await (await render()).text();
  assert.match(html, /rel="canonical" href="https:\/\/www\.hfremovalsadelaide\.com\.au"/);
  assert.match(html, /property="og:url" content="https:\/\/www\.hfremovalsadelaide\.com\.au"/);
  const client = await readFile(new URL("../app/components/SiteClient.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(client, /hf-removals-adelaide\.vercel\.app|hfremovalsadelaide\.com(?!\.au)/);
});

test("the duplicate .com hostname is configured to redirect to the canonical .com.au URL", async () => {
  const config = await readFile(new URL("../next.config.ts", import.meta.url), "utf8");
  assert.match(config, /type: "host", value: "www\.hfremovalsadelaide\.com"/);
  assert.match(config, /destination: "https:\/\/www\.hfremovalsadelaide\.com\.au\/:path\*"/);
  assert.match(config, /permanent: true/);
});

test("high-intent pricing surfaces expose the ruby package hierarchy", async () => {
  const html = await (await render()).text();
  assert.match(html, /price-card price-card--popular/);
  assert.match(html, /price-popular-badge[^>]*>Most Popular/);
  assert.match(html, /package-option package-option--popular/);
  assert.match(html, /package-popular[^>]*>Popular/);
  const css = await builtCss();
  assert.match(css, /\.price-card--popular\{/);
  assert.match(css, /\.package-option:has\(input:checked\)\{/);
  assert.match(css, /\.route-cost strong\{color:var\(--ruby-light\)/);
});

test("layout grids declare a track for every child they render", async () => {
  const css = await builtCss();
  // .detail-bars rows render span + i + strong + b. Only three tracks were declared,
  // so the label was auto-placed into the 6px track and overflowed every detail page.
  assert.match(css, /\.detail-bars>div\{[^}]*grid-template-columns:32px 28px minmax\(0,1fr\) 6px/);
  assert.match(css, /\.detail-bars i\{/);
  assert.match(css, /\.detail-bars strong\{[^}]*min-width:0/);
  // grid/flex children that hold unbreakable content must be allowed to shrink
  assert.match(css, /\.packing-grid>\*\{min-width:0\}/);
  assert.match(css, /\.insurance-panel\{[^}]*container-type:inline-size/);
  assert.match(css, /\.insurance-panel>strong em\{[^}]*font-size:clamp\(2rem,13cqi,5\.2rem\)/);
});


test("the 3D fleet viewer is fully removed", async () => {
  const html = await (await render()).text();
  assert.doesNotMatch(html, /three-section|three-viewport|three-loader|hotspot-/);
  const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.ok(!pkg.dependencies.three, "three should not be a dependency");
  assert.ok(!pkg.devDependencies["@types/three"], "@types/three should not be a devDependency");
});
