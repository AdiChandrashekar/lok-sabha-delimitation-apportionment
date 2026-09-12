/* Writes test/snapshot.json from the shared scenario list.
   Run:  node scripts/make_snapshot.mjs

   Run this ONLY when you intend to change engine output, and record what moved
   in the commit message. test/run.js asserts against this file, so regenerating
   it casually defeats the point. */
import { readFileSync, writeFileSync } from "fs";
import { allocate } from "../js/apportion.js";
import { SCENARIOS } from "../test/scenarios.mjs";

const unitsDoc = JSON.parse(readFileSync(new URL("../data/units.json", import.meta.url)));
const units = unitsDoc.units;
const outPath = new URL("../test/snapshot.json", import.meta.url);

let prev = null;
try { prev = JSON.parse(readFileSync(outPath)); } catch { /* first run */ }

const scenarios = {};
for (const s of SCENARIOS) {
  const r = allocate(units, s.H, s.method, s.opts);
  scenarios[s.name] = {
    method: s.method, houseSize: s.H, opts: s.opts,
    infeasible: r.infeasible, reason: r.reason ?? null,
    absent: r.absent, total: r.seats ? Object.values(r.seats).reduce((a, b) => a + b, 0) : null,
    seats: r.seats,
  };
}

const doc = {
  $schema_version: "1.0",
  generated_by: "scripts/make_snapshot.mjs",
  purpose: "Regression fixture. test/run.js asserts every allocation below, so a refactor cannot silently change engine output.",
  data_fingerprint: {
    unit_count: units.length,
    current_seats: unitsDoc.totals.current_seats,
    population_2011: unitsDoc.totals.population_2011,
    note: "If this block changes, the data changed and the seat differences below are expected rather than a regression.",
  },
  scenarios,
};
writeFileSync(outPath, JSON.stringify(doc, null, 2) + "\n");

console.log(`Wrote ${Object.keys(scenarios).length} scenarios to test/snapshot.json`);
if (prev) {
  let moved = 0;
  for (const [name, cur] of Object.entries(scenarios)) {
    const was = prev.scenarios?.[name];
    if (!was) { console.log(`  NEW      ${name}`); continue; }
    const diffs = [];
    for (const code of new Set([...Object.keys(was.seats ?? {}), ...Object.keys(cur.seats ?? {})])) {
      const a = was.seats?.[code], b = cur.seats?.[code];
      if (a !== b) diffs.push(`${code} ${a}->${b}`);
    }
    if (diffs.length) { moved++; console.log(`  CHANGED  ${name}: ${diffs.join(", ")}`); }
  }
  if (!moved) console.log("  No allocation changed.");
} else {
  console.log("  No previous snapshot; nothing to compare.");
}
