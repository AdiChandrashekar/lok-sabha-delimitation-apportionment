# Phase 1 report: research and sourcing

Date: 12 September 2026. Nothing in `data/`, `js/` or `scripts/` has been modified.

---

## 1. Environment

Files arrived flat in the project root. I created the layout the brief specifies and
moved them in, unchanged:

    data/units.json  data/concordance.json  data/reference.json
    js/apportion.js
    scripts/build_units.py
    test/run.js
    docs/claude-code-brief.md  docs/DATA-NOTES.md

`node test/run.js` → **46 passed, 0 failed**, on the code exactly as shipped.

One environment caveat. `apportion.js` and `run.js` are ES modules with a `.js`
extension and there is no `package.json`. This works on Node 22.7+ only, which
detects module syntax automatically. It will fail with
`SyntaxError: Cannot use import statement outside a module` on older Node. Local
version is v24.18.0. Recommend adding a `package.json` containing only
`{"type": "module", "private": true}` — this is a module-type declaration, not a
build step, and does not affect the served site.

---

## 2. Claims in the brief that I checked and confirmed

| Claim | Status |
|---|---|
| Test suite passes 46/0 before any change | Confirmed |
| Engine reproduces PRS table, hare@543 merged: UP 89, BR 46, RJ 30, TN 32, KL 15 | Confirmed |
| Engine reproduces PRS table, huntington@815 merged: UP 133, TN 48, KL 22 | Confirmed |
| protectAll at 543 moves zero units | Confirmed |
| Largest remainder: **33** Alabama-paradox instances across H=543..900 | Confirmed, exactly 33 |
| UK falls 5→4 at H=548 | Confirmed |
| HR falls 12→11 at H=560 | Confirmed |
| OD falls 21→20 at H=595 | Confirmed |
| Divisor methods produce none in that range | Confirmed (huntington, Sainte-Laguë, D'Hondt all 0) |
| Current analytical split 130 south / 225 Hindi / 188 rest | Confirmed, sums to 543 |
| PRS column totals are 543 / 548 / 813 | Confirmed by re-adding the published table |
| 131st Amendment Bill defeated 17 April 2026 | Confirmed |
| 298 votes for, against 352 needed | Confirmed: 298 for, 230 against, 528 present and voting, two-thirds = 352 |
| Delimitation Bill and UT Laws Bill fell the same day | Confirmed |
| Current seats AP 25 / TS 17, JK 5 / LA 1 | Confirmed |
| PRS annexure is CC BY 4.0 | Confirmed on the PRS page, but see §6 |

I also re-derived the PRS Table 1 from source and compared it row by row against
`data/reference.json`. **Every row matches**, including the two separate rows for
Dadra & Nagar Haveli and Daman & Diu, and all three column totals.

The PRS footnote, verbatim, confirms the modelling assumption the brief asks us to
default to: *"Andhra Pradesh includes Telangana, and Jammu & Kashmir includes
Ladakh. We assume that the number of seats for Arunachal Pradesh, Goa, Manipur,
and Meghalaya will not be reduced as there is an exception for states with
population below 60 lakh."*

That names the four units the exception actually binds on. It is worth quoting on
the page, because it shows the published projection is not a pure rule output
either.

### Two additional results not in the kit

**Cube root also exhibits the Alabama paradox**, 21 instances across H=543..900.
Expected — it is largest-remainder applied to transformed weights — but the kit's
copy attributes the paradox to `hare` alone. The honest framing is "the
largest-remainder family", not "the method everyone quotes".

**Split vs merged at 543 under hare moves exactly one unit.** West Bengal goes
40 (merged) → 41 (split). AP+TS sums to 38 and JK+LA to 6, matching the merged
rows. The brief predicted "small movements elsewhere from changed remainder
ordering"; that movement is one seat, in West Bengal, and nothing else.

---

## 3. A claim in the kit that is wrong

`DATA-NOTES.md` and the `derived_ts` note in `units.json` both state:

> Only the pairing 35,193,978 with 49,386,799 reconciles to the undivided total of
> 84,580,777. The others do not.

**This is false.** Two of the circulating pairings reconcile exactly:

```
TS 35,193,978   AP 49,386,799   sum 84,580,777   RECONCILES   <- currently in units.json
TS 35,003,674   AP 49,577,103   sum 84,580,777   RECONCILES   <- also reconciles
TS 35,193,978   AP 49,471,555   sum 84,665,533   off by  +84,756
TS 35,003,674   AP 49,386,799   sum 84,390,473   off by -190,304
TS 35,193,978   AP 49,577,103   sum 84,771,081   off by +190,304
TS 35,003,674   AP 49,471,555   sum 84,475,229   off by -105,548
```

The two candidate figures differ by exactly 190,304, and the two residual-AP
figures differ by exactly the same amount. The reconciliation test therefore
cannot discriminate between them — it is satisfied by construction for any
complementary pair. The file's stated justification for its chosen figure does not
hold.

Three consequences:

1. **The build-time invariants do not catch this.** Both variants sum to
   1,210,854,977, so `build_units.py` writes either one happily. The AP+TS
   invariant is likewise satisfied by both. The guard rail the kit advertises has
   a hole exactly where the trap is.

2. **It changes real seat counts at the house size under discussion.** Swapping to
   the competing pair:
   - `hare@543` — no change
   - `hare@815` — Gujarat 40→41, Telangana 24→23
   - `huntington@815` — Telangana 24→23, Uttar Pradesh 133→134
   - `hare@848` — Andhra Pradesh 34→35, Tripura 3→2

   815 is the proposed states-side house size. This is not cosmetic.

3. **The weight of published evidence currently favours the figure NOT in the
   file.** 35,003,674 is the figure carried by the Telangana government and the
   standard secondary sources for the ten transferred districts. I have not yet
   summed the district tables, so I am not asserting it — I am flagging that the
   file's figure is the less-supported of the two and that its stated defence is
   invalid.

**This must be settled from primary district tables before anything is published.**
Concrete route identified: `data.gov.in` carries *Village/Town-wise Primary Census
Abstract, 2011 — Andhra Pradesh*, which aggregates to district and is machine
readable. Sourcing it is Phase 2 work and needs a decision from you (§7).

---

## 4. The boundary gate (section 2.1)

I wrote a geometry inspector that runs point-in-polygon tests against fifteen
landmarks rather than trusting any provenance claim. Twelve must fall inside India
as claimed; three must fall outside as controls.

### Candidate A — `datta07/INDIAN-SHAPEFILES`, `INDIA/INDIA_STATES.geojson`

**PASSES 15/15.**

```
National bbox   lon 68.094 .. 97.411    lat 6.754 .. 37.077
Features        37        Coordinate points  55,681      Raw size  2.23 MB

PASS  Gilgit (Gilgit-Baltistan)        inside, attributed to LADAKH
PASS  Skardu (Gilgit-Baltistan)        inside, attributed to LADAKH
PASS  Muzaffarabad (PoK)               inside, attributed to JAMMU & KASHMIR
PASS  Mirpur (PoK)                     inside, attributed to JAMMU & KASHMIR
PASS  Aksai Chin interior              inside, attributed to LADAKH
PASS  Aksai Chin east                  inside, attributed to LADAKH
PASS  Shaksgam Valley                  inside, attributed to LADAKH
PASS  Srinagar / Leh                   inside
PASS  Tawang / Itanagar / Walong       inside, Arunachal complete to 97.41E, 29.46N
PASS  Kathmandu / Lhasa / Lahore       outside  (controls)
```

Three things corroborate genuine official provenance beyond the passing probes:

- Maximum latitude **37.077°N**. A depiction excluding Gilgit-Baltistan tops out
  near 35.5°N. This file reaches the northern tip of the claim.
- Gilgit-Baltistan is assigned to **Ladakh**, not to Jammu & Kashmir. That is the
  specific and slightly counter-intuitive arrangement in the Survey of India map
  published in November 2019 after the reorganisation. A file derived from an
  international source would not do this.
- Attributes are `STCODE11` (Census 2011 state code), `State_LGD` (Local
  Government Directory code), plus `MaxSimpTol`/`MinSimpTol`, which are artefacts
  of ArcGIS generalisation of an official layer.

The 37 features are our 36 units with Dadra & Nagar Haveli and Daman & Diu still
separate, so the geometry dissolves cleanly onto our unit list, and `STCODE11`
gives a numeric join key rather than name matching.

**Caveats, both real.** The repository README asserts no source and the
repository licence is MIT, which is a code licence being applied to data of
undocumented origin. Provenance here is *inferred from geometry*, which is
stronger than a README claim but is not a citation. I would not want to print
"Survey of India" as the source line on the strength of my own inference.

### Candidate B — DataMeet / `geohacker/india`, `state/india_state.geojson`

**FAILS 8/15. Not usable.**

```
National bbox   lon 68.186 .. 97.415    lat 6.754 .. 35.501

FAIL  Gilgit, Skardu, Muzaffarabad, Mirpur, Aksai Chin (x2), Shaksgam  -- all OUTSIDE
PASS  Srinagar, Leh, Arunachal, and the three controls
```

Maximum latitude 35.501°N: Gilgit-Baltistan is absent. The attribute schema is
`ID_0 / ISO / NAME_0 / NAME_1 / VARNAME_1 / TYPE_1 / ENGTYPE_1` — that is GADM,
an international source. It is also pre-2014 vintage: 35 features, "Orissa",
"Uttaranchal", no Telangana and no Ladakh.

This is exactly the failure mode section 2.1 warns about, and it is the file most
people reach for first. Worth a line in SOURCES.md so the next person does not
repeat it.

### Size outlook

55,681 coordinate points before any simplification. TopoJSON with quantisation and
modest simplification should land comfortably under the 400 KB target; I will
report the actual figure at the Phase 4 checkpoint.

---

## 5. Legislative status

All three bills were introduced in Lok Sabha on **16 April 2026** and all three
were dead by **17 April 2026**.

- **Constitution (131st Amendment) Bill, 2026** — PRS status **"Negatived"**.
  298 for, 230 against, 528 present and voting, two-thirds threshold 352. Would
  have raised the ceiling from 550 to 850, being up to 815 from states and up to
  35 from union territories, and decoupled delimitation from the first census
  after 2026 so it could run on "latest published census figures".
- **Delimitation Bill, 2026** — PRS status **"Infructuous"**. Note this word: the
  brief says "withdrawn", and Kiren Rijiju did withdraw it on the floor, but the
  status PRS records is *infructuous*. Worth using the precise term in the copy.
- **Union Territories Laws (Amendment) Bill, 2026** — same fate, same day.

**What has moved since the brief was written.** Reporting from June 2026 says the
Union Home Ministry is drafting a revised package aimed at the 2029 general
election, with outreach to DMK and Trinamool, and that reintroduction was expected
in the monsoon session. I could not confirm from the sources I reached whether a
revised bill has actually been introduced as of today, 12 September 2026. **Treat
the legislative section of the copy as unwritten until we check the current
session's list of business.** This is the single most perishable fact on the site
and it should carry a visible "status as at" date.

**One substantive thing worth capturing as a preset.** During the April debate the
Home Minister is reported to have offered a *uniform 50% increase for every state*,
which would raise the house to roughly 816 while preserving every state's existing
share exactly. That is a real, named, on-the-record proposal and it is the sharpest
possible demonstration of the site's argument: it is the only configuration that
both grows the house and moves nobody's share. It should be a preset with a
caption, alongside the freeze and the proportional outcome.

---

## 6. Sources located, with licence position

| What | Where | Licence | Status |
|---|---|---|---|
| PRS projection annexure (Table 1) | prsindia.org, Delimitation Bills of 2026, "Issues for Consideration" | CC BY 4.0 stated on page | **Obtained and verified against `reference.json`** |
| Bill texts, all three | prsindia.org / sansad e-library | Government of India | Located |
| Boundary geometry, compliant | `datta07/INDIA_STATES.geojson` | MIT on repo, data origin undocumented | **Downloaded, 15/15 on the gate** |
| Population projections 2011–2036 | `nhm.gov.in/New_Updates_2018/Report_Population_Projection_2019.pdf` | GoI publication | **Downloaded, 11.01 MB** — not yet extracted, see §7 |
| Census 2011 PCA, village/town level | data.gov.in, per-state catalogues | GODL-India expected | Located, not downloaded |
| Census 1991 / 2001 district tables | censusindia.gov.in, Excel | GoI | Located, not downloaded |
| Census 1971 / 1981 district tables | censusindia.gov.in digital library, scanned | GoI | **Not confirmed as machine readable** |

**A licence wrinkle to resolve before publication.** The PRS page states CC BY 4.0,
but PRS boilerplate elsewhere says content may be reproduced "for non-commercial
purposes". Those are not the same permission. CC BY 4.0 allows commercial use. For
a non-commercial research site this is almost certainly moot, but SOURCES.md should
quote both strings rather than pick the convenient one.

### What I could not do

- **Extract the projection tables.** No PDF tooling is present: poppler is not
  installed and none of `pypdf`, `pdfplumber`, `PyMuPDF`, `camelot` are available
  to the Python 3.14.7 on this machine. The 11 MB PDF is downloaded and waiting.
  Needs a decision (§7).
- **Confirm 1971 and 1981 district tables exist in extractable form.** The official
  site advertises Excel downloads for 1991 onward. 1971 and 1981 may be scans only.
  If so, the honest outcome is to ship the series from 1991 and mark 1971 and 1981
  absent with the reason, exactly as the brief instructs.
- **Confirm the current legislative position as at today.** See §5.

---

## 7. Decisions I need from you

1. **Telangana.** Do I proceed to resolve §3 from the data.gov.in Primary Census
   Abstract by summing the ten districts? My expectation is that it lands on
   35,003,674 and that we change the file. I will not change it without district
   evidence either way.

2. **Boundary file.** Candidate A passes the gate on geometry, which is the test
   that matters, but its provenance is inferred rather than cited. Three options:
   (a) accept it and describe the source honestly in the cartographic note as a
   community redistribution whose geometry we verified ourselves, listing the
   probe results; (b) let me spend more time hunting for the same geometry from a
   citable government host before we build on it; (c) you source it, as the brief
   offers. I lean (a) with the probe table published on the page, because a
   verifiable test beats an unverifiable claim — but this is your call and it is a
   legal one, not a technical one.

3. **Dev-time PDF tooling.** May I `pip install pypdf` to extract the projection
   tables? Dev-time only, used by a script in `scripts/`, never loaded by the site,
   so it does not touch the no-build-step rule. If you would rather have zero new
   dependencies I can instead ask you to export the two state tables by hand.

4. **Version control.** The directory is not a git repository. The brief's
   repository section and "commit raw sources unmodified" both assume one. Shall I
   `git init`?

5. **Dadra & Nagar Haveli and Daman & Diu.** Confirming the consequence the kit
   flagged, empirically: modelled as one unit it receives **1 seat** at `hare@543`
   against the **2** it holds today, because its population, 586,956, is a quarter
   of a quota and the per-unit minimum is all it gets. Modelled as two units it
   receives 2. I recommend keeping it as one unit, because that is its legal status
   and the alternative embeds a rounding favour in the data rather than in the
   rule — but it needs a caption wherever it shows, or every reader will read it as
   a bug.

Nothing else proceeds until you have answered. No application code has been
written.
