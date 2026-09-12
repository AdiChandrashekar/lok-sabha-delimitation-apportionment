/* Plain Node test runner. No framework. Run with: node test/run.js */
import { readFileSync } from "fs";
import { allocate, METHODS, quotaViolations, largestRemainder } from "../js/apportion.js";
import { SCENARIOS } from "./scenarios.mjs";

const unitsDoc = JSON.parse(readFileSync(new URL("../data/units.json", import.meta.url)));
const units = unitsDoc.units;
const ref   = JSON.parse(readFileSync(new URL("../data/reference.json", import.meta.url)));

/* The reference table uses merged units. Rebuild that configuration so the
   published numbers can be checked directly. */
const merged = Object.entries(ref.merged_units).map(([code, v]) => ({
  code, population: { "2011": v.pop2011 }, current_seats: v.current
}));

const SERIES = ["1971", "1981", "1991", "2001", "2011",
                "2016_proj", "2021_proj", "2026_proj", "2031_proj", "2036_proj"];

let pass = 0, fail = 0;
const ok = (name, cond, detail = "") => {
  if (cond) { pass++; }
  else { fail++; console.log(`  FAIL  ${name}${detail ? "  " + detail : ""}`); }
};
const section = s => console.log(`\n${s}`);
const sum = o => Object.values(o).reduce((a, b) => a + b, 0);

/* 1. exact totals across the full house-size range, every method */
section("1. Allocations sum exactly to the house size");
for (const m of Object.keys(METHODS)) {
  let bad = 0;
  for (let H = 400; H <= 1100; H += 1) {
    const r = allocate(units, H, m, { baseSeats: 2 });
    if (r.infeasible || sum(r.seats) !== H) bad++;
  }
  ok(`${m} exact at all H in 400..1100`, bad === 0, `${bad} mismatches`);
}

/* 2. one-seat minimum */
section("2. Every unit always receives at least one seat");
for (const m of Object.keys(METHODS)) {
  let bad = 0;
  for (let H = 400; H <= 1100; H += 7) {
    const r = allocate(units, H, m, { baseSeats: 2 });
    if (Object.values(r.seats).some(v => v < 1)) bad++;
  }
  ok(`${m} respects the floor of one`, bad === 0, `${bad} violations`);
}

/* 3. reference-table reproduction on merged units */
section("3. Reproduces the published projection table (merged units)");
const a = ref.assertions_confirmed_in_prototype;
const h543 = allocate(merged, 543, "hare", {}).seats;
for (const [code, want] of Object.entries(a.hare_at_543)) {
  ok(`hare@543 ${code}=${want}`, h543[code] === want, `got ${h543[code]}`);
}
const hh815 = allocate(merged, 815, "huntington", {}).seats;
for (const [code, want] of Object.entries(a.huntington_at_815)) {
  ok(`huntington@815 ${code}=${want}`, hh815[code] === want, `got ${hh815[code]}`);
}

/* 4. constraints */
section("4. Floors are respected under every method");
for (const m of Object.keys(METHODS)) {
  const r = allocate(units, 815, m, { baseSeats: 2, protectAll: true });
  const bad = units.filter(u => r.seats[u.code] < u.current_seats).map(u => u.code);
  ok(`${m} protectAll@815`, bad.length === 0, bad.join(","));

  const r2 = allocate(units, 700, m, { baseSeats: 2, protectSmall: true });
  const bad2 = units.filter(u => u.population["2011"] < 6000000 && r2.seats[u.code] < u.current_seats);
  ok(`${m} protectSmall@700`, bad2.length === 0, bad2.map(u => u.code).join(","));
}

/* 5. infeasibility is structured, not thrown */
section("5. Infeasible combinations return a structured result");
const inf = allocate(units, 500, "hare", { protectAll: true });
ok("infeasible flag set", inf.infeasible === true);
ok("reason is floors-exceed-house", inf.reason === "floors-exceed-house", `got ${inf.reason}`);
ok("minimumHouse reported as 543", inf.minimumHouse === 543, `got ${inf.minimumHouse}`);

/* 6. the headline finding: protectAll at the current house size changes nothing */
section("6. protectAll at 543 is identical to the freeze");
const frozen = allocate(units, 543, "hare", { protectAll: true }).seats;
const moved = units.filter(u => frozen[u.code] !== u.current_seats);
ok("zero units move", moved.length === 0, moved.map(u => u.code).join(","));

/* 7. monotonicity, and a deliberate demonstration of the Alabama paradox */
section("7. Monotonicity under divisor methods, paradox under largest remainder");
for (const m of ["huntington", "sainteLague", "dhondt"]) {
  let violations = 0;
  let prev = allocate(units, 500, m, {}).seats;
  for (let H = 501; H <= 900; H++) {
    const cur = allocate(units, H, m, {}).seats;
    if (units.some(u => cur[u.code] < prev[u.code])) violations++;
    prev = cur;
  }
  ok(`${m} is house-monotone`, violations === 0, `${violations} violations`);
}
let alabama = [];
{
  let prev = allocate(units, 400, "hare", {}).seats;
  for (let H = 401; H <= 1100; H++) {
    const cur = allocate(units, H, "hare", {}).seats;
    for (const u of units) {
      if (cur[u.code] < prev[u.code]) alabama.push({ H, code: u.code, from: prev[u.code], to: cur[u.code] });
    }
    prev = cur;
  }
}
ok("largest remainder exhibits the Alabama paradox on real data",
   alabama.length > 0, "none found in 400..1100");
if (alabama.length) {
  console.log(`        ${alabama.length} instances. First: at H=${alabama[0].H}, ` +
              `${alabama[0].code} falls ${alabama[0].from} -> ${alabama[0].to} as the house GROWS.`);
}

/* 8. quota violations by divisor methods */
section("8. Quota violations");
for (const m of Object.keys(METHODS)) {
  const r = allocate(units, 815, m, { baseSeats: 2 });
  const v = quotaViolations(units, r.seats, 815);
  console.log(`        ${m.padEnd(12)} ${v.length} unit(s) outside quota` +
              (v.length ? `: ${v.map(x => x.code).join(",")}` : ""));
}
ok("largest remainder never violates quota",
   quotaViolations(units, allocate(units, 815, "hare", {}).seats, 815).length === 0);

/* ---------------------------------------------------------------------------
   9. Regression snapshot. Asserted, not merely printed.
--------------------------------------------------------------------------- */
section("9. Regression snapshot (test/snapshot.json)");
let snap = null;
try {
  snap = JSON.parse(readFileSync(new URL("./snapshot.json", import.meta.url)));
} catch {
  fail++;
  console.log("  FAIL  snapshot.json missing. Create it with: node scripts/make_snapshot.mjs");
}
if (snap) {
  const fp = snap.data_fingerprint;
  ok("snapshot was built against this data",
     fp.unit_count === units.length &&
     fp.current_seats === unitsDoc.totals.current_seats &&
     fp.population_2011 === unitsDoc.totals.population_2011,
     "data changed since the snapshot; regenerate it deliberately");

  ok("snapshot covers every scenario",
     SCENARIOS.every(s => snap.scenarios[s.name]),
     SCENARIOS.filter(s => !snap.scenarios[s.name]).map(s => s.name).join(","));

  let drifted = [];
  for (const s of SCENARIOS) {
    const want = snap.scenarios[s.name];
    if (!want) continue;
    const r = allocate(units, s.H, s.method, s.opts);
    const diffs = [];
    if (r.infeasible !== want.infeasible) diffs.push(`infeasible ${want.infeasible}->${r.infeasible}`);
    for (const code of new Set([...Object.keys(want.seats ?? {}), ...Object.keys(r.seats ?? {})])) {
      if ((want.seats?.[code]) !== (r.seats?.[code])) {
        diffs.push(`${code} ${want.seats?.[code]}->${r.seats?.[code]}`);
      }
    }
    if (diffs.length) drifted.push(`${s.name}: ${diffs.slice(0, 6).join(", ")}`);
  }
  ok(`all ${SCENARIOS.length} snapshot scenarios reproduce exactly`,
     drifted.length === 0, "\n          " + drifted.join("\n          "));
}

/* ---------------------------------------------------------------------------
   10. Every population series, not just 2011.
--------------------------------------------------------------------------- */
section("10. Every population series allocates exactly and respects the floor");
for (const year of SERIES) {
  const expectedAbsent = units.filter(u => u.population[year] == null).map(u => u.code).sort();
  let bad = 0, badFloor = 0, badAbsent = 0;
  for (const m of Object.keys(METHODS)) {
    for (const H of [400, 543, 700, 815, 888, 1100]) {
      const r = allocate(units, H, m, { baseSeats: 2, year });
      if (r.infeasible || sum(r.seats) !== H) { bad++; continue; }
      if (Object.values(r.seats).some(v => v < 1)) badFloor++;
      if (r.absent.slice().sort().join(",") !== expectedAbsent.join(",")) badAbsent++;
      if (expectedAbsent.some(c => c in r.seats)) badAbsent++;
    }
  }
  const label = expectedAbsent.length ? `${year} (absent: ${expectedAbsent.join(",")})` : year;
  ok(`${label} allocates exactly`, bad === 0, `${bad} mismatches`);
  ok(`${label} respects the floor of one`, badFloor === 0, `${badFloor} violations`);
  ok(`${label} reports absences and excludes them`, badAbsent === 0, `${badAbsent} problems`);
}

/* 11. Absent units are a real hole, reported, never imputed */
section("11. Absent units are reported rather than imputed");
const r1981 = allocate(units, 543, "hare", { year: "1981" });
ok("1981 reports Assam absent", r1981.absent.join(",") === "AS", r1981.absent.join(","));
ok("1981 does not allocate Assam a seat", !("AS" in r1981.seats));
ok("1981 still fills the house exactly", sum(r1981.seats) === 543, `${sum(r1981.seats)}`);
const r1991 = allocate(units, 543, "hare", { year: "1991" });
ok("1991 reports J&K and Ladakh absent", r1991.absent.slice().sort().join(",") === "JK,LA",
   r1991.absent.join(","));
ok("1991 allocates over the remaining 34 units",
   Object.keys(r1991.seats).length === 34, `${Object.keys(r1991.seats).length}`);

/* ---------------------------------------------------------------------------
   12. Maximum change per unit.
--------------------------------------------------------------------------- */
section("12. Maximum-change-per-unit constraint");
for (const K of [0, 2, 5, 10]) {
  let bad = 0;
  for (const m of Object.keys(METHODS)) {
    for (const H of [543, 600, 700, 815]) {
      const r = allocate(units, H, m, { baseSeats: 2, maxChange: K });
      if (r.infeasible) continue;
      for (const u of units) {
        const got = r.seats[u.code];
        const lo = Math.max(1, u.current_seats - K), hi = u.current_seats + K;
        if (got < lo || got > hi) bad++;
      }
    }
  }
  ok(`maxChange=${K} keeps every unit inside its band`, bad === 0, `${bad} violations`);
}
const k0 = allocate(units, 543, "hare", { maxChange: 0 });
ok("maxChange=0 at 543 reproduces the current house exactly",
   units.every(u => k0.seats[u.code] === u.current_seats));
const tooBig = allocate(units, 900, "hare", { maxChange: 0 });
ok("maxChange=0 above 543 is infeasible", tooBig.infeasible === true);
ok("  and says the ceilings are the binding side",
   tooBig.reason === "ceilings-below-house", `got ${tooBig.reason}`);
ok("  and reports the maximum viable house", tooBig.maximumHouse === 543, `got ${tooBig.maximumHouse}`);
const tooSmall = allocate(units, 300, "hare", { maxChange: 2 });
ok("a house below the floors is infeasible on the floor side",
   tooSmall.infeasible === true && tooSmall.reason === "floors-exceed-house", `${tooSmall.reason}`);
ok("  and reports a minimum house the interface can offer as a fix",
   tooSmall.minimumHouse > 300 && sum(tooSmall.floors) === tooSmall.minimumHouse);

/* ---------------------------------------------------------------------------
   13. Determinism: the answer must not depend on the order of the input.
--------------------------------------------------------------------------- */
section("13. Output does not depend on input order");
{
  const shuffled = [...units].reverse();
  let bad = 0;
  for (const m of Object.keys(METHODS)) {
    for (const H of [543, 815]) {
      const x = allocate(units, H, m, { baseSeats: 2 }).seats;
      const y = allocate(shuffled, H, m, { baseSeats: 2 }).seats;
      if (units.some(u => x[u.code] !== y[u.code])) bad++;
    }
  }
  ok("reversing the unit list changes nothing", bad === 0, `${bad} methods differ`);
}
{
  /* Exact ties, which real population data almost never produces. Four units of
     identical weight sharing an odd number of seats must break the tie by code. */
  const tied = ["AA", "BB", "CC", "DD"].map(code => ({ code, population: { "2011": 1000 }, current_seats: 1 }));
  const r = allocate(tied, 7, "hare", {});
  ok("exact ties break by code, ascending",
     r.seats.AA === 2 && r.seats.BB === 2 && r.seats.CC === 2 && r.seats.DD === 1,
     JSON.stringify(r.seats));
  const rh = allocate(tied, 7, "dhondt", {});
  ok("  and the same under a divisor method", sum(rh.seats) === 7 && rh.seats.AA >= rh.seats.DD,
     JSON.stringify(rh.seats));
}

/* ---------------------------------------------------------------------------
   14. Independent re-derivation of the Alabama paradox.

   Section 7 finds the paradox using the engine itself. That is circular: a bug
   in largestRemainder would produce a false paradox, and floating-point
   comparison of remainders is exactly the kind of thing that could invent one.

   This re-derives it from scratch with EXACT INTEGER arithmetic. For unit i,
   the exact entitlement is w_i * H / W. The floor is integer division, and the
   fractional remainder ordering is the ordering of (w_i * H) mod W, computed in
   BigInt with no division at all. If the two implementations agree, the
   paradox is a property of the rule and the data, not of the arithmetic.
--------------------------------------------------------------------------- */
section("14. Alabama paradox, re-derived independently with exact integer arithmetic");
function exactLargestRemainder(pairs, H) {
  const W = pairs.reduce((s, [, w]) => s + BigInt(w), 0n);
  const Hb = BigInt(H);
  const seats = {};
  let assigned = 0n;
  const rem = [];
  for (const [code, w] of pairs) {
    const num = BigInt(w) * Hb;
    const base = num / W;              // exact floor, no floating point
    seats[code] = base;
    assigned += base;
    rem.push([code, num % W]);         // exact remainder numerator
  }
  rem.sort((x, y) => (y[1] > x[1] ? 1 : y[1] < x[1] ? -1 : (x[0] < y[0] ? -1 : 1)));
  let short = Number(Hb - assigned);
  for (let i = 0; i < short; i++) seats[rem[i][0]] += 1n;
  const out = {};
  for (const k of Object.keys(seats)) out[k] = Number(seats[k]);
  return out;
}
/* The engine always enforces a floor of one seat per unit, by locking. To
   compare like with like, the independent implementation has to do the same,
   so the locking is reimplemented here rather than borrowed. */
function exactAllocateFloorOne(pairs, H) {
  const locked = {};
  for (let guard = 0; guard <= pairs.length + 1; guard++) {
    const free = pairs.filter(([c]) => !(c in locked));
    const lockedTotal = Object.values(locked).reduce((a, b) => a + b, 0);
    if (free.length === 0) return { ...locked };
    const r = exactLargestRemainder(free, H - lockedTotal);
    let changed = false;
    for (const [c] of free) if (r[c] < 1) { locked[c] = 1; changed = true; }
    if (!changed) return { ...locked, ...r };
  }
  throw new Error("exactAllocateFloorOne did not converge");
}
{
  const pairs = units.map(u => [u.code, u.population["2011"]]);
  const findParadox = (lo, hi) => {
    const hits = [];
    let prev = exactAllocateFloorOne(pairs, lo);
    for (let H = lo + 1; H <= hi; H++) {
      const cur = exactAllocateFloorOne(pairs, H);
      for (const [code] of pairs) if (cur[code] < prev[code]) hits.push({ H, code, from: prev[code], to: cur[code] });
      prev = cur;
    }
    return hits;
  };

  // The exact implementation must agree with the engine, seat for seat.
  let mismatch = 0;
  for (let H = 400; H <= 1100; H += 1) {
    const A = exactLargestRemainder(pairs, H);
    const B = largestRemainder(pairs.map(([code, weight]) => ({ code, weight })), H);
    if (pairs.some(([c]) => A[c] !== B[c])) mismatch++;
  }
  ok("exact-integer and engine largest remainder agree at every H in 400..1100",
     mismatch === 0, `${mismatch} house sizes differ`);

  const exact400 = findParadox(400, 1100);
  ok("the paradox survives exact arithmetic, so it is not a rounding artefact",
     exact400.length > 0);
  ok("exact and engine paradox counts match over 400..1100",
     exact400.length === alabama.length, `exact ${exact400.length} vs engine ${alabama.length}`);

  const exact543 = findParadox(543, 900);
  console.log(`        ${exact543.length} instances across H=543..900, the politically live range.`);
  for (const h of exact543.slice(0, 4)) {
    console.log(`          H=${h.H}  ${h.code} ${h.from} -> ${h.to}`);
  }
  ok("Uttarakhand falls 5 -> 4 at H=548, the published unchanged-strength total",
     exact543.some(h => h.H === 548 && h.code === "UK" && h.from === 5 && h.to === 4));

  // And the divisor methods must produce none, by the same independent scan.
  let divisorHits = 0;
  for (const m of ["huntington", "sainteLague", "dhondt"]) {
    let prev = allocate(units, 543, m, {}).seats;
    for (let H = 544; H <= 900; H++) {
      const cur = allocate(units, H, m, {}).seats;
      if (units.some(u => cur[u.code] < prev[u.code])) divisorHits++;
      prev = cur;
    }
  }
  ok("no divisor method exhibits it in the same range", divisorHits === 0, `${divisorHits} found`);
}

/* ---------------------------------------------------------------------------
   15. Boundary geometry.

   Section 2.1 of the build brief is a legal requirement, not a preference, so
   it belongs in the test suite rather than in a script someone remembers to
   run. If a future change to the boundary pipeline ever moves Aksai Chin
   outside Ladakh, this fails.
--------------------------------------------------------------------------- */
section("15. Boundary geometry: joins to the unit list and satisfies the section 2.1 gate");
{
  let topo = null;
  try {
    topo = JSON.parse(readFileSync(new URL("../data/boundaries.topo.json", import.meta.url)));
  } catch {
    fail++;
    console.log("  FAIL  data/boundaries.topo.json missing. Build it with: node scripts/build_boundaries.mjs");
  }
  if (topo) {
    const geoms = topo.objects?.states?.geometries ?? [];
    const geoCodes = geoms.map(g => g.properties.code).sort();
    const unitCodes = units.map(u => u.code).sort();
    ok("one geometry per unit, no orphans either way",
       geoCodes.join(",") === unitCodes.join(","),
       `geometry ${geoCodes.length} vs units ${unitCodes.length}`);

    /* Decode the topology to lon/lat. Kept local so the test does not depend on
       the build script it is checking. */
    const { scale: [sx, sy], translate: [tx, ty] } = topo.transform;
    const abs = topo.arcs.map(a => {
      let x = 0, y = 0;
      return a.map(([dx, dy]) => { x += dx; y += dy; return [x * sx + tx, y * sy + ty]; });
    });
    const pickArc = i => (i < 0 ? abs[~i].slice().reverse() : abs[i]);
    const ringOf = ix => {
      const out = [];
      for (const i of ix) { const p = pickArc(i); out.push(...(out.length ? p.slice(1) : p)); }
      return out;
    };
    const shapes = geoms.map(g => ({
      code: g.properties.code,
      polys: g.type === "Polygon" ? [g.arcs.map(ringOf)] : g.arcs.map(p => p.map(ringOf)),
    }));
    const inRing = (r, lon, lat) => {
      let inside = false;
      for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
        const [xi, yi] = r[i], [xj, yj] = r[j];
        if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
      }
      return inside;
    };
    const hit = (lon, lat) => shapes.filter(s =>
      s.polys.some(p => inRing(p[0], lon, lat) && !p.slice(1).some(h => inRing(h, lon, lat)))
    ).map(s => s.code);

    /* lat, lon, must-be-inside, and for the claimed territories the unit that
       must own them. */
    const PROBES = [
      ["Gilgit (Gilgit-Baltistan)", 35.92, 74.31, true,  "LA"],
      ["Skardu (Gilgit-Baltistan)", 35.30, 75.63, true,  "LA"],
      ["Muzaffarabad (PoK)",        34.37, 73.47, true,  "JK"],
      ["Mirpur (PoK)",              33.15, 73.75, true,  "JK"],
      ["Aksai Chin interior",       35.20, 79.50, true,  "LA"],
      ["Aksai Chin east",           35.10, 79.90, true,  "LA"],
      ["Shaksgam Valley",           36.00, 76.50, true,  "LA"],
      ["Srinagar",                  34.08, 74.80, true,  "JK"],
      ["Leh (Ladakh)",              34.15, 77.58, true,  "LA"],
      ["Tawang (Arunachal)",        27.59, 91.87, true,  "AR"],
      ["Itanagar (Arunachal)",      27.08, 93.60, true,  "AR"],
      ["Walong (east Arunachal)",   28.13, 97.00, true,  "AR"],
      ["Kathmandu (Nepal)",         27.70, 85.30, false, null],
      ["Lhasa (Tibet)",             29.65, 91.10, false, null],
      ["Lahore (Pakistan)",         31.55, 74.34, false, null],
    ];
    let bad = [];
    for (const [label, lat, lon, want, owner] of PROBES) {
      const hits = hit(lon, lat);
      const inside = hits.length > 0;
      if (inside !== want) bad.push(`${label} expected ${want ? "in" : "out"}`);
      else if (owner && !hits.includes(owner)) bad.push(`${label} owned by ${hits.join("/")} not ${owner}`);
    }
    ok(`all ${PROBES.length} section 2.1 probes pass on the built geometry`,
       bad.length === 0, bad.join("; "));

    /* Every polygon ring must close, or a renderer will fill it unpredictably. */
    let open = 0;
    for (const s of shapes) for (const p of s.polys) for (const r of p) {
      if (r.length < 4 || r[0][0] !== r[r.length - 1][0] || r[0][1] !== r[r.length - 1][1]) open++;
    }
    ok("every ring is closed", open === 0, `${open} open rings`);

    const kb = Buffer.byteLength(JSON.stringify(topo)) / 1024;
    ok(`geometry is inside the 400 KB budget (${kb.toFixed(1)} KB)`, kb < 400);
    ok("the cartographic note names its source and caveat",
       Boolean(topo.source?.repository && topo.source?.provenance_caveat));
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
