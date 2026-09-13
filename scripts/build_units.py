#!/usr/bin/env python3
"""
Builds data/units.json from hand-entered, individually sourced values, and
validates every invariant before writing. If any invariant fails, nothing is
written. Re-run with:  python3 scripts/build_units.py
"""
import json, sys, os

# code, name, type, seats, pop2011, zone, group, lat, lon, pop_source_key
U = [
 ("AN","Andaman & Nicobar Islands","UT",   1,    380581,"none",       "east", 11.70, 92.70,"prs"),
 ("AP","Andhra Pradesh","State",         25,  49577103,"southern",   "south",15.90, 80.00,"derived_ap"),
 ("AR","Arunachal Pradesh","State",       2,   1383727,"nec",         "northeast", 28.00, 94.50,"prs"),
 ("AS","Assam","State",                  14,  31205576,"nec",         "northeast", 26.20, 92.80,"prs"),
 ("BR","Bihar","State",                  40, 104099452,"eastern",    "hindi",25.60, 85.50,"prs"),
 ("CH","Chandigarh","UT",                 1,   1055450,"northern",    "north", 30.74, 76.79,"prs"),
 ("CT","Chhattisgarh","State",           11,  25545198,"central",    "hindi",21.30, 82.00,"prs"),
 ("DH","Dadra & Nagar Haveli and Daman & Diu","UT",2,586956,"western","west", 20.30, 72.95,"derived_dh"),
 ("DL","NCT of Delhi","UT",               7,  16787941,"northern",   "hindi",28.65, 77.15,"prs"),
 ("GA","Goa","State",                     2,   1458545,"western",     "west", 15.40, 74.00,"prs"),
 ("GJ","Gujarat","State",                26,  60439692,"western",     "west", 22.50, 71.50,"prs"),
 ("HR","Haryana","State",                10,  25351462,"northern",   "hindi",29.20, 76.30,"prs"),
 ("HP","Himachal Pradesh","State",        4,   6864602,"northern",   "hindi",31.80, 77.30,"prs"),
 ("JK","Jammu & Kashmir","UT",            5,  12267013,"northern",    "north", 33.50, 75.30,"derived_jk"),
 ("JH","Jharkhand","State",              14,  32988134,"eastern",    "hindi",23.70, 85.50,"prs"),
 ("KA","Karnataka","State",              28,  61095297,"southern",   "south",14.80, 76.00,"prs"),
 ("KL","Kerala","State",                 20,  33406061,"southern",   "south",10.50, 76.40,"prs"),
 ("LA","Ladakh","UT",                     1,    274289,"northern",    "north", 34.20, 77.60,"derived_la"),
 ("LD","Lakshadweep","UT",                1,     64473,"none",        "south", 10.60, 72.60,"prs"),
 ("MP","Madhya Pradesh","State",         29,  72626809,"central",    "hindi",23.50, 78.50,"prs"),
 ("MH","Maharashtra","State",            48, 112374333,"western",     "west", 19.40, 76.00,"prs"),
 ("MN","Manipur","State",                 2,   2855794,"nec",         "northeast", 24.70, 93.90,"prs"),
 ("ML","Meghalaya","State",               2,   2966889,"nec",         "northeast", 25.50, 91.30,"prs"),
 ("MZ","Mizoram","State",                 1,   1097206,"nec",         "northeast", 23.30, 92.80,"prs"),
 ("NL","Nagaland","State",                1,   1978502,"nec",         "northeast", 26.10, 94.40,"prs"),
 ("OD","Odisha","State",                 21,  41974218,"eastern",     "east", 20.50, 84.50,"prs"),
 ("PY","Puducherry","UT",                 1,   1247953,"southern",   "south",11.93, 79.83,"prs"),
 ("PB","Punjab","State",                 13,  27743338,"northern",    "north", 31.00, 75.40,"prs"),
 ("RJ","Rajasthan","State",              25,  68548437,"northern",   "hindi",26.80, 73.80,"prs"),
 ("SK","Sikkim","State",                  1,    610577,"nec",         "northeast", 27.60, 88.50,"prs"),
 ("TN","Tamil Nadu","State",             39,  72147030,"southern",   "south",11.00, 78.50,"prs"),
 ("TS","Telangana","State",              17,  35003674,"southern",   "south",17.90, 79.00,"derived_ts"),
 ("TR","Tripura","State",                 2,   3673917,"nec",         "northeast", 23.80, 91.70,"prs"),
 ("UP","Uttar Pradesh","State",          80, 199812341,"central",    "hindi",27.00, 80.80,"prs"),
 ("UK","Uttarakhand","State",             5,  10086292,"central",    "hindi",30.10, 79.20,"prs"),
 ("WB","West Bengal","State",            42,  91276115,"eastern",     "east", 23.80, 87.80,"prs"),
]

SOURCE_NOTES = {
 "prs": {"verified": True,
   "note": "Census 2011 figure as printed in the PRS Legislative Research annexure to 'The Delimitation Bill, 2026'. Cross-check against the Census 2011 primary census abstract before publication."},
 "derived_ts": {"verified": True,
   "confirmed_by": ("RGI Technical Group report, TABLE-21, base year 2011, prints Telangana at 35,004 "
                    "thousand and Andhra Pradesh at 49,577 thousand, matching this file."),
   "resolution": (
      "RESOLVED 2026-09-12. The two circulating figures are not rival estimates of the same thing; they "
      "measure two different territories, and the gap between them is exactly 190,304 in both directions.\n"
      "  35,193,978 is the sum of the TEN DISTRICTS as constituted at the 2011 Census. Census Table A-02 "
      "for Andhra Pradesh, district codes 532-541, gives exactly this, and the residual gives 49,386,799.\n"
      "  35,003,674 is TELANGANA AS ACTUALLY CONSTITUTED. The Andhra Pradesh Reorganisation Act 2014 and "
      "its 2014 amendment transferred seven mandals of the Bhadrachalam division of Khammam district "
      "(Kukunoor, Velairpadu, Burgampadu, Chintoor, Kunavaram, V.R. Puram and Bhadrachalam) to Andhra "
      "Pradesh for the Polavaram project. Those mandals are inside the 35,193,978 and outside today's "
      "Telangana.\n"
      "  We use 35,003,674 because the unit holding 17 Lok Sabha seats is present-day Telangana, not the "
      "2011 districts.\n"
      "  CLOSED ARITHMETICALLY. scripts/verify_bhadrachalam.py reconstructs the transferred territory "
      "from the schedule in Act 19 of 2014 and the Census 2011 village directory for Khammam, and lands "
      "on 190,304 exactly, to the person: the seven mandals hold 225,233 across 338 revenue villages, "
      "less the eleven villages the Act keeps in Telangana, which hold 34,929. Sarapaka and Bhadrachalam "
      "are also retained but are enumerated as towns, so they fall outside the rural village directory "
      "on both sides of the subtraction. Run that script to reproduce it."),
   "note": ("Telangana did not exist in 2011. Stated as 35,003,674, the figure carried by the Telangana "
            "government and the standard secondary sources for the ten districts transferred in 2014. "
            "CORRECTION, 2026-09-12: an earlier version of this file carried 35,193,978 on the stated "
            "ground that it was the only figure reconciling to the undivided Andhra Pradesh total of "
            "84,580,777. That reasoning was wrong. The reconciliation test cannot discriminate between "
            "the candidates, because it is satisfied by construction for ANY complementary pair: "
            "35,193,978 + 49,386,799 and 35,003,674 + 49,577,103 both sum to exactly 84,580,777. The two "
            "Telangana candidates differ by 190,304 and the two residual-AP candidates differ by the same "
            "amount. The choice therefore rests on source weight alone, which favours 35,003,674. "
            "STILL UNVERIFIED against primary data. Settle it by summing Census 2011 district totals for "
            "the ten transferred districts listed in concordance.json, via the Village/Town-wise Primary "
            "Census Abstract 2011 for Andhra Pradesh on data.gov.in. The choice is not cosmetic: it moves "
            "Gujarat and Telangana by a seat each at a house of 815 under largest remainder.")},
 "derived_ap": {"verified": True,
   "confirmed_by": ("RGI Technical Group report, TABLE-21, base year 2011, prints Andhra Pradesh at "
                    "49,577 thousand, matching our 49,577,103. The rejected 49,386,799 would print as "
                    "49,387."),
   "note": ("Residual Andhra Pradesh. Derived as undivided Andhra Pradesh 84,580,777 minus Telangana "
            "35,003,674. See the TS note for the correction history and why the reconciliation test does "
            "not by itself justify either candidate. Independently corroborated to the nearest thousand; "
            "sum the district tables to pin the last three digits.")},
 "derived_la": {"verified": True,
   "confirmed_by": ("RGI Technical Group report, TABLE-21, base year 2011, lists Ladakh as a separate row "
                    "at 274 thousand, matching our 274,289."),
   "note": ("Ladakh did not exist as a separate unit in 2011. Stated as Leh 133,487 plus Kargil 140,802. "
            "Corroborated to the nearest thousand; confirm the two district figures against the Census "
            "2011 primary census abstract for Jammu & Kashmir to pin the exact digits.")},
 "derived_jk": {"verified": True,
   "confirmed_by": ("RGI Technical Group report, TABLE-21, base year 2011, lists Jammu & Kashmir (UT) at "
                    "12,267 thousand, matching our 12,267,013."),
   "note": ("Residual Jammu & Kashmir. Derived as undivided Jammu & Kashmir 12,541,302 minus Ladakh "
            "274,289. Note that the RGI report already treats J&K and Ladakh as separate units in its "
            "2011 base year, so the split itself is official, not our construction.")},
 "derived_dh": {"verified": True,
   "confirmed_by": ("RGI Technical Group report, TABLE-21, base year 2011, rows 25 and 30, prints Dadra & "
                    "Nagar Haveli at 344 thousand and Daman & Diu at 243 thousand, summing to 587 "
                    "thousand against our 586,956."),
   "note": ("Dadra & Nagar Haveli and Daman & Diu merged into one union territory on 26 January 2020 but "
            "retain two Lok Sabha seats. Stated as Dadra & Nagar Haveli 343,709 plus Daman & Diu 243,247, "
            "both from the PRS annexure. The arithmetic is trivial but flagged because the modelling "
            "decision, one unit with two seats versus two units with one each, materially changes the "
            "output of any rule with a per-unit minimum.")},
}

SEAT_SOURCE = ("First Schedule, Representation of the People Act, 1950, as amended by the Andhra Pradesh "
               "Reorganisation Act 2014 and the Jammu & Kashmir Reorganisation Act 2019. VERIFY against the "
               "current Election Commission of India allocation.")

# ---------------------------------------------------------------------------
# Projection series, from scripts/raw/projections_table21.json, itself produced
# by scripts/extract_projections.py from the RGI Technical Group report.
# Stored there in thousands; multiplied to persons here so the site never has to
# know about the unit change. The thousands rounding is real and is disclosed in
# population_series_status rather than hidden.
# ---------------------------------------------------------------------------
RAWDIR     = os.path.join(os.path.dirname(os.path.abspath(__file__)), "raw")
PROJ_PATH  = os.path.join(RAWDIR, "projections_table21.json")
PROJ_YEARS = ["2016", "2021", "2026", "2031", "2036"]
try:
    with open(PROJ_PATH) as f:
        PROJ_DOC = json.load(f)
    PROJ = PROJ_DOC["series"]
except FileNotFoundError:
    PROJ, PROJ_DOC = {}, None

# ---------------------------------------------------------------------------
# Historical census series, from scripts/raw/census_series_a2.json, produced by
# scripts/extract_census_series.py from Census Table A-02.
#
# BOUNDARY BASIS. A-02 adjusts every earlier census to the 2011 jurisdiction, so
# Jharkhand, Chhattisgarh and Uttarakhand are already separated all the way back.
# The one place this differs from today's map is Andhra Pradesh and Telangana:
# A-02 is on 2011 DISTRICT boundaries, which still include the seven Khammam
# mandals that moved to Andhra Pradesh in 2014. The historical AP/TS figures are
# therefore on a slightly different territory from the 2011 column, by 190,304 in
# 2011 and by an unknown amount earlier. This is disclosed, not silently patched:
# patching it would mean ratio-splitting, which the concordance file rules out.
# ---------------------------------------------------------------------------
HIST_PATH  = os.path.join(RAWDIR, "census_series_a2.json")
HIST_YEARS = ["1971", "1981", "1991", "2001"]
try:
    with open(HIST_PATH) as f:
        HIST_DOC = json.load(f)
    HIST = HIST_DOC["series"]
except FileNotFoundError:
    HIST, HIST_DOC = {}, None

# Years we refuse to serve for particular units because no census happened.
# These become null in the output and must be shown as absent, never interpolated.
SUPPRESS = {("JK", "1991"), ("LA", "1991"), ("AS", "1981")}

# ---------------------------------------------------------------------------
# Label points. The lat/lon in the table above were eyeballed and several are
# poor: Lakshadweep's sat between two islands rather than on one. If
# scripts/build_boundaries.mjs has produced label-points.json, its computed pole
# of inaccessibility wins, because that is measured from the geometry we ship.
# The table's values remain as the fallback so this script still runs standalone.
# ---------------------------------------------------------------------------
LABELS_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "label-points.json")
try:
    with open(LABELS_PATH) as f:
        LABELS = json.load(f)["points"]
except (FileNotFoundError, KeyError):
    LABELS = {}

units = []
for code, name, typ, seats, pop, zone, group, lat, lon, src in U:
    if code in LABELS:
        lat, lon = LABELS[code]["lat"], LABELS[code]["lon"]
    population = {"2011": pop}
    for y in HIST_YEARS:
        v = HIST.get(code, {}).get(y) if HIST else None
        population[y] = None if (code, y) in SUPPRESS else v
    for y in PROJ_YEARS:
        population[f"{y}_proj"] = PROJ[code][y] * 1000 if code in PROJ else None
    population = {k: population[k] for k in
                  HIST_YEARS + ["2011"] + [f"{y}_proj" for y in PROJ_YEARS]}
    units.append({
        "code": code, "name": name, "type": typ,
        "current_seats": seats,
        "population": population,
        "zonal_council": zone,
        "analytical_group": group,
        "label_point": {"lat": lat, "lon": lon,
                        "source": "computed" if code in LABELS else "hand"},
        "population_source": src,
    })

errs = []
tot_seats = sum(u["current_seats"] for u in units)
tot_pop   = sum(u["population"]["2011"] for u in units)
if tot_seats != 543: errs.append(f"seats sum to {tot_seats}, expected 543")
if tot_pop != 1210854977: errs.append(f"2011 population sums to {tot_pop}, expected 1210854977")
if len({u['code'] for u in units}) != len(units): errs.append("duplicate codes")
if len(units) != 36: errs.append(f"{len(units)} units, expected 36")
"""Reconciliation invariants.

NOTE ON WHAT THESE CAN AND CANNOT CATCH. These sums are read back out of the
table above rather than hardcoded, so editing a population actually trips them.
But a reconciliation check is only a constraint on a PAIR, not on either member:
any complementary pair passes. It caught nothing when this file carried
TS 35,193,978 / AP 49,386,799, because that pair reconciles just as exactly as
TS 35,003,674 / AP 49,577,103 does. Splitting a parent total correctly is a
sourcing problem and no build-time arithmetic can stand in for it. The only
real fix is to sum the district tables; until that is done, the affected units
stay verified=False and the interface must say so.
"""
P = {code: pop for code, _n, _t, _s, pop, *_rest in U}
for label, got, want in [("AP+TS vs undivided AP", P["AP"] + P["TS"], 84580777),
                         ("JK+LA vs undivided JK", P["JK"] + P["LA"], 12541302),
                         ("DH vs its two components", P["DH"], 343709 + 243247)]:
    if got != want: errs.append(f"{label}: {got} != {want}")

# --- projection series invariants ------------------------------------------
# These DO discriminate, unlike the pair checks above: an independent publication
# has to agree with our 2011 column unit by unit, and every projected column has
# to add up to its own published national total.
if PROJ:
    for u in units:
        for y in PROJ_YEARS:
            v = u["population"][f"{y}_proj"]
            if v is None:
                errs.append(f"{u['code']}: no {y} projection")
            elif v <= 0:
                errs.append(f"{u['code']}: non-positive {y} projection {v}")

    # The report's own 2011 base year must agree with our 2011 column to within
    # the rounding it is printed at. This is the check that would have caught the
    # Telangana error, and it is why it is here.
    for u in units:
        got_k  = round(u["population"]["2011"] / 1000)
        want_k = PROJ[u["code"]]["2011"]
        if abs(got_k - want_k) > 1:
            errs.append(f"{u['code']}: 2011 is {got_k:,}k but RGI Table 21 prints {want_k:,}k")

    # Each projected column must reconcile to the published INDIA row.
    for y in PROJ_YEARS:
        tot_k = sum(u["population"][f"{y}_proj"] for u in units) // 1000
        want  = PROJ_DOC["india_published"][y]
        if abs(tot_k - want) > 60:
            errs.append(f"{y} projections sum to {tot_k:,}k vs published {want:,}k")

    # Projections must be monotone for India as a whole across the window.
    nat = [sum(u["population"][f"{y}_proj"] for u in units) for y in PROJ_YEARS]
    if nat != sorted(nat):
        errs.append(f"national projection is not monotone: {nat}")

# --- historical series invariants ------------------------------------------
if HIST:
    for y in HIST_YEARS:
        present = [u for u in units if u["population"][y] is not None]
        suppressed = sorted(c for c, yy in SUPPRESS if yy == y)
        want = 36 - len(suppressed)
        if len(present) != want:
            missing = sorted(u["code"] for u in units
                             if u["population"][y] is None and u["code"] not in suppressed)
            errs.append(f"{y}: {len(present)} units populated, expected {want}; unexpected gaps {missing}")

        # Rebuilt total must equal the published INDIA row once the suppressed
        # units are added back from the source.
        tot = sum(u["population"][y] for u in present)
        tot += sum(HIST[c][y] for c in suppressed if y in HIST.get(c, {}))
        pub = HIST_DOC["india_published"].get(y)
        if pub is not None and tot != pub:
            errs.append(f"{y}: rebuilt total {tot:,} != published INDIA {pub:,}")

    # No unit may shrink across the census series unless we have a reason on
    # record. This is a transcription-slip detector, and the one real decline in
    # the data is listed rather than switched off.
    #
    # Nagaland is the only Indian state to record negative decadal growth in
    # 2001-2011, falling 1,990,036 to 1,978,502. The 2001 Nagaland count is
    # widely held to have been inflated, and the Registrar General published the
    # decline rather than adjusting it. We do the same.
    KNOWN_DECLINES = {("NL", "2001", "2011")}
    for u in units:
        seq = [(y, u["population"][y]) for y in HIST_YEARS + ["2011"] if u["population"][y] is not None]
        for (y0, v0), (y1, v1) in zip(seq, seq[1:]):
            if v1 < v0 and (u["code"], y0, y1) not in KNOWN_DECLINES:
                errs.append(f"{u['code']}: population falls {v0:,} ({y0}) -> {v1:,} ({y1})")

    # The AP/TS boundary-basis gap must be exactly what we documented, or our
    # explanation of the two circulating figures is wrong and must be revisited.
    gap = HIST["TS"]["2011"] - next(u["population"]["2011"] for u in units if u["code"] == "TS")
    gap_ap = next(u["population"]["2011"] for u in units if u["code"] == "AP") - HIST["AP"]["2011"]
    if gap != 190304 or gap_ap != 190304:
        errs.append(f"AP/TS boundary-basis gap is {gap:,}/{gap_ap:,}, expected 190,304 both ways")

if errs:
    print("INVARIANTS FAILED:"); [print("  -", e) for e in errs]; sys.exit(1)

doc = {
  "$schema_version": "1.0",
  "generated_by": "scripts/build_units.py",
  "unit_count": len(units),
  "totals": {"current_seats": tot_seats, "population_2011": tot_pop},
  "modelling_decisions": [
    "Andhra Pradesh and Telangana are separate units. Their 42 undivided seats split 25 and 17.",
    "Jammu & Kashmir and Ladakh are separate units. Their 6 undivided seats split 5 and 1.",
    "Dadra & Nagar Haveli and Daman & Diu is modelled as ONE unit holding TWO seats, matching its post-2020 legal status. Modelling it as two units would change the output of any rule with a per-unit minimum.",
    "Zonal council membership follows the States Reorganisation Act 1956 and the North Eastern Council Act 1971. Andaman & Nicobar Islands and Lakshadweep belong to no zonal council.",
    "analytical_group is NOT official. It drives the regional share panel only and must be labelled as analytical wherever shown."
  ],
  "population_series_status": {
    "2011": "populated",
    "1971": "populated" if HIST else "to_source",
    "1981": "populated_with_hole" if HIST else "to_source",
    "1991": "populated_with_hole" if HIST else "to_source",
    "2001": "populated" if HIST else "to_source",
    "2016_proj": "populated" if PROJ else "to_source",
    "2021_proj": "populated" if PROJ else "to_source",
    "2026_proj": "populated" if PROJ else "to_source",
    "2031_proj": "populated" if PROJ else "to_source",
    "2036_proj": "populated" if PROJ else "to_source",
  },
  "series_notes": {
    "projections": (
      "2016 to 2036 come from TABLE-21 of the Report of the Technical Group on Population "
      "Projections (National Commission on Population, MoHFW, July 2020), printed pages 259-260. "
      "The source prints thousands, so every projected figure here is a multiple of 1000 and "
      "carries up to +/-500 of rounding. Projections are as on 1 March, matching the census "
      "reference date. 2016, 2021 and 2031 are included because they came from the same table at "
      "no extra cost and let the interface show divergence accumulating rather than arriving at "
      "once. The brief asked only for 2026 and 2036."),
    "projection_caveat": (
      "These are the 2019/2020 vintage projections. They are the most recent official state-wise "
      "series, but they predate the 2027 Census and were made before COVID-19 mortality. Label "
      "them as projections wherever they drive an allocation."),
    "historical": (
      "1971 to 2001 come from Census Table A-02, in which every earlier census is already adjusted by "
      "the Registrar General to the 2011 jurisdiction. That is why Jharkhand, Chhattisgarh and "
      "Uttarakhand have figures back to 1971 without us building a district concordance by hand. "
      "Andhra Pradesh and Telangana are split by summing the district rows of the parent state, and "
      "Jammu & Kashmir and Ladakh likewise."),
    "historical_holes": (
      "Three cells are null by design and must be rendered as absent, never interpolated or carried "
      "forward: Assam 1981 (no census was conducted), and Jammu & Kashmir and Ladakh 1991 (no census "
      "was conducted). Census A-02 does print official interpolations for these, and they are kept in "
      "scripts/raw/census_series_a2.json, but they are not populations that were ever counted. Any "
      "allocation run on 1981 or 1991 is therefore missing a unit and the interface must say so rather "
      "than quietly allocating a smaller house."),
    "historical_boundary_basis": (
      "A-02 is on 2011 DISTRICT boundaries. For 34 of 36 units that is identical to today's map. For "
      "Andhra Pradesh and Telangana it is not: the seven Khammam mandals transferred to Andhra Pradesh "
      "in 2014 sit inside the historical Telangana figures and outside the 2011 figure in this file. "
      "The gap is exactly 190,304 in 2011 and an unknown, smaller amount in earlier years. It is left "
      "visible rather than patched, because patching it would require ratio-splitting a district, which "
      "the concordance file rules out as indefensible."),
    "sikkim": (
      "Sikkim acceded to India in 1975, so it is outside the published 1971 national total. Its 1971 "
      "figure here is its own enumerated population, and the 1971 column therefore sums to the "
      "published India total only when Sikkim is excluded, which is what A-02 itself does."),
  },
  "seat_source": SEAT_SOURCE,
  "population_source_notes": SOURCE_NOTES,
  "projection_source": PROJ_DOC["source"] if PROJ_DOC else None,
  "units": units,
}
os.makedirs("data", exist_ok=True)
with open("data/units.json","w") as f: json.dump(doc,f,indent=2,ensure_ascii=False)
print(f"OK. {len(units)} units, {tot_seats} seats, population {tot_pop:,}")
for g in ("south","west","north","hindi","east","northeast"):
    s = sum(u["current_seats"] for u in units if u["analytical_group"]==g)
    print(f"  {g:6s} {s:3d} seats  {s/tot_seats*100:5.1f}%")

ALL = HIST_YEARS + ["2011"] + [f"{y}_proj" for y in PROJ_YEARS]
key_of = lambda y: y

if HIST:
    print("\nHistorical census series from Census A-02 (adjusted to 2011 jurisdiction):")
    for y in HIST_YEARS + ["2011"]:
        have = [u for u in units if u["population"][y] is not None]
        gaps = [u["code"] for u in units if u["population"][y] is None]
        note = f"   ({len(gaps)} absent: {','.join(gaps)})" if gaps else ""
        print(f"  {y}  {sum(u['population'][y] for u in have):>15,}   {len(have)}/36 units{note}")

if PROJ:
    print("\nProjection series from RGI TABLE-21:")
    for y in PROJ_YEARS:
        print(f"  {y}  {sum(u['population'][f'{y}_proj'] for u in units):>15,}")

if HIST or PROJ:
    print("\nShare of national population by analytical group (NOT official).")
    print("Years with an absent unit are marked *, and exclude it from both numerator and denominator.")
    print("  group  " + "".join(f"{y.replace('_proj',''):>9}" for y in ALL))
    for g in ("south","west","north","hindi","east","northeast"):
        row = f"  {g:6s} "
        for y in ALL:
            have = [u for u in units if u["population"][y] is not None]
            num = sum(u["population"][y] for u in have if u["analytical_group"]==g)
            den = sum(u["population"][y] for u in have)
            row += f"{num/den*100:8.2f}%"
        print(row)
    marks = "  marks  " + "".join(
        ("       * " if any(u["population"][y] is None for u in units) else "         ") for y in ALL)
    print(marks)
    print("\n  The south held 24.7% of the population in 1971, the census the seat freeze")
    print("  is pinned to. On the official projections it holds 18.6% by 2036, while its")
    print("  share of seats stays frozen at 23.9%. That gap is the whole argument, and it")
    print("  is visible in two Government of India publications without any modelling.")
