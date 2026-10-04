import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { crewUpgradePackages, findMovingPackage, legacyPackages, localPricing, movingPackages, truckPackages, truckPricing } from "../lib/site-data.ts";
import { packageNameForCrewSize } from "../lib/booking/pricing.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

test("canonical package table holds the published local rates once, in cents", () => {
  assert.deepEqual(
    movingPackages.map(({ id, crewSize, ratePer30MinCents }) => ({ id, crewSize, ratePer30MinCents })),
    [
      { id: "hr-16t-2men", crewSize: 2, ratePer30MinCents: 7900 },
      { id: "mr-12t-2men", crewSize: 2, ratePer30MinCents: 7400 },
      { id: "small-8t-2men", crewSize: 2, ratePer30MinCents: 6900 },
      { id: "3-men", crewSize: 3, ratePer30MinCents: 9900 },
    ],
  );
  assert.deepEqual(
    legacyPackages.map(({ id, crewSize, ratePer30MinCents }) => ({ id, crewSize, ratePer30MinCents })),
    [{ id: "2-men", crewSize: 2, ratePer30MinCents: 7900 }],
  );
});

test("public display rows are derived from the package table", () => {
  assert.deepEqual(
    localPricing.map(({ id, name, halfHour, hourly, callout }) => ({ id, name, halfHour, hourly, callout })),
    [
      { id: "hr-16t-2men", name: "HR Truck", halfHour: "$79", hourly: "$158", callout: "$158" },
      { id: "mr-12t-2men", name: "MR Truck", halfHour: "$74", hourly: "$148", callout: "$148" },
      { id: "small-8t-2men", name: "Small Truck", halfHour: "$69", hourly: "$138", callout: "$138" },
      { id: "3-men", name: "3 Movers + Truck", halfHour: "$99", hourly: "$198", callout: "$198" },
    ],
  );
  assert.deepEqual(truckPricing.map((row) => row.id), truckPackages.map((item) => item.id));
});

test("package ids resolve to the same package; bare crew sizes resolve only unambiguously", () => {
  for (const item of movingPackages) assert.equal(findMovingPackage({ id: item.id }), item);
  assert.equal(findMovingPackage({ id: "2-men" }), legacyPackages[0]);
  // crewSize 2 is ambiguous among the trucks, so it falls back to the retired package.
  assert.equal(findMovingPackage({ crewSize: 2 }), legacyPackages[0]);
  assert.equal(findMovingPackage({ crewSize: 3 }), movingPackages.find((item) => item.id === "3-men"));
  assert.equal(packageNameForCrewSize(2), "2 Movers + Truck");
  assert.equal(packageNameForCrewSize(3), "3 Movers + Truck");
  assert.equal(findMovingPackage({ id: "4-men" }), undefined);
  assert.equal(findMovingPackage({ crewSize: Number.NaN }), undefined);
});

test("booking pricing_rules seeds match the published package rates (0001 legacy/3-men rows + 0015 truck rows)", async () => {
  const base = await read("supabase/migrations/0001_booking_system.sql");
  const seed = base.slice(base.indexOf("insert into pricing_rules"));
  for (const item of [...legacyPackages, ...crewUpgradePackages]) {
    assert.match(seed, new RegExp(`\\(\\s*${item.crewSize}\\s*,\\s*${item.ratePer30MinCents}\\s*,`), `0001 pricing_rules seed for crew ${item.crewSize}`);
  }
  const trucks = await read("supabase/migrations/0015_truck_packages.sql");
  const insert = trucks.slice(trucks.indexOf("insert into pricing_rules"));
  for (const item of truckPackages) {
    const row = new RegExp(`\\(\\s*'${item.id}'\\s*,\\s*'${item.truckClass}'\\s*,\\s*${item.tonnage}\\s*,\\s*${item.crewSize}\\s*,\\s*${item.ratePer30MinCents}\\s*,`);
    assert.match(insert, row, `0015 pricing_rules row for ${item.id}`);
  }
  assert.match(trucks, /update pricing_rules set package_id = '2-men'/);
  assert.match(trucks, /update pricing_rules set package_id = '3-men'/);
});

test("pricing UI and booking UI consume the package table instead of retyping rates", async () => {
  const wizard = stripComments(await read("app/book/BookingWizard.tsx"));
  const site = stripComments(await read("app/components/Site.tsx"));
  const client = stripComments(await read("app/components/SiteClient.tsx"));
  const serverPricing = stripComments(await read("lib/booking/pricing.ts"));

  assert.match(wizard, /truckPricing/);
  assert.match(wizard, /TruckPicker/);
  assert.doesNotMatch(wizard, /\$\s*\d{2,3}\b|\b(?:69|74|79|99)\s*\)?\s*\*\s*2/, "booking wizard must not hard-code rates");
  assert.doesNotMatch(wizard, /\d Men \+ Truck|HR Truck|MR Truck|Small Truck/, "booking wizard must not hard-code package names");
  assert.doesNotMatch(wizard, /JSON\.stringify\(\{[^}]*crewSize/, "booking requests must identify the package, not just a crew size");

  assert.match(site, /TruckCards/);
  assert.doesNotMatch(site, /startsWith\("3"\)/, "package IDs must not be inferred from display strings");
  assert.doesNotMatch(site, /\$(?:69|74|79|99)\b|\$1(?:38|48|58)\b/, "homepage components must not hard-code rates");

  assert.match(client, /findMovingPackage\(\{ id: packageId \}\)/);
  assert.match(client, /TruckPicker/);
  assert.doesNotMatch(client, /\d Men \+ Truck|\$\d{2,3}\b/, "quote form must not hard-code packages or rates");

  const picker = stripComments(await read("app/components/TruckPicker.tsx"));
  const cards = stripComments(await read("app/components/TruckChooser.tsx"));
  const sections = stripComments(await read("app/components/FleetSections.tsx"));
  for (const [file, source] of [["TruckPicker", picker], ["TruckChooser", cards], ["FleetSections", sections]]) {
    assert.doesNotMatch(source, /\$\s*\d{2,3}\b/, `${file} must not hard-code rates`);
  }
  assert.match(picker, /<fieldset/);
  assert.match(picker, /<legend/);
  assert.match(picker, /type="radio"/);

  assert.doesNotMatch(serverPricing, /return "\d Men \+ Truck"/, "server package names must come from the package table");
});

test("every package label in app and server code reads '<n> Movers + Truck' from the package table", async () => {
  for (const item of [...crewUpgradePackages, ...legacyPackages]) assert.match(item.name, /^\d Movers \+ Truck$/);
  for (const item of truckPackages) assert.match(item.name, /^(HR|MR|Small) Truck$/);
  const files = [
    "app/book/BookingWizard.tsx",
    "app/components/Site.tsx",
    "app/components/SiteClient.tsx",
    "app/admin/(protected)/calendar/CalendarClient.tsx",
    "lib/booking/pricing.ts",
    "lib/calendar-sync.ts",
    "lib/site-data.ts",
  ];
  for (const path of files) {
    const source = stripComments(await read(path));
    assert.doesNotMatch(source, /Men \+ Truck|bookingName/, `${path} must not carry the retired "Men + Truck" label`);
    if (path !== "lib/site-data.ts") assert.doesNotMatch(source, /["'`>]\s*\d Movers \+ Truck/, `${path} must not retype package labels`);
  }
});
