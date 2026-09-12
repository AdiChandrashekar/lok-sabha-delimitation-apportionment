# Methodology

This is written so a hostile reader can reconstruct every number on the site.
Where something is uncertain it is marked as uncertain rather than smoothed over.

---

## 1. What is being computed

Given a population figure for each of 36 units, a house size *H*, an allocation
rule and a set of constraints, produce a whole number of seats for every unit
summing **exactly** to *H*.

Exactness is not decorative. Published projection tables usually do not sum to
their own stated total: the PRS annexure this tool validates against totals 548
and 813 where it should total 543 and 815, because each state is rounded
independently and a small-state exception is applied by hand to four units. That
is a defensible way to present an illustration and an indefensible way to build
a tool, because a reader cannot tell which seats are real and which are rounding.

## 2. The units

36 states and union territories, on the **present-day** administrative map.

- Andhra Pradesh and Telangana are separate, splitting the undivided state's 42
  seats 25 and 17.
- Jammu & Kashmir and Ladakh are separate, splitting 6 seats 5 and 1.
- Dadra & Nagar Haveli and Daman & Diu is **one unit holding two seats**,
  matching its legal status since 26 January 2020.

That last decision is not cosmetic. Modelled as one unit with a one-seat
minimum, it receives 1 seat at a house of 543 against the 2 it holds today,
because its 586,956 people are about a quarter of a quota. Modelled as two units
it would receive 2. We keep the legal status and disclose the consequence,
rather than letting the data grant a rounding favour that the law does not.

## 3. The rules

| Rule | Mechanism | Size bias |
|---|---|---|
| **Largest remainder, Hare quota** | Quota is total population over house size. Each unit takes the floor of its exact entitlement; leftover seats go to the largest fractional remainders. | Essentially neutral. Never violates quota. Can exhibit the Alabama paradox. |
| **Huntington-Hill** | Every unit seeded with one seat, then each further seat to the highest population divided by √(n(n+1)). Used for the US House. | Mildly favours small units. |
| **Sainte-Laguë (Webster)** | Divisors 1, 3, 5, 7. | Least size-biased of the divisor methods. |
| **D'Hondt (Jefferson)** | Divisors 1, 2, 3, 4. | Systematically favours large units. |
| **Cube root of population** | Largest remainder applied to the cube root of population. | Compresses hard: a unit four times larger gets about 1.6 times the seats. |
| **Base plus proportional** | A guaranteed base per unit, remainder distributed proportionally. The Cambridge Compromise shape used for the European Parliament. | Set by the base. A larger base protects small units at the direct expense of large ones. |
| **Uniform scaling** | Seats in proportion to each state's *current* allocation. | **Not an apportionment rule.** Included because it is the shape of the uniform increase offered during the April 2026 debate, and because seeing that it moves nobody's share is more convincing than being told so. |

### A change from the first implementation

`baseProportional` originally found a divisor by bisection and then settled the
leftover seats by cycling through units *largest first*. That settle-up was not
neutral. Measured against an exact base-plus-proportional share at a house of
815 it gave Uttar Pradesh 127 seats against an ideal of 124.61, Bihar +1.12 and
Maharashtra +1.05, while essentially every small unit undershot by about 0.8 of
a seat — the opposite of what the method exists to do. It also produced 62
house-monotonicity violations between 500 and 900, none inherent to the method.

It now gives every unit its base and distributes the remainder by largest
remainder. That is exact by construction, needs no bisection, no guard loop and
no silent failure path, and confines the size bias to the base itself where a
reader can see it. Maximum deviation falls from 2.39 seats to 0.50, and no unit
is off by a whole seat.

### Tie-breaking

Every method is deterministic. Where two units have an equal claim the tie is
broken **by unit code, ascending** — never by array order. This matters more
than it looks: array order is the order of `units.json`, so an order-dependent
tie-break would make the published allocation depend on how the data file
happens to be sorted. Exact ties are rare with real population data but the
property should not rest on that.

## 4. Constraints

- **One seat per unit** always applies and cannot be switched off.
- **No unit loses a seat**: floor at its current allocation.
- **Small units do not lose seats**: the same, for units below a population
  threshold. The default of 60 lakh is the published assumption — the PRS
  footnote states the exception explicitly and applies it to Arunachal Pradesh,
  Goa, Manipur and Meghalaya.
- **Maximum change per unit**: a cap of ±K seats against the current
  allocation. Unlike the others this is **two-sided**, so it needs ceilings as
  well as floors.

Constraints are enforced by **locking**. Run the method; pin any unit that lands
outside its band at exactly the bound it broke; re-run on what is left, for the
seats that are left. The locked set only grows, so this terminates, and it works
uniformly across every rule.

### Where locking is not enough, and what happens then

With two-sided bounds the loop can finish with *every* unit pinned, and the sum
of those pins need not equal the house size. This is not hypothetical: largest
remainder at a house of 600 with a cap of 2 pinned 28 units at their ceiling and
8 at their floor, totalling 594.

Returning that would break the guarantee in §1, so there is an explicit **repair
pass**. The difference is settled one seat at a time, each going to — or being
taken from — the unit currently furthest from the method's own *unconstrained*
answer, with ties broken by code. That is the adjustment which deviates least
from what the rule wanted, and it is fully deterministic. Global feasibility is
checked before the loop runs, so the slack to do this always exists.

When the cap makes the house size unreachable at all, the tool says so and
offers the nearest feasible size rather than failing silently. A cap of ±5, for
instance, cannot produce a house larger than **723** — well short of the 815
states-side figure in the 2026 bill. A phased transition and that expansion are
not simultaneously satisfiable.

## 5. The Alabama paradox

Largest remainder can take a seat away from a state when the house **grows**.
This is a known defect of the method — see Balinski and Young, *Fair
Representation* — and it happens on this data inside the politically relevant
range.

Across house sizes 543 to 900 on the 2011 series there are **32** instances.
Uttarakhand falls from 5 to 4 at a house of 548, and 548 is itself the total of
the published unchanged-strength column. Odisha falls from 21 to 20 at 595.

**Why you should believe it.** Finding the paradox with the same code that
implements the rule is circular: a bug in the implementation, or a
floating-point comparison of nearly equal remainders, could manufacture one. The
test suite therefore re-derives it from scratch in **exact integer arithmetic**.
For unit *i* the entitlement is *wᵢH/W*; the floor is BigInt integer division
and the remainder ordering is the ordering of *(wᵢH) mod W*, with no division
and no floating point anywhere. The one-seat locking is reimplemented too, so
the comparison is like-for-like. The two agree seat for seat at every house size
from 400 to 1100.

Two qualifications that belong with the claim:

- The count is **32, not 33**. An earlier figure of 33 was computed on the
  superseded Telangana population; Haryana 12→11 at 560 was in that list and is
  not in this one. Nothing in the interface hardcodes an instance — they are
  recomputed from whichever series is loaded.
- **Cube root and base-plus-proportional exhibit it too**, because both
  distribute by largest remainder. The honest framing is "the largest-remainder
  family", not "largest remainder alone". Huntington-Hill, Sainte-Laguë and
  D'Hondt produce no instances at all.

## 6. Quota

A unit's **quota** is the pair of whole numbers bracketing its exact
proportional entitlement. Largest remainder never leaves that bracket; divisor
methods can. Cube root and base-plus-proportional leave it almost everywhere,
which is expected, since neither is trying to be proportional to population.

The interface reports violations, and distinguishes a unit that is outside quota
because of the *rule* from one that is outside because a *constraint* pinned it.
The engine reports both and does not guess which is which.

## 7. Population series

**1971–2011** come from Census of India Table A-02, *Decadal variation in
population 1901–2011*, in which — by the Registrar General's own statement —
"the population figures for all the previous censuses in this table are adjusted
to the 2011 jurisdiction". That is why Jharkhand, Chhattisgarh and Uttarakhand
have figures back to 1971 without any hand-built district concordance: the
boundary reconciliation has already been done officially.

The two splits A-02 does not make are made here at district level, which is the
only defensible method:

- **Telangana** = Census district codes 532–541 of undivided Andhra Pradesh
- **Ladakh** = codes 003 (Leh) and 004 (Kargil) of undivided Jammu & Kashmir

**2016–2036** come from Table 21 of the *Report of the Technical Group on
Population Projections* (National Commission on Population, MoHFW, July 2020),
printed pages 259–260. Figures there are printed in thousands, so every
projected population is a multiple of 1000 and carries up to ±500.

### Years that are refused

1901–1961 are excluded and the extractor fails its own invariants if they are
restored. Goa, Daman and Diu were Portuguese territory until 1961 and sit
outside the Indian totals before then; Arunachal Pradesh and Puducherry are not
separately enumerated in several columns; and the Andhra Pradesh district rows
do not sum to the state row before 1941, so the Telangana split is not
derivable. Excluding a year is better than fudging it.

### Cells that are empty

Assam was not enumerated in 1981. Jammu & Kashmir and Ladakh were not enumerated
in 1991. Those cells are `null`. A-02 does print official interpolations and
they are preserved in `scripts/raw/census_series_a2.json`, but they are not
populations anyone counted, so the tool will not allocate on them. An allocation
run on 1981 or 1991 is missing a unit, the interface says so prominently, and
the shares are of a house that excludes it.

Sikkim acceded to India in 1975 and is outside the published 1971 national
total.

## 8. The Telangana figure

Two figures circulate for Telangana's 2011 population and **both reconcile** to
the undivided Andhra Pradesh total of 84,580,777, which is why no arithmetic
check can choose between them:

```
TS 35,193,978  +  AP 49,386,799  =  84,580,777
TS 35,003,674  +  AP 49,577,103  =  84,580,777
```

They are not rival estimates of one quantity. They measure two different
territories.

- **35,193,978** is the sum of the ten districts *as constituted at the 2011
  Census*. Census Table A-02 for Andhra Pradesh, district codes 532–541, gives
  exactly this.
- **35,003,674** is **Telangana as actually constituted**. The Andhra Pradesh
  Reorganisation Act 2014, as amended by Act 19 of 2014, transferred seven
  mandals of the Bhadrachalam division of Khammam district to Andhra Pradesh for
  the Polavaram project.

The difference is exactly **190,304**, and residual Andhra Pradesh moves the
same amount the other way — which is precisely why both pairings reconcile.

**This site uses 35,003,674**, because the unit holding 17 Lok Sabha seats is
present-day Telangana, not the 2011 districts. The Registrar General's own
Technical Group report independently prints Telangana at 35,004 thousand and
Andhra Pradesh at 49,577 thousand.

The arithmetic is closed to the person. Act 19 of 2014 transfers seven whole
mandals *less thirteen named revenue villages*. From the Census 2011 village
directory for Khammam:

```
seven mandals, 338 revenue villages     225,233
less the eleven retained rural villages  34,929
net transferred                         190,304
```

Sarapaka and Bhadrachalam are also retained but are enumerated as towns, so they
fall outside the rural village directory on both sides of the subtraction. Run
`python scripts/verify_bhadrachalam.py` to reproduce it. Note that the
*unamended* Act named a different, shorter list: Seetharama Nagar is not
retained under the amendment, and including it would break the reconciliation by
exactly its own population of 1,332.

### The residual caveat

Table A-02 is on 2011 **district** boundaries. For 34 of 36 units that is
today's map. For Andhra Pradesh and Telangana it is not: the seven Khammam
mandals sit inside the historical Telangana figures. The effect is 190,304
people in 2011 and a smaller, unquantified amount in earlier years. It is left
visible rather than patched, because patching earlier years would require
ratio-splitting a district, which the concordance file rules out as
indefensible.

## 9. Map depiction

The map shows India's external boundaries in accordance with Survey of India
standards: the whole of Jammu & Kashmir as claimed including Pakistan-
administered territory and Gilgit-Baltistan, Aksai Chin as part of Ladakh, and
the whole of Arunachal Pradesh.

Most open GeoJSON of India in circulation derives from Natural Earth, GADM or
similar international sources and draws the Line of Control and Line of Actual
Control as international boundaries. That depiction is not acceptable. The
widely used DataMeet/GADM file fails this test decisively: its northern extent
stops at 35.5°N and Gilgit-Baltistan, Muzaffarabad, Mirpur, Aksai Chin and
Shaksgam all fall outside its India polygon.

Compliance here is established by **testing the geometry**, not by trusting a
provenance claim. Fifteen landmarks are checked by point-in-polygon on the final
simplified file — twelve that must be inside and three controls that must be
outside — and the test also asserts that Aksai Chin, Shaksgam and
Gilgit-Baltistan are owned by *Ladakh specifically* and PoK by *Jammu &
Kashmir*. This runs as part of `node test/run.js`, so a regression fails the
build.

**Honest limitation.** The upstream repository states that its data is curated
from publicly available sources, declares no licence, and makes no Survey of
India claim. Our confidence rests on our own geometry test rather than on an
upstream assertion. A citable government-hosted equivalent would be better and
has not been found.

## 10. Known limits

- The 2016–2036 series are **projections**, made in 2019 and published in 2020.
  They predate both the 2027 Census and COVID-19 mortality.
- Projected figures carry up to ±500 from thousands-rounding.
- Regional groupings (south / Hindi-belt / everywhere else) drive one panel and
  are **not official**. The official grouping carried in `units.json` is zonal
  council membership, which cuts differently. Membership of the analytical
  groups is listed in the interface.
- Vote weight is people per MP against the national average. The smallest units
  always look extreme because a one-seat minimum guarantees it: Lakshadweep's
  64,473 people elect one MP under every rule. They are excluded from the
  headline comparison for that reason, and the exclusion is stated on the page.
- Seat counts are the total for each unit. This tool says nothing about
  constituency boundaries *within* a state, which is the other half of what a
  Delimitation Commission does.
