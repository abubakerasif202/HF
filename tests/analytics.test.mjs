import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("loads the configured GA4 property globally from the root layout", async () => {
  const envExample = await readFile(new URL("../.env.example", import.meta.url), "utf8");
  const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");

  assert.match(envExample, /^NEXT_PUBLIC_GA_ID=G-C1L7YK52TM$/m);
  assert.match(layout, /import Script from ["']next\/script["']/);
  assert.match(layout, /process\.env\.NEXT_PUBLIC_GA_ID/);
  assert.match(layout, /googletagmanager\.com\/gtag\/js\?id=\$\{gaId\}/);
  assert.match(layout, /gtag\(['"]config['"],\s*['"]\$\{gaId\}['"]\)/);
});
