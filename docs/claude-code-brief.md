# Build brief: an interactive Lok Sabha seat apportionment tool

Paste this whole document as your opening message to Claude Code. It is written
to be read once, in full, before any code is written.

---

## 0. How I want you to work

Do not start writing application code on your first turn.

Work in the phases set out in section 9. Each phase ends at a checkpoint where
you stop, show me what you have, and wait. The data phase in particular must
finish and be verified before a single line of visualisation code exists,
because every design decision downstream depends on what the data actually
turns out to be.

Verify claims in this brief rather than trusting them. I wrote it with a
research assistant and the numbers were checked, but some are from a 2026
snapshot and the legislative position is live. Where this brief states a fact
you can check, check it, and tell me if it is wrong. Where it states a fact you
cannot check, flag that rather than proceeding on faith.

Never invent a number. If a figure is needed and cannot be sourced, the
correct action is to stop and tell me, not to approximate. The entire
credibility of this project rests on a reader being able to audit every value
back to an official source. A single fabricated population figure destroys it.

Ask before you assume. If a spec item here is ambiguous, ask. I would rather
answer four questions than review a wrong build.

---

## 0a. You are not starting from zero

A starter kit ships with this brief. Read `DATA-NOTES.md` in it first, then this
section.

    data/units.json         36 present-day units, 2011 population, current seats,
                            zonal council, label points, per-field source notes
    data/concordance.json   state-formation lineages for the historical series
    data/reference.json     published projection table as a test fixture
    js/apportion.js         six methods, constraint locking, quota checking
    scripts/build_units.py  regenerates units.json, refuses to write on bad invariants
    test/run.js             46 assertions, all passing

`node test/run.js` should print 46 passed, 0 failed before you change anything.
If it does not, stop and tell me, because something is wrong with the
environment rather than with the code.

This changes the phases. Phase 2 becomes verification and extension rather than
construction. Phase 3 becomes review and extension of an engine that already
reproduces the published projection table.

**Treat the kit as a strong draft, not as settled.** Specifically:

- Five units have derived rather than sourced 2011 populations, flagged
  `verified: false` in the file with instructions for checking each. Verify them.
- The Telangana figure is a genuine trap with competing published values, only
  one pairing of which reconciles to the undivided total. The file explains it.
  Resolve it from district tables.
- Three concordance entries are marked `to_source` because district lists could
  not be confirmed.
- Everything in the kit is the 2011 series only.

Three findings are already established and asserted in the test suite. Confirm
each independently before it appears in published copy.

1. The engine reproduces the published projections exactly on merged units.
2. Protecting every unit at a house of 543 moves zero seats, so the constraint
   is arithmetically identical to the freeze.
3. Largest remainder, the method behind every published delimitation
   projection, exhibits the Alabama paradox on this data inside the relevant
   range. Across house sizes 543 to 900 there are 33 instances of a unit losing
   a seat as the house grows. Uttarakhand falls from 5 to 4 at a house of 548,
   which is itself the total of the published unchanged-strength column. The
   divisor methods produce none.

Finding 3 is the most original thing this project has and it needs the most
scepticism. Re-derive it yourself before we publish a word of it.

---

## 1. What this is

An interactive static website that lets a reader set the rules of Lok Sabha
seat apportionment and see who gains and who loses.

**The argument the site makes.** Seat allocation between Indian states has been
frozen on the 1971 Census since the 42nd Amendment in 1976. Unfreezing it is
not one calculation with one answer. Proportional allocation can be implemented
by at least six different well-established rules, those rules disagree by
dozens of seats for large states, and the choice of rule is a political choice
wearing the costume of arithmetic. Almost every published treatment of
delimitation reports a single rule's output as though it were the number. The
site exists to show that it is one rule's output among many.

**Why it matters now.** On 17 April 2026 the Constitution (131st Amendment)
Bill, 2026, which would have raised the Lok Sabha ceiling from 550 to 850
seats, was defeated in the Lok Sabha. It received 298 votes against the 352
needed for a two-thirds majority of members present. The Delimitation Bill,
2026 and the Union Territories Laws (Amendment) Bill, 2026 were withdrawn the
same day because both depended on the constitutional amendment. A revised
package aimed at the 2029 general election is expected. Verify the current
status of all three bills before writing any of the site copy, because this may
have moved since the brief was written.

That failure gives the tool a concrete job. Any real proposal has to clear
two-thirds of the Lok Sabha, which means it has to be acceptable to states
losing share. The question the site poses is whether any allocation rule both
corrects malapportionment and survives that vote.

**Audience.** Indian policy researchers, journalists, civil servants, and
engaged readers. Assume intelligence and assume impatience. Assume many will
arrive on a phone.

**Deliverable.** A static site served by GitHub Pages. No build step, no
bundler, no server, no framework. HTML, CSS, and JavaScript modules loaded
directly, with D3 v7 from a CDN. It must still work untouched in three years.

---

## 2. Non-negotiables

These are gates, not preferences. Do not proceed past any of them.

### 2.1 Map depiction

The map must depict India's external boundaries in accordance with Survey of
India standards. This is a legal requirement, not an aesthetic preference, and
it is the reason I am specifying it at this length.

Under the Guidelines for acquiring and producing geospatial data and geospatial
data services including Maps, issued by the Department of Science and
Technology on 15 February 2021, licences, approvals and security clearances
were removed for Indian entities, replaced by a self-certification regime.
Indian entities may freely publish and disseminate maps. What the 2021
Guidelines did not change is the requirement that political maps of India
comply with Survey of India standards. Publishing maps that depict inaccurate
external boundaries is treated as questioning the territorial integrity of
India and carries penal consequences.

Practically this means the map must show, as part of India:

- The whole of Jammu & Kashmir as claimed, including Pakistan-administered
  territory and Gilgit-Baltistan.
- Aksai Chin as part of Ladakh.
- The whole of Arunachal Pradesh.

Most open GeoJSON of India circulating on GitHub is derived from Natural Earth
or similar international sources and draws the Line of Control and the Line of
Actual Control as international boundaries. That depiction is not acceptable
here and using it by accident is the single most likely serious failure in this
project.

**Gate.** Before writing any map rendering code, you must:

1. Identify candidate boundary sources and report them to me with licence
   terms. Start with the Survey of India Online Maps Portal, Bhuvan (NRSC /
   ISRO), data.gov.in, the Local Government Directory, and DataMeet's maps
   repository. Note that several community aggregations claim Survey of India
   provenance under CC0 or CC-BY. Treat every claim of provenance as unverified
   until you have inspected the geometry.
2. Inspect the actual geometry of any candidate. Check specifically whether
   Gilgit-Baltistan and Aksai Chin are inside the India polygon, and whether
   Arunachal Pradesh is complete. Render a quick check image and show it to me.
3. Report which candidate passes, with your evidence, and wait for me to
   confirm before you build on it.

If nothing clean is available, tell me. I will source it. Do not proceed with a
non-compliant file and a disclaimer, and do not silently fall back to a
non-geographic visual.

Also add a visible cartographic note on the page stating the source of the
boundary data and the date it was obtained.

### 2.2 No fabricated data

Every population figure, seat count, and legislative fact traces to a named
source recorded in the data file itself. If you cannot source it, you stop.

### 2.3 Exact allocation

Every allocation must sum exactly to the house size the user has set. Published
projection tables often do not, because they round each state independently.
Ours always does, and the methodology note says why.

### 2.4 No build step

If you find yourself wanting npm, a bundler, TypeScript compilation, or a
framework, the answer is no. Node is fine as a development-time tool for the
test suite and for data preparation scripts. It must not be needed to serve
the site.

---

## 3. Data phase

### 3.1 Administrative units

The first cut of this project merged Andhra Pradesh with Telangana and Jammu &
Kashmir with Ladakh, on the incorrect reasoning that their seats were never
split. They were. Andhra Pradesh holds 25 Lok Sabha seats and Telangana 17,
together the 42 that the undivided state held. Jammu & Kashmir holds 5 and
Ladakh 1, together the 6 that the undivided state held. Verify both splits
against the First Schedule of the Representation of the People Act, 1950 as
amended, and against Election Commission records.

This means the unit list must be built from the present-day administrative map,
not from the 2011 one, and that 2011 population must be derived for units that
did not exist in 2011 by aggregating Census 2011 district tables:

- Telangana: aggregate the ten districts that transferred at the 2014
  reorganisation.
- Andhra Pradesh residual: the remainder.
- Ladakh: aggregate Leh and Kargil districts.
- Jammu & Kashmir residual: the remainder.

Also resolve, and tell me your recommendation with reasoning for each:

- Dadra & Nagar Haveli and Daman & Diu merged into a single union territory in
  2020 but retain two Lok Sabha seats. Decide whether the tool treats this as
  one unit with two seats or as two units, and note the consequence for
  allocation rules that guarantee a minimum per unit.
- Whether the unit list should be 36 entries or some other count after these
  decisions, and state the count explicitly in the data file header.

Every unit record carries: code, name, 2011 population, current seat count,
region grouping, and a per-field source note.

### 3.2 Population series

Build the 2011 series first and get the site working on it.

Then add, as separate columns with a year selector in the interface:

- **Projections to 2026 and 2036.** The Report of the Technical Group on
  Population Projections constituted by the National Commission on Population,
  published by the Ministry of Health and Family Welfare in 2019, contains
  state-wise projections. Obtain it, extract the state tables, and record the
  page reference for each. These matter because 2011 is fifteen years stale and
  the southern states' projected loss on 2036 numbers is materially worse than
  on 2011 numbers, which is the single most under-reported fact in this debate.
- **Historical censuses: 1971, 1981, 1991, 2001.** This is the hardest data
  task in the project and also the one that produces the most shareable output,
  because it lets the site run the same rule at each census and animate the
  divergence accumulating rather than arriving all at once in 2029.

The historical series requires reconciling states that did not exist at the
time. Jharkhand separated from Bihar in 2000, Chhattisgarh from Madhya Pradesh
in 2000, Uttarakhand from Uttar Pradesh in 2000, Telangana from Andhra Pradesh
in 2014, and the 2019 reorganisation of Jammu & Kashmir. Handle this by
building the historical series at district level and aggregating up to
present-day units, so that the whole series is expressed in today's boundaries
throughout. Where a district itself was split or renamed, document the mapping
in a dedicated concordance file with a source for each mapping decision. If a
particular reconciliation cannot be done defensibly, exclude that census year
from the series and say so on the page rather than fudging it.

Treat the concordance file as a deliverable in its own right. It is genuinely
useful to other people and it is the kind of thing that gets a project cited.

### 3.3 Reference table for validation

PRS Legislative Research published a state-wise annexure to its analysis of the
Delimitation Bill, 2026, under a CC BY 4.0 licence. It gives 2011 population,
current seats, projected seats at unchanged strength, and projected seats at a
fifty percent increase, for all units. Obtain it and store it as a fixture for
the test suite.

Known properties of that table, confirmed during the first cut and useful as
test assertions:

- At a house of 543 under largest-remainder proportional allocation: Uttar
  Pradesh 89, Bihar 46, Rajasthan 30, Tamil Nadu 32, Kerala 15.
- At a house of 815 under Huntington-Hill: Uttar Pradesh 133, Tamil Nadu 48,
  Kerala 22.
- Their published columns total 548 and 813 rather than 543 and 815, because
  each unit is rounded independently and a small-state exception is applied by
  hand.

Note that these reference numbers were produced on the merged units. Once you
split Andhra Pradesh from Telangana and Jammu & Kashmir from Ladakh, totals for
those units will not match the reference table directly, and you should expect
small movements elsewhere from changed remainder ordering. Build the test
suite so it validates against the merged configuration as a historical check
and against the split configuration as the live one, and document the
difference rather than hiding it.

---

## 4. The apportionment engine

This is the part that has to be unimpeachable. Put it in its own module with no
DOM dependencies so it can be tested in Node directly.

### 4.1 Methods

Implement all of the following. For each, write a short comment explaining what
it does to the size bias, because that is the point of having six.

| Rule | Mechanism |
|---|---|
| Largest remainder, Hare quota | Quota is total population over house size. Each unit takes the floor of its exact entitlement, leftover seats go to the largest fractional remainders. This is the rule behind most published projections. |
| Huntington-Hill | Every unit seeded with one seat, then each further seat to the highest value of population over the geometric mean of current and next seat count. Used for the US House. Mildly favours small units. |
| Sainte-Lague (Webster) | Divisors 1, 3, 5, 7. Least size-biased of the divisor methods. |
| D'Hondt (Jefferson) | Divisors 1, 2, 3, 4. Systematically favours large units. |
| Cube root of population | Allocation proportional to the cube root of population. Compresses the range sharply. |
| Base plus proportional | A guaranteed base per unit, remainder proportional, divisor found by search so totals land exactly. The shape of the Cambridge Compromise used for the European Parliament. Base is user-adjustable. |

Research each before implementing. Do not implement from memory. In particular
check the Balinski and Young results on apportionment paradoxes, because the
site should say which of these methods can exhibit the Alabama paradox and the
population paradox, and largest remainder is the one that can. That is a real
and underappreciated argument against the method everyone currently quotes, and
it belongs in the methodology note.

Consider adding a quota-violation indicator: flag when a method gives a unit a
seat count outside its lower and upper quota. Divisor methods can do this and
it is a legitimate criticism of them. If you add it, explain it in plain
language in the interface.

### 4.2 Constraints

- A hard minimum of one seat per unit always applies.
- Optional: no unit loses a seat relative to its current allocation.
- Optional: units below a population threshold do not lose seats. Default the
  threshold to 60 lakh, which is the exception assumed in published
  projections, and make it adjustable.
- Consider a maximum-change-per-unit constraint as a fourth option, since
  phased transitions are a real proposal in this debate.

Enforce constraints by locking. Run the method, lock any unit that lands below
its floor at exactly its floor, then re-run the method on the remaining units
for the remaining seats. Repeat. This terminates because the locked set only
grows, and it works uniformly across every method. This approach was validated
in the first cut and I would keep it.

Handle infeasibility explicitly. If the sum of floors exceeds the house size,
return a structured infeasible result carrying the minimum viable house size,
and have the interface offer a one-click fix rather than failing silently.

### 4.3 Test suite

Plain Node, no test framework, run with `node test/run.js`. Assert at minimum:

1. Every method, at every house size from 400 to 1100, allocates exactly the
   house size.
2. Every method respects the one-seat minimum.
3. Reference-table matches at 543 and 815 as set out in section 3.3.
4. Floors are respected when constraints are on, under every method.
5. Infeasible combinations return the infeasible result rather than throwing or
   silently truncating.
6. Monotonicity spot-checks: increasing the house size never reduces any unit's
   seats under the divisor methods. Deliberately include a case that
   demonstrates largest remainder violating this, and use it in the
   methodology note.
7. A fixed-seed regression fixture: a JSON snapshot of full allocations for a
   handful of parameter combinations, so refactors cannot silently change
   outputs.

---

## 5. What the site shows

### 5.1 Controls

- House size, slider plus number entry, range 400 to 1100.
- Population year selector, once the series exists.
- Method dropdown, with a plain-language note that updates on selection.
- Base seats input, shown only when base-plus-proportional is selected.
- Constraint checkboxes with short explanations of what each does politically,
  not just mechanically.
- Presets. At minimum: the current house, the 2026 proposal, and a
  nobody-loses configuration. Presets should encode arguments, so each one gets
  a one-line caption explaining what it demonstrates.
- Deep linking. Encode the full control state in the URL query string and
  restore from it on load, so a reader can send someone a specific scenario.
  This is what makes the tool usable in an argument, which is what it is for.

### 5.2 Primary view: the map

A choropleth of India using compliant Survey of India boundaries, states and
union territories coloured by seat change. Diverging scale, gains one way,
losses the other, no change neutral. The scale must be colour-blind safe and
must not rely on red versus green.

Include a toggle between colouring by absolute seat change and by proportional
change, because the two tell different stories and small states only show up
under the second.

Hover and tap give a readout: current seats, new seats, change, people per MP,
and vote weight against the national average. Make sure this works on touch,
not just hover.

### 5.3 Secondary view: seat blocks

One block per unit, one small square per seat. Within a block, show seats kept
as filled neutral, seats gained as filled in the gain colour, and seats lost as
hollow outlined squares in the loss colour, so each block shows both the new
allocation and what was displaced. This worked well in the first cut and is
worth keeping.

### 5.4 Panels

- **Share of the house** by region, showing the new share as a bar with the
  current share as a mark on it. State plainly on the page that regional
  groupings are analytical and not official, and list their membership.
- **Vote weight**, most and least over-represented units, expressed as people
  per MP against the national average where 1.00 is average. The sentence "a
  vote here is worth 0.6 of a vote there" is the sharpest thing this data says
  and the interface should make it easy to reach.
- **Full table**, every unit, sortable by column, with a CSV export button. The
  export is important. It is what turns this from a thing people look at into a
  thing people cite.

### 5.5 Copy

Short, specific, no throat-clearing. The methodology note must be complete
enough that a hostile reader can reconstruct every number. Include the
reference-table validation results and explain the discrepancy in totals rather
than glossing it.

One finding from the first cut that belongs prominently in the copy: set the
house to 543 and switch on "no unit loses a seat" and nothing changes at all.
Zero units move. At the current house size, protecting every state's absolute
seat count is arithmetically identical to keeping the freeze. That is the trap
the entire debate walks into and the site should say so.

---

## 6. Design

You have latitude here, with constraints.

Avoid the current generated-design defaults: cream background with high-contrast
serif and terracotta accent, near-black with a single acid accent, identical
rounded cards with identical soft shadows, all-caps tracked-out eyebrow labels,
arrows appended to link text.

The subject is constitutional arithmetic and contested federalism. Cool,
precise, and slightly austere fits it. Spend boldness in one place, which
should be the map, and keep everything around it quiet.

Requirements rather than suggestions: responsive to a phone, visible keyboard
focus, reduced motion respected, colour-blind-safe diverging scale, tabular
figures for all numbers, and every interactive control reachable and operable
by keyboard. The table must be readable on a narrow screen, which probably
means a horizontal scroll container with a pinned first column rather than
reflowing into cards.

---

## 7. Repository

```
index.html
css/                      styles
js/
  apportion.js            methods and constraint logic, no DOM
  data.js                 loads and normalises the data files
  map.js                  choropleth
  blocks.js               seat blocks
  panels.js               shares, vote weight, table
  app.js                  state, URL sync, wiring
data/
  units.json              units, seats, population series, per-field sources
  concordance.json        historical district-to-unit mapping with sources
  boundaries.topo.json    compliant simplified geometry
  reference.json          published projection table, as a test fixture
scripts/
  build-units.mjs         derives units.json from raw sources
  build-boundaries.mjs    simplification and projection pipeline
  raw/                    unmodified downloaded sources, committed
test/
  run.js
README.md
METHODOLOGY.md
SOURCES.md
```

Commit raw sources unmodified. The point is that anyone can re-run the scripts
and get the same data files, and check our transformations.

README covers what it is, how to run it, and the validation results.
METHODOLOGY covers the rules, the paradoxes, the constraint handling, and the
known limits. SOURCES lists every dataset with its URL, licence, date obtained,
and what was done to it.

Licence the code MIT. Respect the CC BY 4.0 terms on the PRS reference table
with proper attribution.

Simplify the boundary geometry aggressively. Target well under 400 KB for the
TopoJSON and check what it costs on a slow mobile connection. Report the number
to me.

---

## 8. Definition of done

- All tests pass.
- Boundary depiction verified against the section 2.1 gate and confirmed by me.
- 2011 series complete and sourced. Projection and historical series either
  complete and sourced, or explicitly documented as absent with the reason.
- Map, blocks, all three panels, CSV export, and deep linking all working.
- Keyboard navigable end to end, tested at 375px width, reduced motion
  respected.
- README, METHODOLOGY and SOURCES written.
- Deployed to GitHub Pages and loading correctly from the live URL, since path
  handling differs between local file serving and Pages.

---

## 9. Phases and checkpoints

The starter kit in section 0a means Phases 2 and 3 are verification and
extension rather than construction.

**Phase 1. Research and sourcing.** Run `node test/run.js` and confirm it
passes. Verify the legislative status of the three 2026 bills. Identify and
inspect boundary candidates against the section 2.1 gate. Locate the population
projection report, the historical census tables, and the primary Census 2011
tables needed to verify the five derived units. Produce a written report of
what you found, file sizes, licences, and what you could not find.
**Stop. Wait for me.**

**Phase 2. Data verification and extension.** Verify the five derived
populations against district tables and report any discrepancy against what is
in the file. Fill the three `to_source` concordance entries. Add the projection
and historical series, updating `population_series_status` as each lands.
Extend `scripts/build_units.py` with invariants for every new series, so bad
data still cannot be written. Show me the derived numbers alongside the totals
they reconcile to. **Stop. Wait for me.**

**Phase 3. Engine review and extension.** Read `js/apportion.js` critically and
tell me anything you would change, particularly in the tie-breaking and in the
bisection settle-up inside `baseProportional`. Add the maximum-change-per-unit
constraint. Write `test/snapshot.json` from the section 9 scenarios and assert
against it. Extend the suite to cover every population series. Independently
re-derive the Alabama paradox result. **Stop. Wait for me.**

**Phase 4. Boundary pipeline.** Simplify, project, produce the TopoJSON, render
a static check image, show me the size and the image. The `label_point` values
already in `units.json` are approximate and exist for label placement, not for
geometry. **Stop. Wait for me.**

**Phase 5. Interface.** Build it. Show me a screenshot at desktop and at 375px
before you polish.

**Phase 6. Copy, docs, deploy.**

Start with Phase 1 now. Do not write application code yet.
