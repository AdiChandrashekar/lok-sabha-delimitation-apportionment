# Starter kit: data, engine, tests

Hand this to Claude Code alongside the build brief. It is everything that was
already sourced, derived and validated, so Phase 2 and Phase 3 of the brief
start from a working base instead of from scratch.

Everything here passes its own validation. Nothing here is exempt from
verification.

## What is in the box

    data/units.json         36 present-day units, 2011 population, current seats,
                            zonal council, label points, per-field source notes
    data/concordance.json   state-formation lineages for the historical series
    data/reference.json     published projection table as a test fixture
    js/apportion.js         six methods, constraint locking, quota checking
    scripts/build_units.py  regenerates units.json and fails loudly on bad invariants
    test/run.js             46 assertions, all passing

Run the tests:

    node test/run.js

Regenerate the data:

    python3 scripts/build_units.py

`build_units.py` writes nothing unless every invariant passes. Change a
population figure incorrectly and it refuses to produce a file.

## Invariants enforced at build time

- 36 units exactly.
- Current seats sum to 543.
- 2011 population sums to 1,210,854,977.
- Andhra Pradesh plus Telangana reconciles to undivided Andhra Pradesh.
- Jammu & Kashmir plus Ladakh reconciles to undivided Jammu & Kashmir.
- Dadra & Nagar Haveli plus Daman & Diu reconciles to the merged union territory.
- No duplicate unit codes.

## What is verified and what is not

Every unit carries a `population_source` key pointing into
`population_source_notes`, each of which has a `verified` boolean.

**Verified.** Thirty-one units take their 2011 population directly from the
published table and their seat count from the First Schedule. These still want
a cross-check against the Census primary abstract, but they are not derived.

**Not verified, derived.** Five units. Andhra Pradesh, Telangana, Jammu &
Kashmir, Ladakh, and the merged Dadra & Nagar Haveli and Daman & Diu. Each
carries a note explaining exactly how the number was obtained and what to check
it against. Do this before publication.

One of these is a genuine trap. Telangana's 2011 population appears in
circulation as 35,193,978 and as 35,003,674. Residual Andhra Pradesh appears as
49,386,799, as 49,471,555 and as 49,577,103. Only the pairing 35,193,978 with
49,386,799 reconciles to the undivided total of 84,580,777. The others do not.
The reconciling pair is what is in the file. Resolve it properly by summing
Census 2011 district totals for the ten transferred districts.

## Modelling decisions already taken

These are recorded inside `units.json` under `modelling_decisions`. Revisit any
of them, but revisit them deliberately.

Andhra Pradesh and Telangana are separate units, their 42 undivided seats split
25 and 17. Jammu & Kashmir and Ladakh are separate, their 6 split 5 and 1.
Dadra & Nagar Haveli and Daman & Diu is one unit holding two seats, matching its
post-2020 legal status. That last one is not cosmetic: modelling it as two units
would change the output of every rule with a per-unit minimum.

Two groupings are provided. `zonal_council` follows the States Reorganisation
Act 1956 and the North Eastern Council Act 1971, and is official.
`analytical_group` is a south, Hindi-belt, everywhere-else split that exists
only to drive the regional share panel. It is not official and the interface
must say so wherever it appears. Under the current allocation the analytical
split is 130 seats south, 225 Hindi-belt, 188 elsewhere.

## Findings already established, with their test assertions

**The engine reproduces the published table.** At 543 seats under largest
remainder, on merged units: Uttar Pradesh 89, Bihar 46, Rajasthan 30, Tamil Nadu
32, Kerala 15. At 815 under Huntington-Hill: Uttar Pradesh 133, Tamil Nadu 48,
Kerala 22. Asserted in section 3 of the test suite.

**Protecting every state at the current house size is the freeze.** Set the
house to 543 and switch on "no unit loses a seat" and zero units move. Asserted
in section 6.

**Largest remainder exhibits the Alabama paradox on this data, inside the
politically relevant range.** Running the method everyone quotes across house
sizes from 543 to 900 produces 33 instances where a unit loses a seat as the
house grows. At 548 Uttarakhand falls from 5 to 4. At 560 Haryana falls from 12
to 11. At 595 Odisha falls from 21 to 20. The divisor methods produce none, and
the test suite asserts both facts.

This is the most interesting thing the prototype turned up and it does not
appear anywhere in the Indian commentary on delimitation. Note that 548 is
itself the total of the published unchanged-strength column. Build the
interface so a reader can find these instances rather than burying the point in
a methodology note, and check the claim independently before publishing it.

**Huntington-Hill violates quota for Uttar Pradesh at 815 seats.** It gives UP
a seat count outside the interval bracketing its exact entitlement. Largest
remainder never violates quota. Cube root and base-plus-proportional violate it
almost everywhere, which is expected, since neither is trying to be
quota-respecting. `quotaViolations()` computes this and section 8 reports it.

## Engine interface

    import { allocate, METHODS, quotaViolations } from "./js/apportion.js";

    allocate(units, houseSize, methodKey, opts)

    opts.year            population series key, default "2011"
    opts.baseSeats       base for the baseProp method, default 2
    opts.protectAll      no unit falls below its current seats
    opts.protectSmall    small units do not fall below their current seats
    opts.smallThreshold  population cutoff for protectSmall, default 6000000

Returns `{ infeasible, seats, floors, minimumHouse }`. When floors cannot be met
within the house size, `infeasible` is true, `seats` is null, and `minimumHouse`
tells the interface what to offer the user.

Constraints are enforced by locking: run the method, lock any unit below its
floor at exactly its floor, re-run on the remainder. Terminates because the
locked set only grows, and works uniformly across all six methods.

## Still to source

`population_series_status` in `units.json` marks 1971, 1981, 1991, 2001, 2026
and 2036 as `to_source`. `concordance.json` holds the lineages needed to build
them, with three entries marked `to_source` where district lists were not
confirmed, and a hazards list covering the real holes: no 1981 census in Assam,
no 1991 census in Jammu & Kashmir, and Sikkim outside India in 1971. Those are
absences to display, not gaps to interpolate.

Boundary geometry is not in this kit. It is gated behind section 2.1 of the
build brief and must be resolved before any map code exists.
