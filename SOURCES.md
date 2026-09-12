# Sources

Every dataset used, with its URL, licence, the date it was obtained and exactly
what was done to it. Raw files are committed unmodified under `scripts/raw/` so
anyone can re-run the scripts and get the same data files.

All retrieval dates are **12 September 2026** unless stated.

---

## Population, 1971–2011

**Census of India 2011, Table A-02 — Decadal variation in population 1901–2011**
Office of the Registrar General & Census Commissioner, India (ORGI), Ministry of
Home Affairs.

| | |
|---|---|
| India by State | https://censusindia.gov.in/nada/index.php/catalog/43333 |
| Andhra Pradesh by District | https://censusindia.gov.in/nada/index.php/catalog/43361 |
| Jammu & Kashmir by District | https://censusindia.gov.in/nada/index.php/catalog/43334 |
| Licence | Government of India publication. The NADA portal records the licence as "TSB". |
| Raw files | `scripts/raw/census_A2_India.xls`, `census_A2_AndhraPradesh.xlsx`, `census_A2_JammuKashmir.xlsx` |
| Script | `scripts/extract_census_series.py` → `scripts/raw/census_series_a2.json` |

**Why this table specifically.** Its own metadata states that "the population
figures for all the previous censuses in this table are adjusted to the 2011
jurisdiction". The Registrar General has therefore already recast every earlier
census onto the 2011 map, at both state and district level, which is the
reconciliation this project would otherwise have had to build by hand.

**What was done.**
1. State totals read from the India file, for 1971, 1981, 1991, 2001 and 2011.
2. Daman & Diu (state code 25) and Dadra & Nagar Haveli (26) summed into our
   single unit DH.
3. Telangana derived by summing Andhra Pradesh district codes 532–541; residual
   Andhra Pradesh by subtraction from the state row.
4. Ladakh derived by summing Jammu & Kashmir district codes 003 (Leh) and 004
   (Kargil); residual J&K by subtraction.
5. Every column checked against the published INDIA row. All five reconcile
   exactly.
6. Assam 1981 and J&K/Ladakh 1991 set to null — no census was conducted. A-02
   prints official interpolations for these; they are preserved in the
   intermediate JSON but are not served.
7. 1901–1961 refused. See `METHODOLOGY.md` §7.

---

## Population projections, 2016–2036

**Population Projections for India and States 2011–2036 — Report of the
Technical Group on Population Projections**
National Commission on Population, Ministry of Health & Family Welfare,
published July 2020.

| | |
|---|---|
| URL | https://nhm.gov.in/New_Updates_2018/Report_Population_Projection_2019.pdf |
| Licence | Government of India publication |
| Size | 11.01 MB, 268 pages |
| Raw file | `scripts/raw/Report_Population_Projection_2019.pdf` |
| Script | `scripts/extract_projections.py` → `scripts/raw/projections_table21.json` |

**What was done.** Table 21, *Projected Total Population As on 1st March*,
printed pages 259–260 (PDF pages 263–264), parsed for the "Persons" column of
each of 2011, 2016, 2021, 2026, 2031 and 2036. Rows 25 and 30 — Dadra & Nagar
Haveli and Daman & Diu — summed into DH. Row 05 is printed as "Uttaranchal" and
row 01 as "Jammu & Kashmir (UT)"; mapped to UK and JK.

Figures are printed in **thousands** and are stored in thousands in the
intermediate file, multiplied to persons only in `build_units.py`, so the
rounding lives in one place. Every column reconciles to the report's own
published INDIA row within one thousand, which is what independent per-row
rounding produces.

**Secondary use.** The report's 2011 **base year** is an independent check on
our five derived units, and it is the source that settled the Telangana
question: it prints Telangana at 35,004 thousand and Andhra Pradesh at 49,577
thousand, and it lists Ladakh and Jammu & Kashmir as separate rows.

**Caveat.** These are the 2019/2020 vintage. They predate the 2027 Census and
COVID-19 mortality.

---

## Validation fixture

**PRS Legislative Research — annexure to the analysis of the Delimitation Bill,
2026**

| | |
|---|---|
| URL | https://prsindia.org/billtrack/the-delimitation-bill-2026 |
| Table | "Table 1: Projected number of seats based on the 2011 Census" |
| Licence | **CC BY 4.0**, as stated on the PRS page |
| Stored as | `data/reference.json` |

**What was done.** Transcribed as a test fixture and checked row by row against
the published table, including both column totals. Used only to validate the
engine, never to produce a number shown on the site.

The table is on **merged** units — Andhra Pradesh includes Telangana, Jammu &
Kashmir includes Ladakh, and Dadra & Nagar Haveli and Daman & Diu are listed
separately — so it has 35 rows against our 36 units. The test suite validates
against the merged configuration as a historical check and runs the split
configuration as the live one.

Its footnote is quoted here because it documents an assumption the site
otherwise could not evidence: *"Andhra Pradesh includes Telangana, and Jammu &
Kashmir includes Ladakh. We assume that the number of seats for Arunachal
Pradesh, Goa, Manipur, and Meghalaya will not be reduced as there is an
exception for states with population below 60 lakh."*

**A licence wrinkle, recorded rather than resolved.** The PRS page states CC BY
4.0. PRS boilerplate elsewhere says content may be reproduced "for
non-commercial purposes". Those are not the same permission — CC BY 4.0 permits
commercial use. Both strings are recorded here rather than picking the
convenient one. This site is non-commercial research either way.

---

## The 2014 territorial transfer

**The Andhra Pradesh Reorganisation (Amendment) Act, 2014 (No. 19 of 2014)**

| | |
|---|---|
| URL | https://prsindia.org/files/bills_acts/acts_parliament/2014/the-andhra-pradesh-reorganisation-(amendment)-act,-2014.pdf |
| Licence | Government of India, Gazette of India Extraordinary |
| Raw file | `scripts/raw/AP_Reorganisation_Amendment_Act_2014.pdf` |

**District Census Handbook 2011, Khammam (district code 2810)** — Village
Directory inset tables.

| | |
|---|---|
| URL | https://censusindia.gov.in/nada/index.php/catalog/142 |
| Raw file | `scripts/raw/khammam_dchb/Appendix_VD_2810.xls` |
| Script | `scripts/verify_bhadrachalam.py` |

**What was done.** Section 2 of the Amendment Act gives the exact schedule of
mandals and revenue villages transferred to Andhra Pradesh. Those were summed
from the village directory to establish that the territory accounts for exactly
190,304 people, which is the gap between the two circulating Telangana 2011
figures. See `METHODOLOGY.md` §8.

---

## Current seat allocation

**First Schedule, Representation of the People Act, 1950**, as amended by the
Andhra Pradesh Reorganisation Act 2014 and the Jammu & Kashmir Reorganisation
Act 2019. Cross-checked against the state-wise allocation published by the
Ministry of External Affairs and against PRS's "current seats" column, which
agree.

Andhra Pradesh 25 and Telangana 17, together the 42 the undivided state held.
Jammu & Kashmir 5 and Ladakh 1, together the 6 the undivided state held. Total
543.

---

## Boundary geometry

**udit-001/india-maps-data**, `topojson/india.json`, states layer.

| | |
|---|---|
| URL | https://github.com/udit-001/india-maps-data |
| Licence | **None declared.** See the caveat below. |
| Raw files | `scripts/raw/udit-001_india.topo.json`, `udit-001_india_districts.geojson` |
| Script | `scripts/build_boundaries.mjs` → `data/boundaries.topo.json` |
| Output | 45.3 KB uncompressed, 16.9 KB gzipped, 36 units, 3,873 points |

**What was done.** The states layer extracted from a topology shared with a
districts layer; 1,571 district-only arcs dropped, which is the entire size
saving. **No simplification applied** — the sweep in the script shows every
level from 0.25 to 16 buys 147 bytes in total, 0.3%, because the source is
already generalised for a national choropleth. Coordinates left as longitude and
latitude; projection happens at runtime.

**Compliance.** Verified by point-in-polygon test against fifteen landmarks on
the **final** file. See `docs/boundary-check.svg` and §9 of `METHODOLOGY.md`.

**Provenance caveat, stated plainly.** The repository states its data is
"curated from publicly available sources on the internet", declares no licence,
and makes no Survey of India claim. Our confidence rests entirely on our own
geometry test. Two things corroborate official derivation — the attributes are
Census 2011 state codes, and Gilgit-Baltistan is assigned to *Ladakh*, which is
the specific and counter-intuitive arrangement of the Survey of India map
published in November 2019 — but neither is a citation. **Before any wider
publication this should be replaced with a citable government-hosted equivalent,
or the repository owner asked to declare a licence.**

### Rejected candidates, recorded so the next person does not repeat the work

| Source | Verdict |
|---|---|
| DataMeet / `geohacker/india`, `state/india_state.geojson` | **Fails 8/15.** GADM-derived (`ID_0`/`NAME_1`/`VARNAME_1` schema), northern extent stops at 35.501°N. Gilgit-Baltistan, Muzaffarabad, Mirpur, Aksai Chin and Shaksgam all outside the India polygon. Also pre-2014 vintage: "Orissa", "Uttaranchal", no Telangana, no Ladakh. |
| `datta07/INDIAN-SHAPEFILES`, `INDIA_STATES.geojson` | **Passes 15/15**, 37 features with Dadra & Nagar Haveli and Daman & Diu still separate. Kept in `scripts/raw/` as a corroborating second opinion. Not used because the chosen source already matches our 36 units and ships TopoJSON. Same undeclared-provenance problem. |
| Survey of India Online Maps Portal | Authoritative, but no clear free download path for state boundary vector data was found. |

---

## Legislative status

| Bill | Status | Source |
|---|---|---|
| Constitution (131st Amendment) Bill, 2026 | Introduced 16 April 2026, **negatived** 17 April 2026. 298 for, 230 against, 528 present and voting; two-thirds threshold 352. | https://prsindia.org/billtrack/the-constitution-131st-amendment-bill-2026 |
| Delimitation Bill, 2026 | Introduced 16 April 2026, **infructuous** 17 April 2026 | https://prsindia.org/billtrack/the-delimitation-bill-2026 |
| Union Territories Laws (Amendment) Bill, 2026 | Introduced 16 April 2026, fell the same day | as above |

Checked 12–13 September 2026: no revised bill has been introduced. This is the
most perishable fact on the site and the page carries a visible "status as at"
date for that reason.

---

## Development-time dependencies

None of these are loaded by the site. The site itself has exactly one runtime
dependency, d3 v7 from cdnjs, used for the geographic projection and path
generation.

| Tool | Used for |
|---|---|
| Node 22.7+ | test suite, boundary and snapshot scripts |
| Python 3 | data extraction scripts |
| `pypdf` | reading the projections report |
| `xlrd`, `openpyxl` | reading the census workbooks |

## Licences summary

- Code in this repository: **MIT**, see `LICENSE`.
- PRS Legislative Research projection table: **CC BY 4.0**, attributed.
- Census of India and Registrar General material: Government of India.
- Boundary geometry: **no licence declared upstream** — see the caveat above.
