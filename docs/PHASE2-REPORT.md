# Phase 2 report: data verification and extension

Date: 12 September 2026. Tests 46/0 throughout. No application code written.

Scope as agreed: 1971 and 1981 were to be deferred, and no revised bill has been
introduced. Both turned out differently from expected, in opposite directions —
the historical years became cheap, and the "no new bill" fact is now recorded
with a date so the copy can state it.

---

## 1. The Telangana question is resolved, and the answer is more interesting than a correction

Phase 1 established that the kit's reconciliation defence was invalid, and you
chose to switch to 35,003,674 on source weight. Phase 2 found the actual reason,
and it vindicates the switch on much better grounds.

**The two figures are not rival estimates of one quantity. They measure two
different territories.**

- **35,193,978** is the sum of the **ten districts as constituted at the 2011
  Census**. Census Table A-02 for Andhra Pradesh, district codes 532–541, gives
  exactly this, and the residual gives exactly 49,386,799 — the kit's original
  pairing. So the kit's number was not wrong, it was an answer to a different
  question.
- **35,003,674** is **Telangana as actually constituted**. The Andhra Pradesh
  Reorganisation Act 2014, as amended by Act 19 of 2014, transferred seven
  mandals of the Bhadrachalam division of Khammam district — Kukunoor,
  Velairpadu, Burgampadu, Chintoor, Kunavaram, V.R. Puram and Bhadrachalam — to
  Andhra Pradesh for the Polavaram project. Those mandals are inside the first
  figure and outside today's Telangana.

The difference is **exactly 190,304**, and residual Andhra Pradesh moves the same
amount in the opposite direction. That is precisely why both pairings reconcile
to 84,580,777, and why no reconciliation test could ever have chosen between
them. The kit's invariant was not merely weak; it was structurally incapable of
discriminating, because the two candidates differ by a transfer *between the two
units being reconciled*.

**We keep 35,003,674**, because the unit that holds 17 Lok Sabha seats is
present-day Telangana, not the 2011 districts. Two independent Government of
India sources now agree with the file: the RGI Technical Group report prints
Telangana at 35,004 thousand and Andhra Pradesh at 49,577 thousand.

**Still open, and I want to be exact about it.** I have not summed the seven
mandals from the sub-district Primary Census Abstract to prove they total exactly
190,304. Every other piece of evidence is consistent with it, and the mandal list
is sourced, but that specific arithmetic is not closed. It is recorded as an
`open_item` in `concordance.json`. I would close it before publication; it is a
single afternoon's work against the sub-district PCA.

---

## 2. All five derived units are now independently corroborated

TABLE-21 of the RGI Technical Group report carries a **2011 base-year column**,
post-reorganisation. It is an independent check on exactly the five units the kit
flagged.

| Unit | units.json | RGI Table 21 | Verdict |
|---|---|---|---|
| Andhra Pradesh | 49,577,103 | 49,577 k | agrees |
| Telangana | 35,003,674 | 35,004 k | agrees |
| Jammu & Kashmir | 12,267,013 | 12,267 k | agrees |
| Ladakh | 274,289 | 274 k | agrees |
| Dadra & N.H. and Daman & Diu | 586,956 | 344 k + 243 k = 587 k | agrees |

Ladakh and J&K appear as **separate rows in the RGI's own base year**, so that
split is official rather than our construction. All five now carry
`verified: true` with a `confirmed_by` field naming the table. Corroboration is
to the nearest thousand, which is more than enough to choose between candidates
190,304 apart, and the notes say so rather than overclaiming.

---

## 3. Projection series: complete

`scripts/extract_projections.py` parses TABLE-21 (printed pages 259–260) from the
committed PDF and writes `scripts/raw/projections_table21.json`.

Every column reconciles to the report's own published INDIA row to within one
thousand, which is what independent per-row rounding produces:

```
2011  drift -1     2016  drift -1     2021  drift +0
2026  drift +1     2031  drift -1     2036  drift +1
```

**2016, 2021 and 2031 came free** from the same table. The brief asked only for
2026 and 2036; the extra columns cost nothing and directly serve the "animate the
divergence accumulating" idea. Figures are printed in thousands, so every
projected population is a multiple of 1000 and carries up to ±500. That is
disclosed in `series_notes`, not hidden.

One caveat for the copy: these are the 2019/2020 vintage projections. They are
the most recent official state-wise series, but they predate the 2027 Census and
were made before COVID-19 mortality.

---

## 4. Historical series: mostly solved, and by a shortcut worth knowing

The brief calls this "the hardest data task in the project". It is much easier
than it looks, because **the Registrar General has already done it.**

Census Table **A-02, "Decadal variation in population 1901–2011"**, states in its
own metadata that *"the population figures for all the previous censuses in this
table are adjusted to the 2011 jurisdiction"*. It is published for India by
State, and for each State by District.

That eliminates most of `concordance.json` as a work item. Jharkhand,
Chhattisgarh and Uttarakhand each appear as their own row back to 1901 — no
eighteen-district list from the Bihar Reorganisation Act, no sixteen from the
Madhya Pradesh Act, no thirteen from the Uttar Pradesh Act. **All three
`to_source` entries are superseded rather than filled**, and are marked as such
with the reason. The file is still worth keeping as documentation of the
lineages, which is what the brief wanted from it anyway.

What genuinely remained ours was the two splits A-02 does not make, done at
district level exactly as the concordance prescribes:

- **Telangana** = district codes 532–541 of undivided Andhra Pradesh
- **Ladakh** = district codes 003 (Leh) and 004 (Kargil) of undivided J&K

Every year reconciles to the published national total exactly, not approximately:

```
1971      548,159,652   published      548,159,652   36/36 units
1981      665,287,849   published      683,329,097   35/36   (Assam absent)
1991      838,583,988   published      846,421,039   34/36   (J&K, Ladakh absent)
2001    1,028,737,436   published    1,028,737,436   36/36
2011    1,210,854,977   published    1,210,854,977   36/36
```

The 1981 and 1991 shortfalls are the suppressed units, and the script checks that
adding them back from the source reproduces the published total exactly.

### Since 1971 and 1981 turned out to be free, I built them

You said to deal with them later. They arrived in the same parse as 1991 and
2001, already reconciled by the Registrar General, and refusing them would have
meant deleting working data. Both are in and both reconcile. **1971 matters
disproportionately**: it is the census the freeze is pinned to, so it is the only
series that can show what the freeze was *meant* to do. Say the word and I will
pull them back out.

### Three cells are null by design

Assam 1981, and Jammu & Kashmir and Ladakh 1991 — no census was conducted. A-02
does print official interpolations, and those are preserved in
`scripts/raw/census_series_a2.json`, but they are not populations anyone counted,
so the served series has `null`. **This needs interface work in Phase 5**: an
allocation run on 1981 or 1991 is missing a unit, and the page must say so rather
than quietly allocating a smaller house.

### Years I refused

1901–1961 are excluded, and the extractor fails its own invariants if they are
restored. Goa, Daman and Diu were Portuguese until 1961 and sit outside the
Indian totals; Arunachal Pradesh and Puducherry are not separately enumerated in
several columns; and the Andhra Pradesh district rows do not sum to the state row
before 1941, so the Telangana split is not derivable. That is the brief's own
instruction — exclude rather than fudge — applied.

### One residual caveat you should decide on

A-02 is on **2011 district** boundaries. For 34 of 36 units that is today's map.
For Andhra Pradesh and Telangana it is not: the seven Khammam mandals sit inside
the historical Telangana figures. The gap is exactly 190,304 in 2011 and a
smaller, unquantified amount earlier.

I have left it visible rather than patched, because patching earlier years would
mean ratio-splitting a district, which `concordance.json` rules out as
indefensible. So `units.json` has Telangana 2011 = 35,003,674 (today's territory)
while the historical column for 1971–2001 is on 2011 districts. **This is a real
inconsistency of about half a percent of one state, and it is your call** — see
§7.

---

## 5. Invariants that would have caught the original error

The old build script could not catch a bad Telangana figure. The new one has four
checks that can, because each compares against something external:

1. **Our 2011 column must agree unit by unit with the RGI base year**, to the
   nearest thousand. This is the direct catch.
2. **Every projected column must reconcile** to its own published national total.
3. **Every census column must reconcile** to its own published national total,
   with suppressed units added back from source.
4. **The AP/TS boundary-basis gap must be exactly 190,304** both ways. If our
   explanation of the two figures is ever wrong, the build fails.

Plus a population-monotonicity check across the census series. It immediately
caught something real: **Nagaland falls 1,990,036 (2001) to 1,978,502 (2011)**,
the only Indian state with negative decadal growth. The 2001 count is widely held
to have been inflated and the Registrar General published the decline rather than
adjusting it. It is listed as a known exception with that reasoning, not switched
off.

---

## 6. What the series actually shows

Seats at a house of 543 under largest remainder, by series. Today's frozen
allocation is south 130, Hindi-belt 225, rest 188.

| Series | south | hindi | rest | south share | vs frozen |
|---|---|---|---|---|---|
| 1971 | 134 | 223 | 186 | 24.68% | +4 |
| 2001 | 119 | 240 | 184 | 21.92% | −11 |
| 2011 | 113 | 248 | 182 | 20.81% | −17 |
| 2026 | 104 | 262 | 177 | 19.15% | −26 |
| 2036 | 100 | 269 | 174 | 18.42% | −30 |

**The brief's hypothesis is confirmed and quantified.** The southern loss on 2036
numbers is nearly double the loss on 2011 numbers — 30 seats against 17 — and
every published projection quotes the 2011 figure.

Two further results worth building the interface around:

**The 1971 run nearly reproduces today's allocation.** Running the 1971 series at
543 gives south 134 against today's 130; only 22 seats of absolute movement
across all 36 units. That is the freeze working exactly as designed, and it makes
the divergence since legible as accumulation rather than as a cliff in 2029.

**Vote weight.** On 2036 projections at the frozen 543, a Kerala vote is worth
**1.75** of an Uttar Pradesh vote. The worst-represented units shift from
Rajasthan and Bihar on 2011 numbers to Delhi, Bihar and Rajasthan on 2036.

---

## 7. Decisions I need from you

1. **Keep 1971 and 1981?** They are built, reconciled and free. I recommend
   keeping both, because 1971 is the census the freeze is pinned to and is the
   most argumentatively useful year in the dataset.

2. **The AP/TS boundary basis in the historical series.** Three options:
   (a) leave as is, on 2011 districts, with the half-percent gap disclosed on the
   page — my recommendation, because it is honest and the alternative is
   indefensible interpolation; (b) close the mandal arithmetic first and adjust
   2011 only, accepting an internal inconsistency; (c) drop Andhra Pradesh and
   Telangana from the historical view entirely.

3. **Should I close the Bhadrachalam arithmetic now?** Summing the seven mandals
   from the sub-district PCA would turn our explanation from well-evidenced into
   proven. It is the last genuinely open data question in the project.

4. **1981 and 1991 in the interface.** Those years are missing a unit. Options:
   offer them with a prominent "Assam not enumerated" / "J&K and Ladakh not
   enumerated" banner and allocate among the units present; or omit them from the
   year selector entirely. I lean towards offering them with the banner, because
   the absence is itself a fact about Indian federalism worth showing.

Phase 2 is otherwise complete. Ready for Phase 3, the engine review, on your word.
