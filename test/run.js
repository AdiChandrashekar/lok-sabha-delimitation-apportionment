/* Plain Node test runner. No framework. Run with: node test/run.js */
import { readFileSync } from "fs";
import { allocate, METHODS, quotaViolations } from "../js/apportion.js";

const units = JSON.parse(readFileSync(new URL("../data/units.json", import.meta.url))).units;
const ref   = JSON.parse(readFileSync(new URL("../data/reference.json", import.meta.url)));

/* The reference table uses merged units. Rebuild that configuration so the
   published numbers can be checked directly. */
const merged = Object.entries(ref.merged_units).map(([code, v]) => ({
  code, population: { "2011": v.pop2011 }, current_seats: v.current
}));

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

/* 9. regression fixture */
section("9. Regression snapshot");
const snapshot = {};
for (const [m, H, o] of [["hare",543,{}],["hare",815,{}],["huntington",815,{}],
                         ["dhondt",815,{}],["cubeRoot",815,{}],["baseProp",815,{baseSeats:2}],
                         ["hare",815,{protectAll:true}]]) {
  snapshot[`${m}@${H}${o.protectAll?"+protectAll":""}`] = allocate(units, H, m, o).seats;
}
console.log(`        ${Object.keys(snapshot).length} scenarios captured. ` +
            `Write to test/snapshot.json and assert on it after any refactor.`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
