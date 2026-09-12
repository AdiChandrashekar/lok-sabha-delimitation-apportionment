/* ---------------------------------------------------------------------------
   Apportionment engine. No DOM dependencies, importable in Node for testing.

   Every method takes (units, houseSize, opts) where each unit is
   { code, weight } and returns { code: seats } summing EXACTLY to houseSize.

   Validated against the published projection table: at 543 seats under
   largest-remainder this reproduces UP 89, BR 46, RJ 30, TN 32, KL 15 on merged
   units, and at 815 under Huntington-Hill it reproduces UP 133, TN 48, KL 22.

   TIE-BREAKING. Every method here is deterministic. Where two units have an
   equal claim, the tie is broken by unit code, ascending, and never by array
   order. This matters more than it looks: array order is the order of
   units.json, so an order-dependent tie-break would make the output depend on
   how the data file happens to be sorted. Exact ties are rare with real
   population data but not impossible, and they are common with the small
   integer weights used in tests.
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
      // Strictly greater, then an explicit code tie-break. See the header note.
      if (p > bestPriority || (p === bestPriority && u.code < best)) {
        bestPriority = p; best = u.code;
      }
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

  /* With a Hare quota the shortfall is strictly less than the number of units,
     so each unit receives at most one extra seat. If that ever stops holding
     the arithmetic above is wrong, and silently wrapping around the list would
     hide it. Fail loudly instead. */
  const shortfall = houseSize - assigned;
  if (shortfall < 0 || shortfall > remainders.length) {
    throw new Error(`largestRemainder: shortfall ${shortfall} outside 0..${remainders.length}`);
  }
  for (let i = 0; i < shortfall; i++) seats[remainders[i].code] += 1;
  return seats;
}

/* Base plus proportional, the shape of the Cambridge Compromise. Every unit
   receives a fixed base, and the remainder of the house is distributed in
   proportion to population. A larger base protects small units at the direct
   expense of large ones, which is the whole point of the method.

   IMPLEMENTATION NOTE, and a deliberate departure from the first cut. The
   original implementation searched for a divisor by bisection and then settled
   the leftover seats by cycling through units "largest first". That settle-up
   was not neutral. Measured against an exact base-plus-proportional share at a
   house of 815, it handed Uttar Pradesh 127 seats against an ideal of 124.61,
   Bihar +1.12 and Maharashtra +1.05, while every small unit undershot by
   roughly 0.8 of a seat. It also produced 62 house-monotonicity violations
   between 500 and 900, nearly twice largest remainder's, none of which are
   inherent to the method.

   Distributing the remainder by largest remainder instead is exact by
   construction, needs no bisection, no guard loop and no silent failure path,
   and confines the size bias to the base itself where a reader can see it.
   The proportional part inherits largest remainder's Alabama paradox, which is
   honest: that is what "proportional" costs. */
export function baseProportional(units, houseSize, base) {
  const b = Math.max(0, Math.floor(base));
  const floorTotal = b * units.length;
  if (floorTotal > houseSize) {
    throw new Error(`baseProportional: base ${b} x ${units.length} units exceeds house ${houseSize}`);
  }
  const seats = {};
  units.forEach(u => { seats[u.code] = b; });

  const remaining = houseSize - floorTotal;
  if (remaining > 0) {
    const share = largestRemainder(units, remaining);
    for (const u of units) seats[u.code] += share[u.code];
  }
  /* The base can be zero, so re-assert the hard floor of one seat per unit.
     allocate() enforces this too, but the export must be safe on its own. */
  let deficit = 0;
  for (const u of units) if (seats[u.code] < 1) { deficit += 1 - seats[u.code]; seats[u.code] = 1; }
  if (deficit > 0) {
    const ranked = [...units].sort((x, y) => y.weight - x.weight || (x.code < y.code ? -1 : 1));
    let i = 0;
    while (deficit > 0) {
      const c = ranked[i % ranked.length].code;
      if (seats[c] > 1) { seats[c] -= 1; deficit -= 1; }
      i += 1;
      if (i > units.length * houseSize) throw new Error("baseProportional: cannot satisfy the floor of one");
    }
  }
  return seats;
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
   Constraints, enforced by locking. Run the method, lock any unit outside its
   floor or ceiling at exactly that bound, re-run on what is left. The locked
   set only grows, so this terminates, and it works uniformly across every
   method.
--------------------------------------------------------------------------- */
export function allocate(units, houseSize, methodKey, opts = {}) {
  const method = METHODS[methodKey];
  if (!method) throw new Error(`unknown method: ${methodKey}`);

  const year = opts.year ?? "2011";
  const threshold = opts.smallThreshold ?? 6000000;

  const rawPop = u => (typeof u.population === "object" ? u.population[year] : u.population);

  /* Units with no population for the selected year are EXCLUDED and reported.
     Assam was not enumerated in 1981, and Jammu & Kashmir and Ladakh were not
     enumerated in 1991. Those are real absences, not missing data to impute, so
     the engine refuses to invent a figure. The caller MUST surface `absent`:
     an allocation that quietly drops a unit and still fills the house is a
     misleading answer, not a smaller one. */
  const absent = units.filter(u => rawPop(u) == null).map(u => u.code);
  const active = units.filter(u => rawPop(u) != null);
  if (active.length === 0) {
    return { infeasible: true, reason: "no-population", absent, seats: null,
             floors: {}, ceilings: null, minimumHouse: null, maximumHouse: null };
  }
  const pop = u => rawPop(u);

  /* Floors. The one-seat minimum always applies; the optional constraints only
     ever raise it. A max-change constraint also lowers nothing below one. */
  const floors = {}, ceilings = {};
  const maxChange = Number.isFinite(opts.maxChange) && opts.maxChange >= 0
    ? Math.floor(opts.maxChange) : null;

  for (const u of active) {
    let f = 1;
    if (opts.protectAll) f = Math.max(f, u.current_seats);
    else if (opts.protectSmall && pop(u) < threshold) f = Math.max(f, u.current_seats);
    if (maxChange !== null) f = Math.max(f, Math.max(1, u.current_seats - maxChange));
    floors[u.code] = f;
    ceilings[u.code] = maxChange !== null ? Math.max(f, u.current_seats + maxChange) : Infinity;
  }

  const minimumHouse = Object.values(floors).reduce((a, b) => a + b, 0);
  const maximumHouse = maxChange !== null
    ? Object.values(ceilings).reduce((a, b) => a + b, 0) : null;

  if (minimumHouse > houseSize) {
    return { infeasible: true, reason: "floors-exceed-house", absent, seats: null,
             floors, ceilings: maxChange !== null ? ceilings : null, minimumHouse, maximumHouse };
  }
  if (maximumHouse !== null && maximumHouse < houseSize) {
    return { infeasible: true, reason: "ceilings-below-house", absent, seats: null,
             floors, ceilings, minimumHouse, maximumHouse };
  }

  const locked = {};
  /* The locked set grows by at least one unit per iteration that changes
     anything, so this cannot run longer than the number of units. */
  for (let guard = 0; guard <= active.length + 1; guard++) {
    const free = active.filter(u => !(u.code in locked));
    const lockedTotal = Object.values(locked).reduce((a, b) => a + b, 0);
    const remaining = houseSize - lockedTotal;

    if (free.length === 0) {
      return { infeasible: false, reason: null, absent, seats: { ...locked },
               floors, ceilings: maxChange !== null ? ceilings : null, minimumHouse, maximumHouse };
    }

    const payload = free.map(u => ({ code: u.code, weight: pop(u) }));
    const result = method.run(payload, remaining, opts);

    let changed = false;
    for (const u of free) {
      if (result[u.code] < floors[u.code]) { locked[u.code] = floors[u.code]; changed = true; }
      else if (result[u.code] > ceilings[u.code]) { locked[u.code] = ceilings[u.code]; changed = true; }
    }
    if (!changed) {
      return { infeasible: false, reason: null, absent, seats: { ...locked, ...result },
               floors, ceilings: maxChange !== null ? ceilings : null, minimumHouse, maximumHouse };
    }
  }
  /* Reaching here is a bug in the locking argument above, not a property of the
     user's inputs. Say so, rather than reporting it as an infeasible request. */
  return { infeasible: true, reason: "did-not-converge", absent, seats: null,
           floors, ceilings: maxChange !== null ? ceilings : null, minimumHouse, maximumHouse };
}

/* Flags units whose allocation falls outside their lower and upper quota.
   Divisor methods can violate quota. Largest remainder cannot. Showing this in
   the interface is a legitimate and underused criticism of the divisor family.

   NOTE. Quota is computed over the units actually allocated, so a year with an
   absent unit is measured against its own reduced total rather than against a
   national figure the allocation never saw. A unit pinned by a constraint may
   also be reported here: that is a violation caused by the constraint, not by
   the method, and the interface should say which is which. */
export function quotaViolations(units, seats, houseSize, year = "2011") {
  const pop = u => (typeof u.population === "object" ? u.population[year] : u.population);
  const scored = units.filter(u => pop(u) != null && seats[u.code] != null);
  const total = scored.reduce((s, u) => s + pop(u), 0);
  const out = [];
  for (const u of scored) {
    const exact = pop(u) / total * houseSize;
    const got = seats[u.code];
    if (got < Math.floor(exact) || got > Math.ceil(exact)) {
      out.push({ code: u.code, got, exact, lower: Math.floor(exact), upper: Math.ceil(exact) });
    }
  }
  return out;
}
