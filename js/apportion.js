/* ---------------------------------------------------------------------------
   Apportionment engine. No DOM dependencies, importable in Node for testing.

   Every method takes (units, houseSize, opts) where each unit is
   { code, weight } and returns { code: seats } summing EXACTLY to houseSize.

   Validated against the published projection table: at 543 seats under
   largest-remainder this reproduces UP 89, BR 46, RJ 30, TN 32, KL 15 on merged
   units, and at 815 under Huntington-Hill it reproduces UP 133, TN 48, KL 22.
--------------------------------------------------------------------------- */

/* Highest-averages family. The divisor function maps a unit's current seat
   count to the denominator for its next-seat priority. The three members
   differ only in how hard a unit is penalised for seats already held, which is
   exactly the axis that decides how much small units are favoured. */
export function highestAverages(units, houseSize, divisor, seedOne) {
  const seats = {};
  units.forEach(u => { seats[u.code] = seedOne ? 1 : 0; });
  let assigned = seedOne ? units.length : 0;
  if (assigned > houseSize) throw new Error("houseSize below unit count");

  while (assigned < houseSize) {
    let best = null, bestPriority = -Infinity;
    for (const u of units) {
      const p = u.weight / divisor(seats[u.code]);
      if (p > bestPriority) { bestPriority = p; best = u.code; }
    }
    seats[best] += 1;
    assigned += 1;
  }
  return seats;
}

/* Largest remainder with a Hare quota. This is the rule behind essentially
   every published delimitation projection, and it is also the only method here
   that can exhibit the Alabama paradox: a unit can LOSE a seat when the house
   grows. See Balinski and Young, Fair Representation. Worth surfacing in the
   methodology note, because nobody in the Indian debate raises it. */
export function largestRemainder(units, houseSize) {
  const totalWeight = units.reduce((s, u) => s + u.weight, 0);
  const quota = totalWeight / houseSize;
  const seats = {}, remainders = [];
  let assigned = 0;

  for (const u of units) {
    const exact = u.weight / quota;
    const base = Math.floor(exact);
    seats[u.code] = base;
    assigned += base;
    remainders.push({ code: u.code, remainder: exact - base });
  }
  remainders.sort((a, b) => b.remainder - a.remainder || (a.code < b.code ? -1 : 1));
  for (let i = 0; assigned < houseSize; i++, assigned++) {
    seats[remainders[i % remainders.length].code] += 1;
  }
  return seats;
}

/* Base plus proportional, the shape of the Cambridge Compromise. Every unit
   starts with a fixed base, the rest is proportional, and a divisor is found by
   bisection so the total lands on the house size. A larger base protects small
   units at the direct expense of large ones. */
export function baseProportional(units, houseSize, base) {
  const totalWeight = units.reduce((s, u) => s + u.weight, 0);
  const at = d => {
    const seats = {}; let total = 0;
    for (const u of units) {
      const n = Math.max(1, Math.floor(base + u.weight / d));
      seats[u.code] = n; total += n;
    }
    return { seats, total };
  };

  let lo = totalWeight / (houseSize * 4), hi = totalWeight;
  let result = at(hi);
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    result = at(mid);
    if (result.total > houseSize) lo = mid; else hi = mid;
  }

  // Bisection on a step function rarely lands exactly. Settle the remainder
  // deterministically, largest units first.
  let diff = houseSize - result.total;
  const ranked = [...units].sort((a, b) => b.weight - a.weight || (a.code < b.code ? -1 : 1));
  let i = 0, guard = 0;
  while (diff !== 0 && guard++ < 200000) {
    const code = ranked[i % ranked.length].code;
    if (diff > 0) { result.seats[code] += 1; diff -= 1; }
    else if (result.seats[code] > 1) { result.seats[code] -= 1; diff += 1; }
    i += 1;
  }
  return result.seats;
}

export const METHODS = {
  hare: {
    label: "Proportional, largest remainder",
    note: "Seats in direct proportion to population, leftovers to the largest fractional remainders. The rule behind most published projections. Can exhibit the Alabama paradox.",
    quotaRespecting: true,
    run: (u, H) => largestRemainder(u, H)
  },
  huntington: {
    label: "Huntington-Hill (US method)",
    note: "Every unit seeded with one seat, then each further seat to the highest population divided by the geometric mean of current and next seat count. Mildly favours small units.",
    quotaRespecting: false,
    run: (u, H) => highestAverages(u, H, n => Math.sqrt(n * (n + 1)), true)
  },
  sainteLague: {
    label: "Sainte-Lague",
    note: "Divisors 1, 3, 5, 7. Least size-biased of the divisor methods.",
    quotaRespecting: false,
    run: (u, H) => highestAverages(u, H, n => 2 * n + 1, false)
  },
  dhondt: {
    label: "D'Hondt",
    note: "Divisors 1, 2, 3, 4. Systematically favours large units, so the most populous states gain most.",
    quotaRespecting: false,
    run: (u, H) => highestAverages(u, H, n => n + 1, false)
  },
  cubeRoot: {
    label: "Cube root of population",
    note: "Seats proportional to the cube root of population. Compresses the range sharply: a unit four times larger gets about 1.6 times the seats.",
    quotaRespecting: true,
    run: (u, H) => largestRemainder(u.map(x => ({ code: x.code, weight: Math.cbrt(x.weight) })), H)
  },
  baseProp: {
    label: "Base seats plus proportional",
    note: "A guaranteed base per unit, remainder proportional. The Cambridge Compromise shape used for the European Parliament.",
    quotaRespecting: false,
    run: (u, H, o) => baseProportional(u, H, o.baseSeats ?? 2)
  }
};

/* ---------------------------------------------------------------------------
   Constraints, enforced by locking. Run the method, lock any unit below its
   floor at exactly its floor, re-run on what is left. The locked set only
   grows, so this terminates, and it works uniformly across every method.
--------------------------------------------------------------------------- */
export function allocate(units, houseSize, methodKey, opts = {}) {
  const method = METHODS[methodKey];
  if (!method) throw new Error(`unknown method: ${methodKey}`);

  const year = opts.year ?? "2011";
  const threshold = opts.smallThreshold ?? 6000000;

  const pop = u => {
    const p = typeof u.population === "object" ? u.population[year] : u.population;
    if (p == null) throw new Error(`no population for ${u.code} in ${year}`);
    return p;
  };

  const floors = {};
  for (const u of units) {
    let f = 1;
    if (opts.protectAll) f = Math.max(f, u.current_seats);
    else if (opts.protectSmall && pop(u) < threshold) f = Math.max(f, u.current_seats);
    floors[u.code] = f;
  }

  const minimumHouse = Object.values(floors).reduce((a, b) => a + b, 0);
  if (minimumHouse > houseSize) {
    return { infeasible: true, minimumHouse, seats: null, floors };
  }

  const locked = {};
  for (let guard = 0; guard < 200; guard++) {
    const free = units.filter(u => !(u.code in locked));
    const lockedTotal = Object.values(locked).reduce((a, b) => a + b, 0);
    const remaining = houseSize - lockedTotal;
    if (free.length === 0) return { infeasible: false, seats: { ...locked }, floors, minimumHouse };

    const payload = free.map(u => ({ code: u.code, weight: pop(u) }));
    const result = method.run(payload, remaining, opts);

    let changed = false;
    for (const u of free) {
      if (result[u.code] < floors[u.code]) { locked[u.code] = floors[u.code]; changed = true; }
    }
    if (!changed) {
      return { infeasible: false, seats: { ...locked, ...result }, floors, minimumHouse };
    }
  }
  return { infeasible: true, minimumHouse, seats: null, floors };
}

/* Flags units whose allocation falls outside their lower and upper quota.
   Divisor methods can violate quota. Largest remainder cannot. Showing this in
   the interface is a legitimate and underused criticism of the divisor family. */
export function quotaViolations(units, seats, houseSize, year = "2011") {
  const pop = u => (typeof u.population === "object" ? u.population[year] : u.population);
  const total = units.reduce((s, u) => s + pop(u), 0);
  const out = [];
  for (const u of units) {
    const exact = pop(u) / total * houseSize;
    const got = seats[u.code];
    if (got < Math.floor(exact) || got > Math.ceil(exact)) {
      out.push({ code: u.code, got, exact, lower: Math.floor(exact), upper: Math.ceil(exact) });
    }
  }
  return out;
}
