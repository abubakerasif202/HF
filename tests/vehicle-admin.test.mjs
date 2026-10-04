import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { KEEP_CURRENT_TYPE, UNCLASSIFIED_WARNING, VEHICLE_TYPE_OPTIONS, parseVehicleTypeInput } from "../app/admin/(protected)/vehicles/vehicleTypes.ts";
import { TRUCK_UNAVAILABLE_MESSAGE, truckClassForVehicleType } from "../lib/site-data.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("vehicle type options are HR 16 Ton, MR 12 Ton, Small 8 Ton", () => {
  assert.deepEqual(
    VEHICLE_TYPE_OPTIONS.map(({ value, label }) => [value, label]),
    [["HR", "HR — 16 Ton"], ["MR", "MR — 12 Ton"], ["Small", "Small — 8 Ton"]],
  );
});

test("parseVehicleTypeInput accepts a class or unclassified and rejects anything else", () => {
  assert.deepEqual(parseVehicleTypeInput("HR"), { ok: true, vehicleType: "HR", unchanged: false });
  assert.deepEqual(parseVehicleTypeInput("MR"), { ok: true, vehicleType: "MR", unchanged: false });
  assert.deepEqual(parseVehicleTypeInput("Small"), { ok: true, vehicleType: "Small", unchanged: false });
  assert.deepEqual(parseVehicleTypeInput(""), { ok: true, vehicleType: null, unchanged: false });
  for (const bad of ["Pantech", "hr", "16 ton", "Truck", "' or 1=1 --"]) {
    assert.equal(parseVehicleTypeInput(bad).ok, false, `${bad} must be rejected`);
  }
});

test("keeping the current type leaves the stored value untouched", () => {
  assert.deepEqual(parseVehicleTypeInput(KEEP_CURRENT_TYPE), { ok: true, vehicleType: null, unchanged: true });
});

test("a legacy free-text type such as Pantech is never silently mapped to a class", () => {
  assert.equal(truckClassForVehicleType("Pantech"), null);
  assert.equal(truckClassForVehicleType("Pantech 12 tonne"), "MR", "only an explicit tonnage is recognised");
});

test("edit action validates name and type server-side and never rewrites history", async () => {
  const actions = await read("app/admin/(protected)/vehicles/actions.ts");
  assert.match(actions, /export async function updateVehicleAction/);
  assert.match(actions, /requireStaff\(\)/);
  assert.match(actions, /parseVehicleTypeInput/);
  assert.match(actions, /if \(!type\.unchanged\) update\.vehicle_type/);
  assert.doesNotMatch(actions, /from\("bookings"\)/, "editing a vehicle must not touch bookings");
});

test("admin vehicles page warns about every unclassified active vehicle", async () => {
  const page = await read("app/admin/(protected)/vehicles/page.tsx");
  assert.equal(UNCLASSIFIED_WARNING, "Vehicle class required for online truck-specific booking.");
  assert.match(page, /UNCLASSIFIED_WARNING/);
  assert.match(page, /updateVehicleAction/);
  assert.match(page, /activeUnclassified/);
});

test("customer-facing unavailable message is polished and exposes no configuration language", () => {
  assert.equal(TRUCK_UNAVAILABLE_MESSAGE, "This truck is currently unavailable for online booking. Please call 0491 704 136 or choose another truck.");
  assert.doesNotMatch(TRUCK_UNAVAILABLE_MESSAGE, /database|vehicle_type|admin|configure|class/i);
});

test("wizard and hold API use the customer-safe message; fleet endpoint leaks no vehicle details", async () => {
  const wizard = await read("app/book/BookingWizard.tsx");
  const hold = await read("app/api/booking/hold/route.ts");
  const fleet = await read("app/api/booking/fleet/route.ts");
  assert.match(wizard, /TRUCK_UNAVAILABLE_MESSAGE/);
  assert.match(hold, /jsonError\(503, TRUCK_UNAVAILABLE_MESSAGE/);
  assert.doesNotMatch(hold, /an admin must|configured yet/i, "no configuration language reaches customers");
  assert.match(fleet, /unavailablePackageIds/);
  assert.doesNotMatch(fleet, /vehicle_type|vehicleType:|\.name\b.*vehicle/);
});
