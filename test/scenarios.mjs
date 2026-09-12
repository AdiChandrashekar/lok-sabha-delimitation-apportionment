/* The regression scenarios, shared by the snapshot writer and the test runner
   so the two can never disagree about what is being pinned.

   Regenerate the snapshot with:  node scripts/make_snapshot.mjs
   Only do that when you MEAN to change the output, and say what moved in the
   commit message. The whole point is that a refactor cannot quietly change an
   allocation. */
export const SCENARIOS = [
  // The published-projection reference points.
  { name: "hare@543",                   method: "hare",        H: 543, opts: {} },
  { name: "hare@815",                   method: "hare",        H: 815, opts: {} },
  { name: "huntington@815",             method: "huntington",  H: 815, opts: {} },
  { name: "sainteLague@815",            method: "sainteLague", H: 815, opts: {} },
  { name: "dhondt@815",                 method: "dhondt",      H: 815, opts: {} },
  { name: "cubeRoot@815",               method: "cubeRoot",    H: 815, opts: {} },
  { name: "baseProp@815+base2",         method: "baseProp",    H: 815, opts: { baseSeats: 2 } },
  { name: "baseProp@815+base5",         method: "baseProp",    H: 815, opts: { baseSeats: 5 } },

  // Constraints.
  { name: "hare@815+protectAll",        method: "hare",        H: 815, opts: { protectAll: true } },
  { name: "hare@700+protectSmall",      method: "hare",        H: 700, opts: { protectSmall: true } },
  { name: "hare@848+maxChange5",        method: "hare",        H: 848, opts: { maxChange: 5 } },
  { name: "huntington@888+maxChange10", method: "huntington",  H: 888, opts: { maxChange: 10 } },
  { name: "hare@600+maxChange2",        method: "hare",        H: 600, opts: { maxChange: 2 } },

  // Every population series, on the rule the published projections use.
  { name: "hare@543+1971",              method: "hare",        H: 543, opts: { year: "1971" } },
  { name: "hare@543+2001",              method: "hare",        H: 543, opts: { year: "2001" } },
  { name: "hare@543+2026",              method: "hare",        H: 543, opts: { year: "2026_proj" } },
  { name: "hare@543+2036",              method: "hare",        H: 543, opts: { year: "2036_proj" } },
  { name: "hare@815+2036",              method: "hare",        H: 815, opts: { year: "2036_proj" } },

  // Years with a genuinely absent unit, which must allocate over the rest and
  // report the absence rather than imputing a figure.
  { name: "hare@543+1981",              method: "hare",        H: 543, opts: { year: "1981" } },
  { name: "hare@543+1991",              method: "hare",        H: 543, opts: { year: "1991" } },
];
