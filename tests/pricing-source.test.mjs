import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { findMovingPackage, localPricing, movingPackages } from "../lib/site-data.ts";
import { packageNameForCrewSize } from "../lib/booking/pricing.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

test("canonical package table holds the published local rates once, in cents", () => {
  assert.deepEqual(
    movingPackages.map(({ id, crewSize, ratePer30MinCents }) => ({ id, crewSize, ratePer30MinCents })),
    [
      { id: "2-men", crewSize: 2, ratePer30MinCents: 7900 },
      { id: "3-men", crewSize: 3, ratePer30MinCents: 9900 },
    ],
  );
});

test("public display rows are derived from the package table", () => {
  assert.deepEqual(
    localPricing.map(({ id, name, halfHour, hourly, callout }) => ({ id, name, halfHour, hourly, callout })),
    [
      { id: "2-men", name: "2 Movers + Truck", halfHour: "$79", hourly: "$158", callout: "$158" },
      { id: "3-men", name: "3 Movers + Truck", halfHour: "$99", hourly: "$198", callout: "$198" },
    ],
  );
});

test("package IDs and crew sizes resolve to the same package", () => {
  for (const item of movingPackages) {
    assert.equal(findMovingPackage({ id: item.id }), item);
    assert.equal(findMovingPackage({ crewSize: item.crewSize }), item);
    assert.equal(packageNameForCrewSize(item.crewSize), item.bookingName);
  }
  assert.equal(findMovingPackage({ id: "4-men" }), undefined);
  assert.equal(findMovingPackage({ crewSize: Number.NaN }), undefined);
});

test("booking pricing_rules seed matches the published package rates", async () => {
  const sql = await read("supabase/migrations/0001_booking_system.sql");
  const seed = sql.slice(sql.indexOf("insert into pricing_rules"));
  for (const item of movingPackages) {
    assert.match(seed, new RegExp(`\\(\\s*${item.crewSize}\\s*,\\s*${item.ratePer30MinCents}\\s*,`), `pricing_rules seed for crew ${item.crewSize}`);
  }
});

test("pricing UI and booking UI consume the package table instead of retyping rates", async () => {
  const wizard = stripComments(await read("app/book/BookingWizard.tsx"));
  const site = stripComments(await read("app/components/Site.tsx"));
  const client = stripComments(await read("app/components/SiteClient.tsx"));
  const serverPricing = stripComments(await read("lib/booking/pricing.ts"));

  assert.match(wizard, /localPricing\.map/);
  assert.doesNotMatch(wizard, /\$\s*\d{2,3}\b|\b(?:79|99)\s*\)?\s*\*\s*2/, "booking wizard must not hard-code rates");
  assert.doesNotMatch(wizard, /\d Men \+ Truck/, "booking wizard must not hard-code package names");

  assert.match(site, /packageId=\{item\.id\}/);
  assert.doesNotMatch(site, /startsWith\("3"\)/, "package IDs must not be inferred from display strings");

  assert.match(client, /findMovingPackage\(\{ id: packageId \}\)/);
  assert.doesNotMatch(client, /\d Men \+ Truck|\$\d{2,3}\b/, "quote form must not hard-code packages or rates");

  assert.doesNotMatch(serverPricing, /return "\d Men \+ Truck"/, "server package names must come from the package table");
});
