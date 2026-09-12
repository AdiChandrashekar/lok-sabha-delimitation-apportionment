#!/usr/bin/env python3
"""
Closes the last open data question in the project: does the territory that moved
from Telangana to Andhra Pradesh in 2014 account for exactly 190,304 people, the
gap between the two circulating Telangana 2011 populations?

METHOD. The Andhra Pradesh Reorganisation (Amendment) Act, 2014 (No. 19 of 2014)
redefines Telangana's Khammam district as excluding:

  - the Mandals of Kukunoor, Velairpadu and Bhurgampadu, "but not including" the
    revenue villages of Pinapaka, Morampalli Banzar, Bhurgampad, Nagineniprolu,
    Krishnasagar, Tekula, Sarapaka, Iravendi, Mothepattinagar, Uppusaka,
    Sompalli and Nakripeta under the Palvancha Revenue Division; and
  - the Mandals of Chintoor, Kunavaram, Vararamachandrapuram and Bhadrachalam,
    "but not including" the revenue village of Bhadrachalam.

So seven whole mandals moved, less thirteen named revenue villages that stayed
in Telangana. We therefore expect:

    (population of the seven mandals) - (population of the thirteen villages)
      == 190,304

Source: District Census Handbook 2011, Khammam (district code 2810), inset table
Appendix VD, "Village Directory - Amenities and Land use", which gives the 2011
population of every revenue village by CD block.
  https://censusindia.gov.in/nada/index.php/catalog/142

Run:  python scripts/verify_bhadrachalam.py
"""
import glob, os, re, sys
import xlrd

HERE = os.path.dirname(os.path.abspath(__file__))
RAW  = os.path.join(HERE, "raw")
SRC  = os.path.join(RAW, "khammam_dchb", "Appendix_VD_2810.xls")

TRANSFERRED_MANDALS = ["Kukunoor", "Velairpadu", "Burgampahad",
                       "Chintur", "Kunavaram", "Vararamachandrapuram", "Bhadrachalam"]

# The revenue villages the Act keeps in Telangana, keyed by the normalised CENSUS
# spelling, valued by the Act's spelling. The two differ in most cases and the
# mapping is spelled out so a reader can audit every substitution.
#
# All eleven of these sit in the Burgampahad CD block.
RETAINED = {
    "pinapakapattinagar":  "Pinapaka",
    "morampalle":          "Morampalli Banzar",
    "burgampahad":         "Bhurgampad",
    "nagineniprolu":       "Nagineniprolu",
    "krishnasagar":        "Krishnasagar",
    "tekula":              "Tekula",
    "irvendi":             "Iravendi",
    "mothepattinagar":     "Mothepattinagar",
    "uppusaka":            "Uppusaka",
    "sompalle":            "Sompalli",
    "nakirapeta":          "Nakripeta",
}

# Two of the places the Act keeps in Telangana are enumerated as TOWNS, not
# revenue villages, so they are absent from the rural village directory. They are
# therefore absent from the mandal totals too, and drop out of both sides of the
# subtraction. Listing them here documents that this is deliberate.
RETAINED_URBAN = ["Sarapaka", "Bhadrachalam"]

# NOTE ON WHICH VERSION OF THE LIST TO USE. The unamended Andhra Pradesh
# Reorganisation Act, 2014 named a different and shorter set, "the revenue
# villages of Bhurgampadu, Seetharamanagaram and Kondreka". Act 19 of 2014
# replaced that wording with the twelve-village list used here. Seetharama Nagar
# (location code 579346, population 1,332) is in the Burgampahad block and is NOT
# retained under the amended Act; including it would break the reconciliation by
# exactly its own population, which is a useful check that the amended list is
# the operative one.
EXPECTED_GAP = 190304

norm = lambda s: re.sub(r"[^a-z]", "", str(s).lower())

def read_villages(path):
    """Yield (cd_block, village_name, location_code, population)."""
    ws = xlrd.open_workbook(path).sheets()[0]
    block = None
    for i in range(ws.nrows):
        row = ws.row_values(i)
        for cell in row[:6]:
            m = re.search(r"Name of CD Block\s*:?-?\s*(.+)", str(cell))
            if m:
                block = m.group(1).strip()
        name, code, pop = row[1], row[2], row[4]
        if not block or not str(name).strip():
            continue
        try:
            pop = int(float(pop))
            code = str(code).split(".")[0].strip()
        except (ValueError, TypeError):
            continue
        if not re.fullmatch(r"\d{4,8}", code):
            continue
        yield block, str(name).strip(), code, pop

def main():
    if not os.path.exists(SRC):
        sys.exit(f"missing source workbook: {SRC}\n"
                 f"Download the Khammam DCHB inset tables from catalog 142 and unpack them there.")

    villages = list(read_villages(SRC))
    if not villages:
        sys.exit("parsed no villages; the workbook layout has changed")

    blocks = {}
    for b, n, c, p in villages:
        blocks.setdefault(norm(b), []).append((b, n, c, p))

    errs, picked = [], []
    for want in TRANSFERRED_MANDALS:
        key = next((k for k in blocks if norm(want) in k or k in norm(want)), None)
        if key is None:
            errs.append(f"CD block not found in the handbook: {want}")
            continue
        picked.append((want, blocks[key]))
    if errs:
        print("FAILED:"); [print("  -", e) for e in errs]
        print("\n  blocks present:", ", ".join(sorted({b for b, *_ in villages})))
        sys.exit(1)

    total_seven = sum(p for _w, vs in picked for _b, _n, _c, p in vs)

    retained_found, seen = [], set()
    for _w, vs in picked:
        for b, n, c, p in vs:
            k = norm(n)
            if k in RETAINED and c not in seen:
                seen.add(c)
                retained_found.append((RETAINED[k], b, n, c, p))
    total_retained = sum(p for *_x, p in retained_found)
    transferred = total_seven - total_retained

    print("Seven mandals named in the Act, 2011 Census village-directory population:")
    for w, vs in picked:
        print(f"  {w:<26} {len(vs):>4} villages  {sum(p for *_x, p in vs):>9,}")
    print(f"  {'TOTAL':<26} {sum(len(vs) for _w, vs in picked):>4} villages  {total_seven:>9,}")

    print(f"\nRevenue villages the Act keeps in Telangana ({len(retained_found)} matched "
          f"of {len(set(RETAINED.values()))} named):")
    for label, b, n, c, p in sorted(retained_found, key=lambda x: -x[4]):
        same = "" if norm(label) == norm(n) else f"  [Act: {label}]"
        print(f"  {n:<26} {b:<22} {c:>9} {p:>8,}{same}")
    print(f"  {'TOTAL RETAINED':<26} {'':<22} {'':>9} {total_retained:>8,}")

    print(f"\n  seven mandals      {total_seven:>10,}")
    print(f"  less retained      {total_retained:>10,}")
    print(f"  net transferred    {transferred:>10,}")
    print(f"  expected gap       {EXPECTED_GAP:>10,}")
    print(f"  difference         {transferred - EXPECTED_GAP:>+10,}")

    missing = set(RETAINED.values()) - {r[0] for r in retained_found}
    if missing:
        print(f"\n  FAILED TO MATCH: {', '.join(sorted(missing))}")
        return 2
    print(f"\n  Also retained but enumerated as towns, so outside this rural table on both")
    print(f"  sides of the subtraction: {', '.join(RETAINED_URBAN)}.")

    if transferred == EXPECTED_GAP:
        print("\nCLOSED. The territory named in Act 19 of 2014 accounts for the gap between")
        print("the two circulating Telangana 2011 populations exactly, to the person:")
        print(f"  35,193,978  ten districts as constituted at the 2011 Census")
        print(f"    -{EXPECTED_GAP:,}  territory transferred to Andhra Pradesh in 2014")
        print(f"  35,003,674  Telangana as actually constituted, which is what units.json uses")
        return 0
    print("\nNOT CLOSED. See the residual above before relying on the explanation.")
    return 2

if __name__ == "__main__":
    sys.exit(main())
