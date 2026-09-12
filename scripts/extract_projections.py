#!/usr/bin/env python3
"""
Extracts TABLE-21 (Projected Total Population As on 1st March, India/States/UTs,
2011-2036) from the Report of the Technical Group on Population Projections,
and writes scripts/raw/projections_table21.json.

Source PDF: scripts/raw/Report_Population_Projection_2019.pdf
  National Commission on Population, Ministry of Health & Family Welfare,
  "Population Projections for India and States 2011-2036", Report of the
  Technical Group on Population Projections, July 2020.
  TABLE-21 spans printed pages 259-260 = PDF pages 263-264.

Figures in the source are in THOUSANDS. We keep them in thousands here and let
build_units.py multiply, so the rounding stays visible in one place.

Run:  python scripts/extract_projections.py
"""
import json, os, re, sys
from pypdf import PdfReader

HERE = os.path.dirname(os.path.abspath(__file__))
PDF  = os.path.join(HERE, "raw", "Report_Population_Projection_2019.pdf")
OUT  = os.path.join(HERE, "raw", "projections_table21.json")

# Table 21 serial number -> our unit code. The table's serial numbers are its own
# ordering, NOT Census state codes. Sr 25 and 30 are the two halves of our DH.
SR_TO_CODE = {
    1:"JK",  2:"HP",  3:"PB",  4:"CH",  5:"UK",  6:"HR",  7:"DL",  8:"RJ",
    9:"UP", 10:"BR", 11:"SK", 12:"AR", 13:"NL", 14:"MN", 15:"MZ", 16:"TR",
    17:"ML",18:"AS", 19:"WB", 20:"JH", 21:"OD", 22:"CT", 23:"MP", 24:"GJ",
    25:"DH_dnh", 26:"MH", 27:"AP", 28:"KA", 29:"GA", 30:"DH_dd", 31:"LD",
    32:"KL", 33:"TN", 34:"PY", 35:"AN", 36:"TS", 37:"LA",
}
PAGES = {263: ["2011", "2016", "2021"], 264: ["2026", "2031", "2036"]}

num = lambda s: int(s.replace(",", ""))

def parse_page(text, years):
    """Each data row is: <sr> <name> then 9 numbers = 3 years x (persons, male, female).
    We keep the persons column of each year."""
    rows, india = {}, None
    for line in text.split("\n"):
        line = line.strip()
        if not line:
            continue
        if line.startswith("INDIA"):
            vals = re.findall(r"[\d,]+", line)
            if len(vals) >= 9:
                india = {y: num(vals[i * 3]) for i, y in enumerate(years)}
            continue
        m = re.match(r"^(\d{1,2})\s+(.+)$", line)
        if not m:
            continue
        sr = int(m.group(1))
        if sr not in SR_TO_CODE:
            continue
        vals = re.findall(r"[\d,]+", m.group(2))
        # Drop any numeral that is part of the NAME (none of our rows have one),
        # then require exactly the 9 data columns.
        if len(vals) < 9:
            continue
        vals = vals[-9:]
        rows[SR_TO_CODE[sr]] = {y: num(vals[i * 3]) for i, y in enumerate(years)}
    return rows, india

def main():
    if not os.path.exists(PDF):
        sys.exit(f"missing source PDF: {PDF}")
    reader = PdfReader(PDF)

    series, india_row = {}, {}
    for pg, years in PAGES.items():
        rows, india = parse_page(reader.pages[pg - 1].extract_text(), years)
        if india is None:
            sys.exit(f"could not find the INDIA row on PDF page {pg}")
        india_row.update(india)
        for code, vals in rows.items():
            series.setdefault(code, {}).update(vals)

    errs = []
    expected = set(SR_TO_CODE.values())
    missing = expected - set(series)
    if missing:
        errs.append(f"rows not parsed: {sorted(missing)}")

    all_years = ["2011", "2016", "2021", "2026", "2031", "2036"]
    for code, vals in series.items():
        gaps = [y for y in all_years if y not in vals]
        if gaps:
            errs.append(f"{code} missing years {gaps}")

    # Every column must sum to the published INDIA row. Thousands-rounded rows do
    # not have to add exactly, so allow a small slack and report the drift.
    drift = {}
    for y in all_years:
        tot = sum(v[y] for v in series.values() if y in v)
        drift[y] = tot - india_row[y]
        if abs(drift[y]) > 60:
            errs.append(f"{y}: rows sum to {tot} vs published INDIA {india_row[y]} (drift {drift[y]})")

    if errs:
        print("EXTRACTION FAILED:")
        for e in errs:
            print("  -", e)
        sys.exit(1)

    # Merge the two halves of Dadra & Nagar Haveli and Daman & Diu.
    series["DH"] = {y: series["DH_dnh"][y] + series["DH_dd"][y] for y in all_years}
    del series["DH_dnh"], series["DH_dd"]

    doc = {
        "$schema_version": "1.0",
        "generated_by": "scripts/extract_projections.py",
        "units": "thousands",
        "source": {
            "publisher": "National Commission on Population, Ministry of Health & Family Welfare",
            "document": ("Population Projections for India and States 2011-2036: "
                         "Report of the Technical Group on Population Projections"),
            "published": "July 2020",
            "table": "TABLE-21, Projected Total Population As on 1st March",
            "printed_pages": "259-260",
            "pdf_pages": "263-264",
            "url": "https://nhm.gov.in/New_Updates_2018/Report_Population_Projection_2019.pdf",
            "retrieved": "2026-09-12",
        },
        "notes": [
            "Figures are in thousands, as printed. The apportionment engine multiplies by 1000.",
            ("The table lists Dadra & Nagar Haveli (Sr 25) and Daman & Diu (Sr 30) separately. "
             "They are summed here into DH to match our single post-2020 unit."),
            ("Row 05 is printed as 'Uttaranchal' and row 01 as 'Jammu & Kashmir (UT)'. "
             "Mapped to UK and JK respectively."),
            ("The projection is as on 1 MARCH of each year, matching the census reference date."),
            ("Column sums differ from the published INDIA row by a few thousand because each row "
             "is independently rounded to thousands. Drift is recorded in column_drift_thousands."),
        ],
        "india_published": india_row,
        "column_drift_thousands": drift,
        "series": series,
    }
    with open(OUT, "w") as f:
        json.dump(doc, f, indent=2)

    print(f"OK. {len(series)} units x {len(all_years)} years -> {os.path.relpath(OUT, HERE)}")
    print("\nColumn checks (thousands):")
    for y in all_years:
        print(f"  {y}  published INDIA {india_row[y]:>9,}   rows sum drift {drift[y]:+,}")
    print("\nThe 2011 column is a base-year observation, not a projection. Use it to")
    print("cross-check units.json:")
    for code in ("AP", "TS", "JK", "LA", "DH", "UP", "TN", "KL"):
        print(f"  {code:3s} {series[code]['2011']:>8,} thousand")

if __name__ == "__main__":
    main()
