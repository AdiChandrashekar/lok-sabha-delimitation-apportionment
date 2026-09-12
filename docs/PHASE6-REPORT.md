# Phase 6 report: copy, docs, deploy

Date: 13 September 2026. **130 assertions, 0 failing.**

**Live: https://adichandrashekar.github.io/lok-sabha-delimitation-apportionment/**
**Repository: https://github.com/AdiChandrashekar/lok-sabha-delimitation-apportionment**

---

## 1. Definition of done

| Requirement | Status |
|---|---|
| All tests pass | 130 assertions, 0 failing |
| Boundary depiction verified against the §2.1 gate and confirmed | 15/15 on the final geometry, enforced by the test suite |
| 2011 series complete and sourced | Yes |
| Projection series complete and sourced, or absence documented | 2016–2036 complete, from RGI Table 21 |
| Historical series complete and sourced, or absence documented | 1971–2011 complete; 1901–1961 refused with reasons; three cells null by design |
| Map, blocks, all three panels, CSV export, deep linking | All working, verified on the live URL |
| Keyboard navigable end to end, 375px, reduced motion | Yes |
| README, METHODOLOGY, SOURCES written | Yes |
| Deployed to GitHub Pages and loading from the live URL | Yes, verified including deep links |

## 2. Documentation

- **README.md** — what it is, how to run it, how to regenerate every data file,
  and the validation results in full: the reference-table reproduction, the
  per-year reconciliation totals, and the three findings.
- **METHODOLOGY.md** — the ten sections a hostile reader needs. Every rule and
  its size bias; the two changes made to the engine and the measurements that
  justified them; tie-breaking; constraint locking *and* the repair pass, with
  the 594-instead-of-600 case named; the Alabama paradox with its independent
  exact-integer re-derivation and both qualifications; quota; the population
  series including the years refused and the cells left null; the Telangana
  resolution with the arithmetic closed to the person; and map depiction
  including the rejected DataMeet file.
- **SOURCES.md** — every dataset with URL, licence, retrieval date and exactly
  what was done to it. Includes the boundary candidates that were *rejected* and
  why, so the next person does not repeat the work, and records the PRS licence
  wrinkle (the page says CC BY 4.0; PRS boilerplate elsewhere says
  non-commercial) rather than picking the convenient reading.
- **LICENSE** — MIT for the code, with an explicit note that it does not cover
  the source data, which carries its own terms.

## 3. Label points, as promised in Phase 4

The hand-entered `label_point` values were eyeballed. They are now computed from
the shipped geometry as the **pole of inaccessibility** — the interior point
furthest from any boundary.

A centroid would not have done. Kerala is a thin coastal arc and Maharashtra
wraps around, so an area centroid can land in the sea or inside a neighbour. The
worst correction was Lakshadweep, whose hand-entered point sat *between* two
islands and moved 2.37°, onto Minicoy. Madhya Pradesh moved 1.66° and Andhra
Pradesh 1.58°.

`build_boundaries.mjs` writes `data/label-points.json`; `build_units.py` uses it
when present and falls back to the table values, so the script still runs
standalone. Each point now carries `source: "computed"`.

## 4. `package.json`

Added, containing a module-type declaration, a description of why it exists, and
four script aliases. **No dependencies.** It exists so the test suite runs on
Node older than 22.7, which would otherwise rely on automatic module detection.
It adds no build step and the site does not read it.

## 5. Weight

```
index.html                12.7 KB
css/style.css             16.2 KB
js/ (6 files)             62.3 KB
data/units.json           33.0 KB
data/boundaries.topo.json 45.3 KB

total                    169.5 KB raw,  55.7 KB gzipped
```

Plus d3 v7 from cdnjs, the single runtime dependency, used only for the
geographic projection and path generation. The TopoJSON decoder is twenty lines
in `data.js` rather than a second CDN dependency, because the site has to still
work untouched in three years.

## 6. Deployment and the live check

Public repository created under `AdiChandrashekar`, seven commits pushed, Pages
enabled from `main` at root, HTTPS enforced.

The brief warns that path handling differs between local serving and Pages, so
that was checked specifically rather than assumed. Every fetch is relative and
resolves correctly under the `/lok-sabha-delimitation-apportionment/` subpath:

```
36 map paths · 36 table rows · 36 seat blocks · 5 headline stats
32 paradox instances recomputed live · d3 loaded · no alerts · no console errors
```

**Deep linking verified on the live URL.** Loading
`?h=815&m=huntington&y=2036_proj&mc=12` restores all four controls and preserves
the query string, which is the failure mode a subpath would most likely have
caused.

## 7. What is deliberately still open

**The boundary provenance.** You chose to publish with the caveat stated, and
the caveat is stated — in the cartographic note on the page, in the data file's
own `source` block, and at length in `SOURCES.md`. To be exact about what is and
is not established: the geometry passes a fifteen-point test that the widely used
DataMeet/GADM file fails 8/15, and two things corroborate official derivation —
Census 2011 state codes as attributes, and Gilgit-Baltistan assigned to *Ladakh*,
which is the specific arrangement of the Survey of India map of November 2019.
Neither is a citation. Replacing this with a government-hosted equivalent
remains the single most worthwhile follow-up.

**The 2027 Census will obsolete the projection series**, and the legislative
status line is the most perishable sentence on the site. Both carry visible
dates.

**1971 and 1981 are in**, against the original instruction to defer them,
because they arrived already reconciled in the same parse and 1971 is the census
the freeze is pinned to. Flagged at the Phase 2 checkpoint and kept.

---

## Postscript: what building it changed

Three things in the starter kit turned out to be wrong, and all three were found
by trying to use them rather than by reading them.

The **Telangana reconciliation test** could not discriminate between the two
candidate figures, because they differ by a transfer *between the two units being
reconciled*. Both pairings sum to 84,580,777. The invariant had a hole exactly
where the trap was.

The **`baseProportional` settle-up** was a systematic transfer to the largest
states dressed as a rounding tidy-up, giving Uttar Pradesh 2.39 seats more than
its own share in a method whose purpose is protecting small units.

**`allocate` could return an allocation that did not sum to the house size** —
594 where 600 was asked for — which breaks the only guarantee the engine makes.
Building the interface found it; the test suite had checked that units stayed
inside their bands but never that the total was right.

The **Alabama paradox finding survived** all of it, including re-derivation in
exact integer arithmetic with no floating point. It is 32 instances rather than
33, and it belongs to the largest-remainder family rather than to one rule, but
Uttarakhand still falls from 5 seats to 4 at a house of 548 — which is still the
total of the published unchanged-strength column.
