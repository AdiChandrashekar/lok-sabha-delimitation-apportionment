# Who gets the seats

An interactive tool for Lok Sabha seat apportionment. Set the house size, the
allocation rule, the population series and the constraints, and see which states
gain and which lose.

**The argument.** Seat allocation between Indian states has been frozen on the
1971 Census since the 42nd Amendment in 1976. Unfreezing it is not one
calculation with one answer. Proportional allocation can be implemented by at
least six well-established rules, those rules disagree by dozens of seats for
large states, and the choice between them is a political choice wearing the
costume of arithmetic. Almost every published treatment reports a single rule's
output as though it were *the* number. This shows it is one rule's output among
many.

**Status as at 13 September 2026.** The Constitution (131st Amendment) Bill,
2026 — which would have raised the ceiling from 550 to 850 seats — was
negatived in the Lok Sabha on 17 April 2026, receiving 298 votes against the 352
needed for two-thirds of members present and voting. The Delimitation Bill, 2026
and the Union Territories Laws (Amendment) Bill, 2026 fell the same day; PRS
records the Delimitation Bill as *infructuous*. No revised bill has been
introduced.

---

## Running it

There is no build step, no bundler, no framework and no server-side anything.
The site is HTML, CSS and ES modules, with d3 v7 from a CDN.

```bash
# any static server; fetch() does not work over file://
python -m http.server 8123
# then open http://localhost:8123
```

## Tests

```bash
node test/run.js        # 130 assertions, no framework, no dependencies
```

Node 22.7 or newer. The engine and tests are ES modules with a `.js` extension
and there is no `package.json`, so they rely on Node's automatic module
detection.

## Regenerating the data

Each script validates its own output and refuses to write if an invariant fails.

```bash
python scripts/build_units.py           # data/units.json
python scripts/extract_projections.py   # projections, from the committed PDF
python scripts/extract_census_series.py # 1971-2011, from the committed workbooks
python scripts/verify_bhadrachalam.py   # proves the 2014 transfer arithmetic
node   scripts/build_boundaries.mjs     # data/boundaries.topo.json + check image
node   scripts/make_snapshot.mjs        # test/snapshot.json — only when intended
```

Python needs `pypdf`, `xlrd` and `openpyxl`, which are development-time only and
are never loaded by the site.

---

## Validation results

**Against the published projection table.** On the merged unit configuration
that PRS Legislative Research uses, the engine reproduces its figures exactly:

| | UP | BR | RJ | TN | KL | MH | WB |
|---|---|---|---|---|---|---|---|
| 543 seats, largest remainder | 89 | 46 | 30 | 32 | 15 | 50 | 40 |
| 815 seats, Huntington-Hill | 133 | — | 46 | 48 | 22 | 75 | 61 |

Published column totals are 548 and 813, not 543 and 815, because PRS rounds
each state independently and applies a small-state exception by hand to
Arunachal Pradesh, Goa, Manipur and Meghalaya. **Our allocations always sum
exactly to the house size**, and the difference is explained rather than hidden.

Splitting Andhra Pradesh from Telangana and Jammu & Kashmir from Ladakh moves
exactly one other unit: West Bengal goes from 40 to 41 at 543 seats, through
changed remainder ordering.

**Reconciliation.** Every population column reconciles to its own published
national total:

```
1971      548,159,652   exact       36/36 units
1981      665,287,849   exact       35/36   Assam not enumerated
1991      838,583,988   exact       34/36   J&K and Ladakh not enumerated
2001    1,028,737,436   exact       36/36
2011    1,210,854,977   exact       36/36
2016-2036                           within 1,000 of the published India row
```

**Boundary compliance.** The map depicts Jammu & Kashmir as claimed including
Gilgit-Baltistan, Aksai Chin as part of Ladakh, and Arunachal Pradesh complete.
This is verified by point-in-polygon test against fifteen landmarks **after**
simplification, as part of the test suite rather than by a script someone has to
remember to run. See `docs/boundary-check.svg`.

---

## Three findings

**Protecting every state at the current house size is the freeze.** Set the
house to 543 and switch on "no state loses a seat" and zero units move. At the
current size, protecting every state's absolute count is arithmetically
identical to keeping the freeze. That is the trap the debate walks into.

**Largest remainder — the rule behind every published projection — exhibits the
Alabama paradox on this data.** Across house sizes 543 to 900 there are **32**
instances of a state *losing* a seat as the house *grows*. Uttarakhand falls
from 5 to 4 at a house of 548, which is itself the total of the published
unchanged-strength column. The divisor methods produce none. Re-derived
independently in exact integer arithmetic, so it is a property of the rule and
the data rather than of this code.

**The southern loss on 2036 projections is roughly double the loss on 2011
numbers** — 30 seats against 17, at a house of 543 — and every published
projection quotes the 2011 figure.

---

## Layout

```
index.html
css/style.css
js/   apportion.js   methods and constraints, no DOM, testable in Node
      data.js        loading, normalisation, derived metrics
      map.js         choropleth
      blocks.js      seat blocks
      panels.js      shares, vote weight, table, CSV
      app.js         state, URL sync, wiring
data/ units.json            units, seats, the full population series, per-field sources
      concordance.json      state-formation lineages
      boundaries.topo.json  compliant geometry, 45 KB
      label-points.json     computed interior points, for labels only
      reference.json        published projection table, as a test fixture
scripts/  build and extraction pipeline; raw/ holds every source unmodified
test/     run.js, scenarios.mjs, snapshot.json
docs/     phase reports, boundary check image
```

`METHODOLOGY.md` covers the rules, the paradoxes and the constraint handling.
`SOURCES.md` lists every dataset with its URL, licence, date obtained and what
was done to it.

## Licence

Code MIT, see `LICENSE`. The PRS Legislative Research projection table is used
under CC BY 4.0 with attribution. Data from the Census of India and the
Registrar General is Government of India material.
