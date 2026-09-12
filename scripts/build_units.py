#!/usr/bin/env python3
"""
Builds data/units.json from hand-entered, individually sourced values, and
validates every invariant before writing. If any invariant fails, nothing is
written. Re-run with:  python3 scripts/build_units.py
"""
import json, sys, os

# code, name, type, seats, pop2011, zone, group, lat, lon, pop_source_key
U = [
 ("AN","Andaman & Nicobar Islands","UT",   1,    380581,"none",       "rest", 11.70, 92.70,"prs"),
 ("AP","Andhra Pradesh","State",         25,  49577103,"southern",   "south",15.90, 80.00,"derived_ap"),
 ("AR","Arunachal Pradesh","State",       2,   1383727,"nec",         "rest", 28.00, 94.50,"prs"),
 ("AS","Assam","State",                  14,  31205576,"nec",         "rest", 26.20, 92.80,"prs"),
 ("BR","Bihar","State",                  40, 104099452,"eastern",    "hindi",25.60, 85.50,"prs"),
 ("CH","Chandigarh","UT",                 1,   1055450,"northern",    "rest", 30.74, 76.79,"prs"),
 ("CT","Chhattisgarh","State",           11,  25545198,"central",    "hindi",21.30, 82.00,"prs"),
 ("DH","Dadra & Nagar Haveli and Daman & Diu","UT",2,586956,"western","rest", 20.30, 72.95,"derived_dh"),
 ("DL","NCT of Delhi","UT",               7,  16787941,"northern",   "hindi",28.65, 77.15,"prs"),
 ("GA","Goa","State",                     2,   1458545,"western",     "rest", 15.40, 74.00,"prs"),
 ("GJ","Gujarat","State",                26,  60439692,"western",     "rest", 22.50, 71.50,"prs"),
 ("HR","Haryana","State",                10,  25351462,"northern",   "hindi",29.20, 76.30,"prs"),
 ("HP","Himachal Pradesh","State",        4,   6864602,"northern",   "hindi",31.80, 77.30,"prs"),
 ("JK","Jammu & Kashmir","UT",            5,  12267013,"northern",    "rest", 33.50, 75.30,"derived_jk"),
 ("JH","Jharkhand","State",              14,  32988134,"eastern",    "hindi",23.70, 85.50,"prs"),
 ("KA","Karnataka","State",              28,  61095297,"southern",   "south",14.80, 76.00,"prs"),
 ("KL","Kerala","State",                 20,  33406061,"southern",   "south",10.50, 76.40,"prs"),
 ("LA","Ladakh","UT",                     1,    274289,"northern",    "rest", 34.20, 77.60,"derived_la"),
 ("LD","Lakshadweep","UT",                1,     64473,"none",        "rest", 10.60, 72.60,"prs"),
 ("MP","Madhya Pradesh","State",         29,  72626809,"central",    "hindi",23.50, 78.50,"prs"),
 ("MH","Maharashtra","State",            48, 112374333,"western",     "rest", 19.40, 76.00,"prs"),
 ("MN","Manipur","State",                 2,   2855794,"nec",         "rest", 24.70, 93.90,"prs"),
 ("ML","Meghalaya","State",               2,   2966889,"nec",         "rest", 25.50, 91.30,"prs"),
 ("MZ","Mizoram","State",                 1,   1097206,"nec",         "rest", 23.30, 92.80,"prs"),
 ("NL","Nagaland","State",                1,   1978502,"nec",         "rest", 26.10, 94.40,"prs"),
 ("OD","Odisha","State",                 21,  41974218,"eastern",     "rest", 20.50, 84.50,"prs"),
 ("PY","Puducherry","UT",                 1,   1247953,"southern",   "south",11.93, 79.83,"prs"),
 ("PB","Punjab","State",                 13,  27743338,"northern",    "rest", 31.00, 75.40,"prs"),
 ("RJ","Rajasthan","State",              25,  68548437,"northern",   "hindi",26.80, 73.80,"prs"),
 ("SK","Sikkim","State",                  1,    610577,"nec",         "rest", 27.60, 88.50,"prs"),
 ("TN","Tamil Nadu","State",             39,  72147030,"southern",   "south",11.00, 78.50,"prs"),
 ("TS","Telangana","State",              17,  35003674,"southern",   "south",17.90, 79.00,"derived_ts"),
 ("TR","Tripura","State",                 2,   3673917,"nec",         "rest", 23.80, 91.70,"prs"),
 ("UP","Uttar Pradesh","State",          80, 199812341,"central",    "hindi",27.00, 80.80,"prs"),
 ("UK","Uttarakhand","State",             5,  10086292,"central",    "hindi",30.10, 79.20,"prs"),
 ("WB","West Bengal","State",            42,  91276115,"eastern",     "rest", 23.80, 87.80,"prs"),
]

SOURCE_NOTES = {
 "prs": {"verified": True,
   "note": "Census 2011 figure as printed in the PRS Legislative Research annexure to 'The Delimitation Bill, 2026'. Cross-check against the Census 2011 primary census abstract before publication."},
 "derived_ts": {"verified": False,
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
 "derived_ap": {"verified": False,
   "note": ("Residual Andhra Pradesh. Derived as undivided Andhra Pradesh 84,580,777 minus Telangana "
            "35,003,674. See the TS note for the correction history and why the reconciliation test does "
            "not by itself justify either candidate. VERIFY from district tables.")},
 "derived_la": {"verified": False,
   "note": ("Ladakh did not exist as a separate unit in 2011. Stated as Leh 133,487 plus Kargil 140,802. "
            "VERIFY both against the Census 2011 district primary census abstract for Jammu & Kashmir.")},
 "derived_jk": {"verified": False,
   "note": ("Residual Jammu & Kashmir. Derived as undivided Jammu & Kashmir 12,541,302 minus Ladakh 274,289. "
            "VERIFY from district tables.")},
 "derived_dh": {"verified": False,
   "note": ("Dadra & Nagar Haveli and Daman & Diu merged into one union territory on 26 January 2020 but "
            "retain two Lok Sabha seats. Stated as Dadra & Nagar Haveli 343,709 plus Daman & Diu 243,247, "
            "both from the PRS annexure. The arithmetic is trivial but flagged because the modelling "
            "decision, one unit with two seats versus two units with one each, materially changes the "
            "output of any rule with a per-unit minimum.")},
}

SEAT_SOURCE = ("First Schedule, Representation of the People Act, 1950, as amended by the Andhra Pradesh "
               "Reorganisation Act 2014 and the Jammu & Kashmir Reorganisation Act 2019. VERIFY against the "
               "current Election Commission of India allocation.")

units = []
for code, name, typ, seats, pop, zone, group, lat, lon, src in U:
    units.append({
        "code": code, "name": name, "type": typ,
        "current_seats": seats,
        "population": {"2011": pop, "1971": None, "1981": None, "1991": None,
                       "2001": None, "2026_proj": None, "2036_proj": None},
        "zonal_council": zone,
        "analytical_group": group,
        "label_point": {"lat": lat, "lon": lon},
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
  "population_series_status": {"2011":"populated","1971":"to_source","1981":"to_source",
    "1991":"to_source","2001":"to_source","2026_proj":"to_source","2036_proj":"to_source"},
  "seat_source": SEAT_SOURCE,
  "population_source_notes": SOURCE_NOTES,
  "units": units,
}
os.makedirs("data", exist_ok=True)
with open("data/units.json","w") as f: json.dump(doc,f,indent=2,ensure_ascii=False)
print(f"OK. {len(units)} units, {tot_seats} seats, population {tot_pop:,}")
for g in ("south","hindi","rest"):
    s = sum(u["current_seats"] for u in units if u["analytical_group"]==g)
    print(f"  {g:6s} {s:3d} seats  {s/tot_seats*100:5.1f}%")
