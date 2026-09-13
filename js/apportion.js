/* ---------------------------------------------------------------------------
   Apportionment engine. No DOM dependencies, importable in Node for testing.

   Every method takes (units, houseSize, opts) where each unit is
   { code, weight } and returns { code: seats } summing EXACTLY to houseSize.
   The one deliberate exception is the Delimitation Commission method, which is
   applied as the Commission worked and reports its own total (see METHODS).

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

/* Largest remainder with a Hare quota. A common way to build quick
   projections, though not the method India's Delimitation Commission used.
   It is also the family here that can
   exhibit the Alabama paradox: a unit can LOSE a seat when the house grows. See
   Balinski and Young, Fair Representation. */
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
  /* The base is capped at what the house can actually afford. Under a tight
     max-change constraint the free pool can shrink until its requested base no
     longer fits in the seats left, and throwing there would turn a legitimate
     scenario into a crash. Reducing the base is the honest degradation: the
     user asked for a floor the house cannot pay for. */
  const asked = Math.max(0, Math.floor(base));
  const b = Math.min(asked, Math.floor(houseSize / units.length));
  const floorTotal = b * units.length;
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

/* Ordered by relevance to India, which is the order the interface lists them
   in. Only the order and the wording matter to the interface; the engine does
   not depend on either. */
export const METHODS = {
  /* The Third Delimitation Commission's procedure (1972-76), applied literally.
     Union territories and states of 60 lakh or fewer keep their current seats
     outside the formula. The larger states share what is left: one national
     quotient (their population divided by those seats), and each state's
     population divided by it, rounded to the nearest seat.

     The quotient is NOT tuned afterwards, so the total can miss the house size
     by a few seats. That is deliberate. In 1976 the rounded seats happened to
     total exactly the 507 available, and the Commission's record does not say
     how it would have reconciled a miss, so inventing a reconciliation would put
     words in its mouth. The miss is returned as `total` and the interface says
     so. It is also why this is not Sainte-Laguë: Sainte-Laguë is this rounding
     with the quotient tuned until the total comes out, over every unit.

     Handled in allocate() directly rather than through run(), because the
     locking and repair machinery exists to force an exact total. */
  commission: {
    label: "Delimitation Commission method (1976)",
    note: "How the last Delimitation Commission allocated seats. Union territories and states of 60 lakh or fewer keep their current seats. The larger states share the rest: divide their population by those seats to get one national quotient, then round each state's population divided by that quotient to the nearest seat. Applied literally, so the total can miss the house size by a few seats, and the page says so when it does.",
    quotaRespecting: false,
    exactTotal: false,
    direct: true,
  },
  /* Not an apportionment rule, and labelled as such wherever it appears. It
     allocates in proportion to the CURRENT seat count rather than to
     population, so every state keeps its present share and the house simply
     grows. At 543 this is the freeze itself. Above 543 it is the arrangement
     reported to have been offered during the April 2026 debate, included so a
     reader can see what it does rather than take a description on trust. */
  statusQuo: {
    label: "Today's seats, scaled uniformly (not a population rule)",
    note: "Every state keeps its current share and the house simply grows. At 543 this is the freeze that has held since 1976. At 815 it is the uniform 50% increase reportedly offered during the April 2026 debate.",
    quotaRespecting: false,
    populationIndependent: true,
    run: (u, H) => largestRemainder(u.map(x => ({ code: x.code, weight: x.current })), H)
  },
  sainteLague: {
    label: "Sainte-Laguë (Webster)",
    note: "Divisors 1, 3, 5, 7: equivalently, one quotient for every unit, adjusted until the rounded seats add up exactly. The least size-biased divisor method, and the one Carnegie uses in its analysis of India. It reproduces the 1976 allocation, but it is not the Delimitation Commission's procedure: the Commission never adjusted its quotient, and union territories and small states were not on it.",
    quotaRespecting: false,
    run: (u, H) => highestAverages(u, H, n => 2 * n + 1, false)
  },
  hare: {
    label: "Largest remainder (Hamilton)",
    note: "Round every state down, then give the leftover seats to the largest fractions. A common way to build quick projections, but not the method India has used. Unlike India's method, it can take a seat away from a state when the house grows.",
    quotaRespecting: true,
    run: (u, H) => largestRemainder(u, H)
  },
  huntington: {
    label: "Huntington-Hill (US House)",
    note: "Rounds at the geometric mean of consecutive seat counts, which mildly favours small states. The method used for the United States House of Representatives.",
    quotaRespecting: false,
    run: (u, H) => highestAverages(u, H, n => Math.sqrt(n * (n + 1)), true)
  },
  baseProp: {
    label: "Base seats plus proportional",
    note: "A guaranteed base per state, with the rest shared by population. Floor-plus-proportional compromises of this shape have been suggested for India, and the European Parliament's Cambridge Compromise takes the same form.",
    quotaRespecting: false,
    run: (u, H, o) => baseProportional(u, H, o.baseSeats ?? 2)
  },
  dhondt: {
    label: "D'Hondt (Jefferson)",
    note: "Divisors 1, 2, 3, 4. Favours large states. Used to allocate seats among parties in many list-PR systems, not to allocate seats among Indian states.",
    quotaRespecting: false,
    run: (u, H) => highestAverages(u, H, n => n + 1, false)
  },
  cubeRoot: {
    label: "Cube root of population",
    note: "Seats proportional to the cube root of population, which strongly favours small states: one four times larger gets about 1.6 times the seats. Not proposed for India; included as the far end of the range.",
    quotaRespecting: true,
    run: (u, H) => largestRemainder(u.map(x => ({ code: x.code, weight: Math.cbrt(x.weight) })), H)
  },
};

/* The Delimitation Commission method, applied literally. See its METHODS
   entry for why the total is not forced. `pop` has already excluded absent
   units. States at or below the threshold ("does not exceed six millions" in
   Article 81) and every union territory keep their current seats; the rest are
   rounded against one quotient. Set-aside units are reported as floors, so the
   quota panel can say they were pinned by rule rather than by the method. */
function commissionAllocate(active, absent, houseSize, pop, opts) {
  const threshold = opts.smallThreshold ?? 6000000;
  const aside = active.filter(u => u.type === "UT" || pop(u) <= threshold);
  const pool = active.filter(u => !aside.includes(u));
  const asideSeats = aside.reduce((a, u) => a + u.current_seats, 0);
  const poolSeats = houseSize - asideSeats;

  const floors = {};
  for (const u of aside) floors[u.code] = u.current_seats;
  for (const u of pool) floors[u.code] = 1;
  const constraintsIgnored = Boolean(opts.protectAll) || Number.isFinite(opts.maxChange);
  const common = { absent, floors, ceilings: null, maximumHouse: null, constraintsIgnored,
                   setAside: aside.map(u => u.code) };

  if (pool.length === 0 || poolSeats < pool.length) {
    return { infeasible: true, reason: "floors-exceed-house", seats: null,
             minimumHouse: asideSeats + pool.length, ...common };
  }
  const quotient = pool.reduce((a, u) => a + pop(u), 0) / poolSeats;
  const seats = {};
  for (const u of aside) seats[u.code] = u.current_seats;
  for (const u of pool) seats[u.code] = Math.max(1, Math.round(pop(u) / quotient));
  const total = Object.values(seats).reduce((a, b) => a + b, 0);
  return { infeasible: false, reason: null, seats, minimumHouse: asideSeats + pool.length,
           total, exact: total === houseSize, quotient, ...common };
}

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

  if (method.direct) return commissionAllocate(active, absent, houseSize, pop, opts);

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

  const done = (seats, reason = null) => ({
    infeasible: seats === null, reason, absent, seats,
    floors, ceilings: maxChange !== null ? ceilings : null, minimumHouse, maximumHouse,
  });
  const sumOf = o => Object.values(o).reduce((a, b) => a + b, 0);
  /* `current` rides along so a method can weight by the existing allocation
     rather than by population. Every population-based method ignores it. */
  const payloadOf = us => us.map(u => ({ code: u.code, weight: pop(u), current: u.current_seats }));

  /* The method's UNCONSTRAINED answer over every active unit. Used only to rank
     units in the repair pass below, so a seat added or removed to make the
     total come out goes to whichever unit sits furthest from what the method
     itself wanted. Huntington-Hill seeds a seat per unit and cannot run below
     that, so this is skipped when the house is smaller than the unit count. */
  let want = null;
  if (houseSize >= active.length) {
    try { want = method.run(payloadOf(active), houseSize, opts); } catch { want = null; }
  }

  const locked = {};
  /* The locked set grows by at least one unit per iteration that changes
     anything, so this cannot run longer than the number of units. */
  for (let guard = 0; guard <= active.length + 1; guard++) {
    const free = active.filter(u => !(u.code in locked));
    if (free.length === 0) break;

    const remaining = houseSize - sumOf(locked);
    const freeFloor = free.reduce((a, u) => a + floors[u.code], 0);
    const freeCeil  = free.reduce((a, u) => a + ceilings[u.code], 0);

    /* If what is left cannot be spread across the free units without breaking
       their own bounds, the method has nothing to decide: pin them all on the
       binding side and let the repair pass settle the difference. This also
       keeps Huntington-Hill out of the state where it has fewer seats than
       units, where it throws. */
    if (remaining <= freeFloor) { for (const u of free) locked[u.code] = floors[u.code]; break; }
    if (remaining >= freeCeil)  { for (const u of free) locked[u.code] = ceilings[u.code]; break; }

    const result = method.run(payloadOf(free), remaining, opts);

    let changed = false;
    for (const u of free) {
      if (result[u.code] < floors[u.code]) { locked[u.code] = floors[u.code]; changed = true; }
      else if (result[u.code] > ceilings[u.code]) { locked[u.code] = ceilings[u.code]; changed = true; }
    }
    /* Nothing is outside its band, so the method's own answer stands, and it
       already sums to the house size exactly. This is the normal exit. */
    if (!changed) return done({ ...locked, ...result });
  }

  /* ---- repair pass -------------------------------------------------------
     We reach here only when every unit finished pinned at a bound, which
     happens once the constraints are tight enough that the method has no room
     left to decide anything. Those pins need not sum to the house size, and
     returning them anyway would silently break the one guarantee this engine
     makes. So the difference is settled explicitly.

     Seats move one at a time to, or from, the unit currently furthest from the
     method's own unconstrained answer, ties broken by code. That is the
     adjustment which deviates least from what the rule wanted, and it is fully
     deterministic. Global feasibility was checked above, so the slack to do it
     always exists. */
  const seats = { ...locked };
  let diff = houseSize - sumOf(seats);
  const pressure = u => (want ? want[u.code] - seats[u.code] : pop(u) / Math.max(1, seats[u.code]));

  let guard = 0;
  while (diff !== 0) {
    const dir = Math.sign(diff);
    const room = active.filter(u => (dir > 0 ? seats[u.code] < ceilings[u.code]
                                             : seats[u.code] > floors[u.code]));
    if (!room.length || guard++ > houseSize + active.length) {
      return done(null, "did-not-converge");
    }
    room.sort((a, b) => (pressure(b) - pressure(a)) * dir || (a.code < b.code ? -1 : 1));
    seats[room[0].code] += dir;
    diff -= dir;
  }
  return done(seats);
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
