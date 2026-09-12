# Phase 3 report: engine review and extension

Date: 13 September 2026. **103 assertions, 0 failing**, up from 46.
No application code written.

---

## 1. Engine review

You asked specifically about the tie-breaking and the bisection settle-up. Both
were defective. Two other things were worth changing and several were worth
leaving alone.

### 1.1 `baseProportional` — the settle-up was not neutral

This was the real defect. The bisection landed near the house size and then a
loop cycled through units **"largest first"**, adding or removing seats until
the total matched. That loop is not a rounding tidy-up; it is a systematic
transfer.

Measured against an exact base-plus-proportional share at a house of 815:

| Unit | Got | Ideal | Error |
|---|---|---|---|
| Uttar Pradesh | 127 | 124.61 | **+2.39** |
| Bihar | 67 | 65.88 | +1.12 |
| Maharashtra | 72 | 70.95 | +1.05 |
| … | | | |
| Goa | 2 | 2.89 | −0.89 |
| Arunachal Pradesh | 2 | 2.85 | −0.85 |
| Meghalaya | 3 | 3.82 | −0.82 |

Three units were off by a whole seat or more, all of them the largest, and
essentially every small unit undershot by about 0.8 of a seat. For a method
whose entire purpose is to *protect small units*, that is the wrong direction.
It also produced **62 house-monotonicity violations** between 500 and 900,
nearly twice largest remainder's, none of which are inherent to the method.

**Changed.** Give every unit its base, then distribute the remainder by largest
remainder. Exact by construction; no bisection, no guard loop, no silent failure
path. Maximum error falls from 2.39 seats to **0.50**, and **no unit is off by a
whole seat**. The size bias is now confined to the base itself, where a reader
can see it and adjust it.

What moves, base 2:

```
H=543, 11 units:  AR ML GA HP JK NL +1 each;  BR 43->42  MP 31->30
                  MH 47->46  WB 38->37  UP 82->80
                  south +0   hindi -2   rest +2

H=815, 19 units:  UP 127->125  WB 59->58  TN 47->46  RJ 45->44  MH 72->71
                  KA 40->39  BR 67->66  AP 33->32  TS 24->23
                  plus +1 each to AR CH GA HR JK KL MN ML MZ PY
                  south -2   hindi -3   rest +5
```

The remaining monotonicity violations (60 at base 2) are now the *inherent*
Alabama paradox of the proportional part, which is honest: that is what
"proportional" costs, and the methodology note should say so.

I have kept the method's name and its description. If you would rather preserve
a genuine divisor search to stay literally faithful to the Cambridge Compromise,
say so and I will implement a correct one — but the settle-up version cannot
stay either way.

### 1.2 Tie-breaking — output depended on the data file's sort order

`highestAverages` used `if (p > bestPriority)`, so an exact tie went to whichever
unit came **first in the array**. That array is the order of `units.json`. The
allocation therefore depended on how the data file happened to be sorted, which
is not a property anyone would defend.

**Changed** to an explicit tie-break by unit code, documented in the header.
`largestRemainder` already did this correctly. Two new tests: reversing the unit
list must change nothing under every method, and four equal-weight units sharing
seven seats must split 2/2/2/1 by code.

### 1.3 `largestRemainder` wrapped around its own remainder list

The leftover loop was `remainders[i % remainders.length]`, so if the shortfall
ever exceeded the number of units, some units would silently receive two extra
seats. With a Hare quota the shortfall is strictly less than the unit count, so
that branch is unreachable — which means it could only ever have **hidden a
bug**. **Changed** to throw.

### 1.4 Non-convergence was reported as infeasibility

The locking loop ran to a guard of 200 and then returned `{ infeasible: true }`.
That conflates "your request cannot be satisfied" with "our algorithm failed",
and the interface would have told the user to change their house size when the
fault was ours. **Changed**: the result now carries a `reason`, and the guard
path returns `did-not-converge`. The guard is also now `units.length + 1`, which
is the actual bound the termination argument gives.

### 1.5 Missing populations threw

`pop()` threw on a null. With the historical series in, that means Assam in 1981
and Jammu & Kashmir and Ladakh in 1991 would crash the page. **Changed**: those
units are excluded and reported in `absent`, and the header says plainly that a
caller which does not surface `absent` is producing a misleading answer rather
than a smaller one. This is the engine half of your decision to offer those years
with a banner.

### 1.6 What I left alone, and why

- **The locking approach itself.** It is correct, terminates for the stated
  reason, and works uniformly across all six methods. Nothing to improve.
- **`highestAverages` linear scan.** O(H·N) is about 40,000 operations at the
  top of the range. A priority queue would be faster and harder to read. Not
  worth it.
- **Floating point in the divisor methods.** Populations are integers well
  inside the exact range of a double, and the divisors are small. I verified the
  one place it could matter — see §4.
- **`quotaViolations` flagging constraint-pinned units.** It reports them, which
  is correct, but the *cause* is the constraint rather than the method. I added
  a header note rather than changing behaviour, because the interface should
  distinguish the two and the engine should not guess.

---

## 2. New constraint: maximum change per unit

`opts.maxChange = K` caps every unit at `±K` seats against its current
allocation. It is two-sided, so unlike the existing constraints it needs
ceilings as well as floors; both are enforced by the same locking loop, and the
result reports `minimumHouse` **and** `maximumHouse` so the interface can offer
a one-click fix in either direction.

Behaviour worth knowing before you design the presets:

```
H=543  K=0    south 130  hindi 225  rest 188    all 36 units pinned
H=600  K=2    south 134  hindi 245  rest 215    30 units pinned
H=700  K=5    south 160  hindi 275  rest 257    30 units pinned
H=888  K=10   south 190  hindi 325  rest 347    32 units pinned
H=848  K=5    INFEASIBLE: ceilings below house. Max viable house is 723.
```

Two things fall out of this that belong in the copy.

**A capped transition protects the south substantially.** At 600 with K=2 the
south gets 134 seats, *more* than the 130 it holds today, where an uncapped
proportional run at 543 gives it 113. The cap, not the house size, is what
does the protecting.

**A ±5 cap cannot reach the proposed house at all.** With K=5 the maximum
viable house is **723**, well below the 815 states-side figure in the 2026 bill.
That is a concrete, checkable statement about a real proposal: a phased
transition and the proposed expansion are not simultaneously satisfiable at that
cap. The interface should surface `maximumHouse` prominently when this bites.

`maxChange: 0` at 543 reproduces the current house exactly, which is a useful
self-check and also a good preset — the freeze, restated as a constraint rather
than as a date.

---

## 3. Test suite: 46 → 103 assertions

New sections, all asserted rather than printed:

- **9. Regression snapshot.** `test/snapshot.json` is generated by
  `scripts/make_snapshot.mjs` from a scenario list shared with the runner, so the
  two cannot disagree about what is pinned. 20 scenarios covering every method,
  every constraint, and every series. It carries a **data fingerprint** (unit
  count, current seats, 2011 total) so that a data change is distinguishable
  from a code regression — otherwise the snapshot would fail confusingly the
  next time a population is corrected.
- **10. Every population series.** All six methods × six house sizes × all ten
  series: exact totals, one-seat floor, and correct absence reporting.
- **11. Absent units.** 1981 reports Assam absent and allocates 543 seats over
  35 units; 1991 reports J&K and Ladakh and allocates over 34.
- **12. Max-change.** Band respected for K ∈ {0,2,5,10} under every method;
  infeasibility distinguishes the floor side from the ceiling side; the fix
  values are reported.
- **13. Determinism.** Input order and exact ties.
- **14. Independent paradox re-derivation.** See below.

---

## 4. The Alabama paradox, re-derived independently

Section 7 finds the paradox using the engine itself, which is circular: a bug in
`largestRemainder`, or a floating-point comparison of nearly equal remainders,
could manufacture one.

Section 14 re-derives it from scratch in **exact integer arithmetic**. For unit
*i* the entitlement is `wᵢ·H/W`; the floor is BigInt integer division and the
remainder ordering is the ordering of `(wᵢ·H) mod W`, computed with **no
division and no floating point anywhere**. The one-seat locking is
reimplemented too, so the comparison is like-for-like rather than borrowing the
engine's.

Results:

- The exact implementation and the engine agree **seat for seat at every house
  size from 400 to 1100**.
- Both find the same **69 instances across 400–1100** and the same **32 across
  543–900**, the politically live range.
- **Uttarakhand falls 5 → 4 at H=548**, and 548 is the total of the published
  unchanged-strength column.
- No divisor method produces a single instance in the same range.

**The finding is real.** It is a property of the rule and of this data, not of
the arithmetic, and it now has a proof that does not depend on the engine under
test. This is the strongest claim in the project and it is the one I was most
prepared to lose.

Two honest qualifications for the copy:

1. The count is **32, not 33**. The 33 in the kit was computed on the old
   Telangana figure. Haryana 12→11 at 560 was in that list and is not in this
   one. Nothing should hardcode an instance; the interface must compute them.
2. **Cube root also exhibits it** (21 instances in the same range), because it
   is largest remainder applied to transformed weights, and the rewritten
   base-plus-proportional now does too. The honest framing is "the
   largest-remainder family", not "largest remainder alone".

---

## 5. Outstanding

Nothing blocking. Two small things for later:

- `package.json` with `{"type":"module"}` — still recommended, still not added,
  because it is cosmetic until someone runs the tests on Node < 22.7.
- The interface must distinguish quota violations *caused by a constraint* from
  those caused by the method. The engine reports both and does not guess.

Phase 3 is complete. Ready for Phase 4, the boundary pipeline, on your word —
the geometry is already downloaded, verified 15/15 and committed, and the states
layer is 5,026 points, so this should be quick.
