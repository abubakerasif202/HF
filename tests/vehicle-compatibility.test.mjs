import assert from "node:assert/strict";
import test from "node:test";
import { compatibleVehicleIds } from "../lib/booking/vehicles.ts";
import { pickFreeVehicle, resolveSlotState } from "../lib/booking/availability.ts";
import { entryLocalRate, truckClassForVehicleType } from "../lib/site-data.ts";

const HR_ID = "hr-16t-2men";
const MR_ID = "mr-12t-2men";
const SMALL_ID = "small-8t-2men";

const fleet = [
  { id: "hr-a", vehicleType: "HR" },
  { id: "hr-b", vehicleType: "HR Truck" },
  { id: "hr-c", vehicleType: "16 ton" },
  { id: "mr-a", vehicleType: "MR" },
  { id: "mr-b", vehicleType: "12t" },
  { id: "small-a", vehicleType: "Small" },
  { id: "small-b", vehicleType: "Small Truck 8 ton" },
  { id: "untyped", vehicleType: null },
  { id: "blank", vehicleType: "  " },
  { id: "unknown", vehicleType: "Ute" },
];

test("truckClassForVehicleType parsing table", () => {
  const table = [
    ["HR", "HR"],
    ["hr", "HR"],
    ["HR Truck", "HR"],
    ["16 ton", "HR"],
    ["16t", "HR"],
    ["16 Ton Truck", "HR"],
    ["MR", "MR"],
    ["MR Truck", "MR"],
    ["12 ton", "MR"],
    ["12t", "MR"],
    ["Small", "Small"],
    ["Small Truck", "Small"],
    ["8 ton", "Small"],
    ["8t", "Small"],
    ["  small  ", "Small"],
    ["Ute", null],
    ["Van", null],
    ["Truck", null],
    ["", null],
    ["   ", null],
    [null, null],
    [undefined, null],
    ["18 ton", null],
    ["shr", null],
  ];
  for (const [input, expected] of table) assert.equal(truckClassForVehicleType(input), expected, `type ${JSON.stringify(input)}`);
});

test("HR package matches only HR-typed vehicles", () => {
  assert.deepEqual(compatibleVehicleIds(HR_ID, fleet), ["hr-a", "hr-b", "hr-c"]);
});

test("MR package matches only MR-typed vehicles", () => {
  assert.deepEqual(compatibleVehicleIds(MR_ID, fleet), ["mr-a", "mr-b"]);
});

test("Small package matches only Small-typed vehicles", () => {
  assert.deepEqual(compatibleVehicleIds(SMALL_ID, fleet), ["small-a", "small-b"]);
});

test("untyped or unknown vehicles never match a truck package", () => {
  const onlyUnclassified = [
    { id: "untyped", vehicleType: null },
    { id: "blank", vehicleType: "" },
    { id: "unknown", vehicleType: "Ute" },
  ];
  for (const id of [HR_ID, MR_ID, SMALL_ID]) assert.deepEqual(compatibleVehicleIds(id, onlyUnclassified), []);
});

test("3-men crew upgrade and null/legacy/unknown package match every vehicle", () => {
  const all = fleet.map((vehicle) => vehicle.id);
  assert.deepEqual(compatibleVehicleIds("3-men", fleet), all);
  assert.deepEqual(compatibleVehicleIds("2-men", fleet), all);
  assert.deepEqual(compatibleVehicleIds(null, fleet), all);
  assert.deepEqual(compatibleVehicleIds(undefined, fleet), all);
  assert.deepEqual(compatibleVehicleIds("no-such-package", fleet), all);
});

test("result is empty when no vehicle is compatible", () => {
  const smallOnly = [{ id: "small-a", vehicleType: "Small" }];
  assert.deepEqual(compatibleVehicleIds(HR_ID, smallOnly), []);
  assert.deepEqual(compatibleVehicleIds(HR_ID, []), []);
  assert.deepEqual(compatibleVehicleIds(null, []), []);
});

test("entryLocalRate is the cheapest truck (Small, $69)", () => {
  assert.equal(entryLocalRate.id, SMALL_ID);
  assert.equal(entryLocalRate.halfHour, "$69");
});

test("double-booking: pickFreeVehicle over compatible vehicles respects busy intervals", () => {
  const slot = { startsAt: new Date("2026-03-10T01:00:00Z"), endsAt: new Date("2026-03-10T03:00:00Z") };
  const smallIds = compatibleVehicleIds(SMALL_ID, fleet); // small-a, small-b
  const overlapping = (vehicleId) => ({ vehicleId, startsAt: new Date("2026-03-10T00:30:00Z"), endsAt: new Date("2026-03-10T02:00:00Z") });

  assert.equal(pickFreeVehicle(slot, smallIds, [], []), "small-a");
  assert.equal(pickFreeVehicle(slot, smallIds, [overlapping("small-a")], []), "small-b");
  assert.equal(pickFreeVehicle(slot, smallIds, [overlapping("small-a"), overlapping("small-b")], []), null);
  // A busy HR truck does not free up or block a Small booking, and vice versa.
  assert.equal(pickFreeVehicle(slot, smallIds, [overlapping("hr-a")], []), "small-a");
});

test("double-booking: an empty compatible set is never assignable or available", () => {
  const slot = { startsAt: new Date("2026-03-10T01:00:00Z"), endsAt: new Date("2026-03-10T03:00:00Z") };
  const none = compatibleVehicleIds(HR_ID, [{ id: "small-a", vehicleType: "Small" }]);
  assert.equal(pickFreeVehicle(slot, none, [], []), null);
  assert.equal(resolveSlotState(slot, none, [], []), "unavailable");
});

test("double-booking: a back-to-back slot is free but a blocked_time still blocks a compatible vehicle", () => {
  const ids = compatibleVehicleIds(MR_ID, fleet); // mr-a, mr-b
  const slot = { startsAt: new Date("2026-03-10T02:00:00Z"), endsAt: new Date("2026-03-10T04:00:00Z") };
  const busy = [{ vehicleId: "mr-a", startsAt: new Date("2026-03-10T00:00:00Z"), endsAt: new Date("2026-03-10T02:00:00Z") }];
  assert.equal(pickFreeVehicle(slot, ids, busy, []), "mr-a");
  const blocked = [{ vehicleId: "mr-a", startsAt: new Date("2026-03-10T01:00:00Z"), endsAt: new Date("2026-03-10T03:00:00Z") }];
  assert.equal(pickFreeVehicle(slot, ids, busy, blocked), "mr-b");
});
