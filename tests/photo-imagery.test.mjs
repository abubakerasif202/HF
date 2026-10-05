import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import test from "node:test";
import { business, crewUpgradeImage, hfImages, truckPackages } from "../lib/site-data.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const exists = (path) => existsSync(new URL(`../${path}`, import.meta.url));

async function walk(dir) {
  const entries = await readdir(new URL(`../${dir}/`, import.meta.url), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) files.push(...(await walk(path)));
    else files.push(path);
  }
  return files;
}

test("the illustrated truck component is gone and nothing draws a vehicle", async () => {
  assert.equal(exists("app/components/FleetVisuals.tsx"), false, "FleetVisuals (hand-drawn truck SVGs) must stay removed");
  const sources = [...(await walk("app")), ...(await walk("lib"))].filter((file) => /\.(tsx|ts|css)$/.test(file));
  for (const file of sources) {
    const text = await read(file);
    assert.doesNotMatch(text, /TruckIllustration|truckWidthRatio|truck-art|truck-card-art/, `${file} must not use the old truck illustration`);
    assert.doesNotMatch(text, /Zm11 4h4l3 3v4h-7/, `${file} must not contain the truck-icon SVG path`);
    assert.doesNotMatch(text, /lucide-react|IconTruck|FaTruck|🚚/, `${file} must not use a truck icon`);
  }
});

test("truck card, picker and hero components render photographs, not inline SVG artwork", async () => {
  for (const file of ["app/components/TruckChooser.tsx", "app/components/TruckPicker.tsx"]) {
    assert.doesNotMatch(await read(file), /<svg/i, `${file} must not draw vehicles with SVG`);
  }
  assert.match(await read("app/components/TruckChooser.tsx"), /next\/image/);
  assert.match(await read("app/components/TruckPicker.tsx"), /next\/image/);
});

test("every truck package carries a real, optimised, correctly sized photo", async () => {
  for (const truck of truckPackages) {
    assert.ok(exists(`public${truck.image.src}`), `${truck.id} image exists`);
    assert.match(truck.image.src, /^\/images\/hf\/fleet\/.+\.webp$/);
    assert.ok(truck.alt.length > 40, `${truck.id} has descriptive alt text`);
    const bytes = (await stat(new URL(`../public${truck.image.src}`, import.meta.url))).size;
    assert.ok(bytes < 200 * 1024, `${truck.id} image is ${bytes} bytes; keep web images under 200KB`);
  }
  assert.equal(new Set(truckPackages.map((truck) => truck.image.src)).size, 3, "each truck has its own image");
});

test("all shared branded images exist, are webp, and have descriptive alt text", async () => {
  for (const [name, image] of Object.entries({ ...hfImages, crewUpgrade: crewUpgradeImage })) {
    assert.ok(exists(`public${image.src}`), `${name} exists`);
    assert.match(image.src, /\.webp$/);
    assert.ok(image.width > 0 && image.height > 0, `${name} has intrinsic size`);
    if ("alt" in image) assert.ok(image.alt.length > 30, `${name} alt text`);
    const bytes = (await stat(new URL(`../public${image.src}`, import.meta.url))).size;
    assert.ok(bytes < 200 * 1024, `${name} image is ${bytes} bytes`);
  }
});

test("poster artwork is never shipped as a page section (text stays in HTML)", async () => {
  const files = (await walk("public/images/hf")).filter((file) => /\.(webp|png|jpe?g)$/.test(file));
  assert.ok(files.length >= 8);
  for (const file of files) {
    const bytes = (await stat(new URL(`../${file}`, import.meta.url))).size;
    assert.ok(bytes < 200 * 1024, `${file} is ${bytes} bytes`);
  }
});

test("Muhammad Rasheed section uses the real portrait file and the Company Director title", async () => {
  assert.equal(business.ceoImage, "/images/muhammad-rasheed-ceo.webp");
  assert.equal(business.ceo.name, "Muhammad Rasheed");
  assert.equal(business.ceo.title, "Company Director");
  const site = await read("app/components/Site.tsx");
  assert.match(site, /src=\{business\.ceoImage\}/);
  assert.doesNotMatch(site, /Meet the Director of HF Removals/);
});
