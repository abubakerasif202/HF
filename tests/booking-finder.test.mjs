import assert from "node:assert/strict";
import test from "node:test";
import { buildFinderArgs, normalizeAuPhone, parseFinderQuery } from "../lib/booking-finder.ts";

const tz = "Australia/Adelaide";

test("Australian mobile numbers normalise from local, spaced and +61 forms", () => {
  for (const raw of ["0491 704 136", "0491-704-136", "(0491) 704 136", "+61 491 704 136", "+61491704136", "61491704136", "0061 491 704 136", "0491704136"]) {
    assert.equal(normalizeAuPhone(raw), "0491704136", raw);
  }
  assert.equal(normalizeAuPhone("(08) 8123 4567"), "0881234567");
  assert.equal(normalizeAuPhone("12"), null);
  assert.equal(normalizeAuPhone(null), null);
});

test("queries become a phone search, a reference search or word tokens", () => {
  assert.deepEqual(parseFinderQuery("+61 491 704 136"), { tokens: [], reference: null, phone: "0491704136" });
  assert.deepEqual(parseFinderQuery("0491 704"), { tokens: [], reference: null, phone: "0491704" });
  assert.deepEqual(parseFinderQuery("+61 491 70"), { tokens: [], reference: null, phone: "049170" }, "partial +61 numbers drop the country code");
  assert.deepEqual(parseFinderQuery("HF-2026-00042"), { tokens: ["hf-2026-00042"], reference: "HF202600042", phone: null });
  assert.deepEqual(parseFinderQuery("2026-00042"), { tokens: ["2026-00042"], reference: "202600042", phone: null }, "reference fragment is not a phone");
  assert.deepEqual(parseFinderQuery("  Sample   Customer 01 "), { tokens: ["sample", "customer", "01"], reference: "SAMPLECUSTOMER01", phone: null });
  assert.deepEqual(parseFinderQuery("John +61 491 704 136").tokens, ["john", "0491704136"]);
  assert.deepEqual(parseFinderQuery(""), { tokens: [], reference: null, phone: null });
  assert.deepEqual(parseFinderQuery("   "), { tokens: [], reference: null, phone: null });
  assert.equal(parseFinderQuery("a ".repeat(40)).tokens.length, 8, "token count is capped");
  assert.equal(parseFinderQuery("x".repeat(500)).tokens[0].length, 64);
});

test("filters validate and convert Adelaide days to exact instants, DST included", () => {
  const ok = buildFinderArgs({ q: "salisbury", from: "2026-11-20", to: "2026-11-20", status: "confirmed", crewId: "c0000000-0000-4000-8000-00000000000a", page: 2, pageSize: 10 }, tz);
  assert.equal(ok.ok, true);
  // 20 Nov is ACDT (+10:30): local midnight is 13:30Z the previous day.
  assert.equal(ok.args.p_from, "2026-11-19T13:30:00.000Z");
  assert.equal(ok.args.p_to, "2026-11-20T13:30:00.000Z");
  assert.deepEqual([ok.args.p_limit, ok.args.p_offset, ok.args.p_status], [10, 10, "confirmed"]);
  // 2026-04-05: ACDT -> ACST (25-hour local day). to is the next local midnight, not +24h.
  const dst = buildFinderArgs({ from: "2026-04-05", to: "2026-04-05" }, tz);
  assert.equal(dst.args.p_from, "2026-04-04T13:30:00.000Z");
  assert.equal(dst.args.p_to, "2026-04-05T14:30:00.000Z");
  // 2026-10-04: ACST -> ACDT (23-hour day).
  const spring = buildFinderArgs({ from: "2026-10-04", to: "2026-10-04" }, tz);
  assert.equal(spring.args.p_from, "2026-10-03T14:30:00.000Z");
  assert.equal(spring.args.p_to, "2026-10-04T13:30:00.000Z");
});

test("invalid filters are rejected rather than ignored", () => {
  for (const filters of [
    { from: "20-11-2026" }, { to: "2026-02-30" }, { from: "2026-11-21", to: "2026-11-20" }, { status: "bogus" },
    { crewId: "not-a-uuid" }, { vehicleId: "1" }, { page: 5000 },
  ]) assert.equal(buildFinderArgs(filters, tz).ok, false, JSON.stringify(filters));
  const defaults = buildFinderArgs({ page: -3, pageSize: 9999 }, tz);
  assert.deepEqual([defaults.page, defaults.pageSize], [1, 50]);
});
