#!/usr/bin/env python3
"""
Builds the historical census series from Census 2011 Table A-02, "Decadal
variation in population 1901-2011", and writes scripts/raw/census_series_a2.json.

WHY THIS SOURCE. A-02 is the one official table where "the population figures
for all the previous censuses are adjusted to the 2011 jurisdiction". The
Registrar General has already done the boundary reconciliation that the brief's
concordance file sets out to do by hand. That removes Jharkhand, Chhattisgarh
and Uttarakhand as problems entirely: they appear as separate rows back to 1901.

WHAT IS STILL OURS TO DO. A-02 is on the 2011 map, which still has undivided
Andhra Pradesh and undivided Jammu & Kashmir. Both are split here by summing the
DISTRICT-level A-02 for each parent state, which is exactly the method the
concordance file requires and is defensible because the district figures are
themselves already adjusted to 2011 district jurisdiction.

  Telangana = Census district codes 532-541 of Andhra Pradesh, being the ten
              districts transferred in 2014.
  Ladakh    = Census district codes 003 (Leh) and 004 (Kargil) of J&K.

Sources, all Office of the Registrar General & Census Commissioner, India:
  A-02 India by State            censusindia.gov.in/nada catalog 43333
  A-02 Andhra Pradesh by District                       catalog 43361
  A-02 Jammu & Kashmir by District                      catalog 43334
Retrieved 2026-09-12. Raw workbooks committed under scripts/raw/.

Run:  python scripts/extract_census_series.py
"""
import json, os, re, sys
import xlrd, openpyxl

HERE = os.path.dirname(os.path.abspath(__file__))
RAW  = os.path.join(HERE, "raw")
OUT  = os.path.join(RAW, "census_series_a2.json")

# Census 2011 state code -> our unit code. 25 and 26 both map into DH.
STATE_CODE = {
    "01":"JK","02":"HP","03":"PB","04":"CH","05":"UK","06":"HR","07":"DL","08":"RJ",
    "09":"UP","10":"BR","11":"SK","12":"AR","13":"NL","14":"MN","15":"MZ","16":"TR",
    "17":"ML","18":"AS","19":"WB","20":"JH","21":"OD","22":"CT","23":"MP","24":"GJ",
    "25":"DH","26":"DH","27":"MH","28":"AP","29":"KA","30":"GA","31":"LD","32":"KL",
    "33":"TN","34":"PY","35":"AN",
}
TS_DISTRICTS = {"532","533","534","535","536","537","538","539","540","541"}
LA_DISTRICTS = {"003","004"}
# Deliberately 1971 onward, which is the whole range the project needs (the seat
# freeze runs from the 1971 Census). Earlier columns exist in the source but are
# not reproducible as a 36-unit series and are excluded rather than patched:
#   - Goa, Daman and Diu were Portuguese territory until 1961 and are absent
#     from the Indian totals before then; Arunachal Pradesh and Puducherry are
#     not separately enumerated in several early columns.
#   - The Andhra Pradesh district rows do not sum to the state row before 1941,
#     so the Telangana split cannot be derived defensibly in those years.
# Running this script with the earlier years restored will fail its own
# invariants, which is the intended behaviour.
YEARS = ["1971","1981","1991","2001","2011"]

# Footnote markers printed against a year in the source, and what they mean.
FOOTNOTES = {
    "AS1981": "No census was conducted in Assam in 1981. The figure is an official interpolation.",
    "JK1991": "No census was conducted in Jammu & Kashmir in 1991. The figure is an official interpolation.",
}

def parse_year(cell):
    """Year cells appear as 1991.0, '1991', or '  1991 + '. Return (year, marks)."""
    s = str(cell).strip()
    m = re.search(r"(19|20)\d{2}", s)
    if not m:
        return None, ""
    year = m.group(0)
    marks = "".join(ch for ch in s.replace(year, "") if ch in "$@#+*")
    return year, marks

def as_int(v):
    if v is None or v == "":
        return None
    if isinstance(v, (int, float)):
        return int(round(v))
    s = str(v).replace(",", "").strip()
    return int(round(float(s))) if re.fullmatch(r"-?\d+(\.\d+)?", s) else None

def rows_xls(path):
    ws = xlrd.open_workbook(path).sheets()[0]
    for i in range(ws.nrows):
        yield ws.row_values(i)

def rows_xlsx(path):
    ws = openpyxl.load_workbook(path, data_only=True).worksheets[0]
    yield from ws.iter_rows(values_only=True)

def collect(rows):
    """A-02 repeats the unit label once then leaves it blank down the year block.
    Carry the last seen (state, district) forward. Returns {(sc,dc): {year: (pop, marks)}}."""
    out, cur = {}, None
    for row in rows:
        row = list(row) + [None] * (9 - len(row))
        sc, dc = row[0], row[1]
        sc = str(sc).strip().split(".")[0].zfill(2) if sc not in (None, "") else None
        dc = str(dc).strip().split(".")[0].zfill(3) if dc not in (None, "") else None
        if sc and dc and re.fullmatch(r"\d{2}", sc) and re.fullmatch(r"\d{3}", dc):
            cur = (sc, dc)
            out.setdefault(cur, {})
        if cur is None:
            continue
        year, marks = parse_year(row[3])
        pop = as_int(row[4])
        if year and pop is not None:
            out[cur][year] = (pop, marks)
    return out

def main():
    paths = {
        "india": os.path.join(RAW, "census_A2_India.xls"),
        "ap":    os.path.join(RAW, "census_A2_AndhraPradesh.xlsx"),
        "jk":    os.path.join(RAW, "census_A2_JammuKashmir.xlsx"),
    }
    for k, p in paths.items():
        if not os.path.exists(p):
            sys.exit(f"missing source workbook: {p}")

    india = collect(rows_xls(paths["india"]))
    ap    = collect(rows_xlsx(paths["ap"]))
    jk    = collect(rows_xlsx(paths["jk"]))

    errs = []
    national = {y: india.get(("00", "000"), {}).get(y, (None, ""))[0] for y in YEARS}
    if national.get("2011") != 1210854977:
        errs.append(f"India 2011 reads {national.get('2011')}, expected 1210854977")

    # --- state totals, on the 2011 map -------------------------------------
    series, marks = {}, {}
    for (sc, dc), vals in india.items():
        if dc != "000" or sc not in STATE_CODE:
            continue
        code = STATE_CODE[sc]
        for y, (pop, mk) in vals.items():
            series.setdefault(code, {})
            series[code][y] = series[code].get(y, 0) + pop      # 25 + 26 -> DH
            if mk:
                marks.setdefault(code, {})[y] = mk

    # --- split undivided Andhra Pradesh into AP and TS ---------------------
    ts = {}
    for (sc, dc), vals in ap.items():
        if dc in TS_DISTRICTS:
            for y, (pop, _m) in vals.items():
                ts[y] = ts.get(y, 0) + pop
    ap_total = {y: v[0] for y, v in ap.get(("28", "000"), {}).items()}

    # --- split undivided Jammu & Kashmir into JK and LA --------------------
    la = {}
    for (sc, dc), vals in jk.items():
        if dc in LA_DISTRICTS:
            for y, (pop, _m) in vals.items():
                la[y] = la.get(y, 0) + pop
    jk_total = {y: v[0] for y, v in jk.get(("01", "000"), {}).items()}

    # The parent's own row must equal the sum of its districts, in every year.
    for label, total, parts in (("AP", ap_total, ap), ("JK", jk_total, jk)):
        for y in YEARS:
            if y not in total:
                errs.append(f"{label}: no state row for {y}")
                continue
            s = sum(v[y][0] for (sc, dc), v in parts.items() if dc != "000" and y in v)
            if s != total[y]:
                errs.append(f"{label} {y}: districts sum to {s:,} but the state row says {total[y]:,}")

    for y in YEARS:
        if y in ts and y in ap_total:
            series["TS"] = series.get("TS", {}); series["TS"][y] = ts[y]
            series["AP"][y] = ap_total[y] - ts[y]
        if y in la and y in jk_total:
            series["LA"] = series.get("LA", {}); series["LA"][y] = la[y]
            series["JK"][y] = jk_total[y] - la[y]

    # Carry the parent's footnote onto both children.
    for parent, children in (("AP", ("AP", "TS")), ("JK", ("JK", "LA"))):
        for y, mk in marks.get(parent, {}).items():
            for c in children:
                marks.setdefault(c, {})[y] = mk

    # --- validation --------------------------------------------------------
    if len(series) != 36:
        errs.append(f"{len(series)} units built, expected 36")
    for y in YEARS:
        have = [c for c in series if y in series[c]]
        if len(have) < 36:
            missing = sorted(set(series) - set(have))
            # Sikkim genuinely joined India in 1975; absent before then is correct.
            if not (y <= "1971" and missing == ["SK"]):
                errs.append(f"{y}: only {len(have)}/36 units, missing {missing}")
        tot = sum(series[c][y] for c in have)
        if national[y] is not None and tot != national[y]:
            # Sikkim is outside the 1971 and earlier India totals.
            errs.append(f"{y}: units sum to {tot:,} vs published INDIA {national[y]:,} "
                        f"(diff {tot - national[y]:+,})")
        if y == "2011" and tot != 1210854977:
            errs.append(f"2011 rebuild is {tot:,}, expected 1210854977")

    if errs:
        print("EXTRACTION FAILED:")
        for e in errs:
            print("  -", e)
        sys.exit(1)

    doc = {
        "$schema_version": "1.0",
        "generated_by": "scripts/extract_census_series.py",
        "source": {
            "publisher": "Office of the Registrar General & Census Commissioner, India (ORGI)",
            "table": "A-02: Decadal variation in population 1901-2011",
            "key_property": ("Population figures for all previous censuses are adjusted to the 2011 "
                             "jurisdiction, so the whole series is already expressed in 2011 boundaries."),
            "catalogs": {
                "india_by_state": "https://censusindia.gov.in/nada/index.php/catalog/43333",
                "andhra_pradesh_by_district": "https://censusindia.gov.in/nada/index.php/catalog/43361",
                "jammu_kashmir_by_district": "https://censusindia.gov.in/nada/index.php/catalog/43334",
            },
            "retrieved": "2026-09-12",
        },
        "derivations": {
            "TS": "Sum of Census district codes 532-541 of undivided Andhra Pradesh.",
            "AP": "Undivided Andhra Pradesh state row minus TS.",
            "LA": "Sum of Census district codes 003 (Leh) and 004 (Kargil) of undivided Jammu & Kashmir.",
            "JK": "Undivided Jammu & Kashmir state row minus LA.",
            "DH": "Sum of state codes 25 (Daman & Diu) and 26 (Dadra & Nagar Haveli).",
        },
        "known_holes": {
            "SK_1971_and_earlier": ("Sikkim acceded to India in 1975 and is absent from the Indian totals "
                                    "for 1971 and earlier."),
            "AS_1981": FOOTNOTES["AS1981"],
            "JK_1991": FOOTNOTES["JK1991"] + " It applies to JK and LA alike.",
        },
        "india_published": national,
        "footnote_marks": marks,
        "years": YEARS,
        "series": series,
    }
    with open(OUT, "w") as f:
        json.dump(doc, f, indent=2)

    print(f"OK. {len(series)} units x {len(YEARS)} census years -> {os.path.relpath(OUT, HERE)}")
    print("\nRebuilt totals vs the published INDIA row:")
    for y in YEARS:
        have = [c for c in series if y in series[c]]
        tot = sum(series[c][y] for c in have)
        flag = "" if national[y] is None or tot == national[y] else "  <-- MISMATCH"
        print(f"  {y}  {tot:>14,}  published {(national[y] or 0):>14,}  units {len(have)}{flag}")
    print("\nThe two derived splits, by year:")
    print(f"  {'year':6} {'AP':>13} {'TS':>13}   {'JK':>11} {'LA':>9}")
    for y in ["1971", "1981", "1991", "2001", "2011"]:
        g = lambda c: f"{series[c][y]:,}" if y in series.get(c, {}) else "-"
        print(f"  {y:6} {g('AP'):>13} {g('TS'):>13}   {g('JK'):>11} {g('LA'):>9}")

if __name__ == "__main__":
    main()
