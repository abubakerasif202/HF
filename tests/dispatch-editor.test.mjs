import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import * as timezone from "../lib/booking/timezone.ts";
const require = createRequire(import.meta.url);
const source = readFileSync(new URL("../app/admin/(protected)/dispatch/DispatchEditor.tsx", import.meta.url), "utf8");
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const exports = {};
vm.runInNewContext(output, { exports, require: (id) => id.includes("timezone") ? timezone : require(id), FormData, Date });
const booking = { id: "job", starts_at: "2026-11-20T00:00:00.000Z", ends_at: "2026-11-20T02:00:00.000Z", dispatch_checklist: [{ id: "old", label: "Lift access", done: true }] };
function form() { const data = new FormData(); data.set("startsAt", "2026-11-20T10:30"); data.set("endsAt", "2026-11-20T12:30"); data.set("durationMinutes", "120"); return data; }
test("dispatch editor preserves unknown values and unchanged actual times", () => {
  const patch = exports.buildDispatchPatch(form(), booking, "Australia/Adelaide");
  assert.equal(patch.travelMinutes, null);
  assert.equal(patch.overnight, null);
  assert.equal(patch.truckLeftOnsite, null);
  assert.equal(patch.fixedPriceCents, null);
  assert.equal(patch.startsAt, undefined);
  assert.equal(patch.endsAt, undefined);
});
test("dispatch editor converts overnight occupancy in Adelaide and preserves checklist identity", () => {
  const data = form(); data.set("endsAt", "2026-11-21T08:30"); data.set("checklist", "Lift access\nKeys"); data.set("done-old", "on"); data.append("additionalVehicleIds", "truck-2"); data.set("fixedPrice", "123.45");
  const patch = exports.buildDispatchPatch(data, booking, "Australia/Adelaide");
  assert.equal(patch.endsAt, "2026-11-20T22:00:00.000Z");
  assert.equal(patch.startsAt, booking.starts_at);
  assert.equal(patch.checklist[0].id, "old");
  assert.equal(patch.checklist[0].done, true);
  assert.equal(patch.checklist[1].done, false);
  assert.equal(patch.additionalVehicleIds[0], "truck-2");
  assert.equal(patch.fixedPriceCents, 12345);
});
