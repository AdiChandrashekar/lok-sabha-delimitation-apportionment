/* ---------------------------------------------------------------------------
   Loads and normalises the data files. No DOM, no rendering.

   The TopoJSON decoder here is about twenty lines, which is why there is no
   second CDN dependency for it. Keeping the runtime down to one external
   script (d3) is deliberate: this has to still work untouched in three years.
--------------------------------------------------------------------------- */

export const YEAR_LABELS = {
  "1971": "1971 Census",
  "1981": "1981 Census",
  "1991": "1991 Census",
  "2001": "2001 Census",
  "2011": "2011 Census",
  "2016_proj": "2016 projection",
  "2021_proj": "2021 projection",
  "2026_proj": "2026 projection",
  "2031_proj": "2031 projection",
  "2036_proj": "2036 projection",
};

export const YEAR_NOTES = {
  "1971": "The census the freeze is pinned to. Running this series shows what the freeze was meant to do.",
  "1981": "Assam was not enumerated in 1981. It is absent from this allocation.",
  "1991": "Jammu & Kashmir and Ladakh were not enumerated in 1991. Both are absent from this allocation.",
  "2001": "Census of India 2001, recast to 2011 boundaries by the Registrar General.",
  "2011": "The most recent census, and the basis of every published projection.",
  "2016_proj": "Official projection. Printed in thousands, so each figure carries up to ±500.",
  "2021_proj": "Official projection. Printed in thousands, so each figure carries up to ±500.",
  "2026_proj": "Official projection. The nearest series to today, and fifteen years fresher than 2011.",
  "2031_proj": "Official projection. Printed in thousands, so each figure carries up to ±500.",
  "2036_proj": "Official projection. The southern loss here is roughly double the loss on 2011 numbers.",
};

export const GROUP_LABELS = { south: "South", hindi: "Hindi-belt", rest: "Everywhere else" };

/* Zonal councils are OFFICIAL, unlike the analytical grouping above: they come
   from the States Reorganisation Act 1956 and the North Eastern Council Act
   1971. Andaman & Nicobar and Lakshadweep belong to no council. */
export const ZONE_LABELS = {
  southern: "Southern Council", northern: "Northern Council",
  central: "Central Council", eastern: "Eastern Council",
  western: "Western Council", nec: "North Eastern Council",
  none: "No council",
};

/* Categorical fills for the chamber. Distinct in hue rather than only in
   lightness, so they survive greyscale and the common colour-blindness types. */
export const BLOC_COLOURS = {
  south: "#17607a", hindi: "#b3722a", rest: "#6b7a86",
  southern: "#17607a", northern: "#7a5aa0", central: "#b3722a",
  eastern: "#c0563a", western: "#3f7d5e", nec: "#d2a02e", none: "#98a2aa",
};

/* --- TopoJSON -> GeoJSON, quantised-arc form only ------------------------- */
function topoToFeatures(topo, objectName) {
  const { scale: [sx, sy], translate: [tx, ty] } = topo.transform;
  const arcs = topo.arcs.map(arc => {
    let x = 0, y = 0;
    return arc.map(([dx, dy]) => { x += dx; y += dy; return [x * sx + tx, y * sy + ty]; });
  });
  const pick = i => (i < 0 ? arcs[~i].slice().reverse() : arcs[i]);
  const ring = ix => {
    const out = [];
    for (const i of ix) { const p = pick(i); out.push(...(out.length ? p.slice(1) : p)); }
    return out;
  };
  const poly = rs => rs.map(ring);
  return {
    type: "FeatureCollection",
    features: topo.objects[objectName].geometries.map(g => ({
      type: "Feature",
      id: g.properties.code,
      properties: g.properties,
      geometry: g.type === "Polygon"
        ? { type: "Polygon", coordinates: poly(g.arcs) }
        : { type: "MultiPolygon", coordinates: g.arcs.map(poly) },
    })),
  };
}

export async function loadAll() {
  const [unitsDoc, topo] = await Promise.all([
    fetch("data/units.json").then(r => {
      if (!r.ok) throw new Error(`units.json: HTTP ${r.status}`);
      return r.json();
    }),
    fetch("data/boundaries.topo.json").then(r => {
      if (!r.ok) throw new Error(`boundaries.topo.json: HTTP ${r.status}`);
      return r.json();
    }),
  ]);

  const units = unitsDoc.units;
  const byCode = new Map(units.map(u => [u.code, u]));
  const geo = topoToFeatures(topo, "states");

  /* A silent mismatch here would show an empty map, so fail loudly instead. */
  const missing = units.filter(u => !geo.features.some(f => f.id === u.code)).map(u => u.code);
  if (missing.length) throw new Error(`no geometry for: ${missing.join(", ")}`);

  const years = Object.keys(units[0].population)
    .filter(y => units.some(u => u.population[y] != null));

  return { unitsDoc, units, byCode, geo, topoSource: topo.source, years };
}

/* --- derived metrics for one allocation ----------------------------------- */
export function buildRows(units, result, year) {
  const seats = result.seats ?? {};
  const absent = new Set(result.absent ?? []);
  const scored = units.filter(u => !absent.has(u.code));
  const totalPop = scored.reduce((s, u) => s + u.population[year], 0);
  const totalSeats = Object.values(seats).reduce((a, b) => a + b, 0);
  const natlPerMp = totalSeats ? totalPop / totalSeats : 0;
  /* The comparison baseline for "today" is always the real 543-seat house on
     the same population series, so vote weight is comparable across scenarios. */
  const natlNow = scored.reduce((s, u) => s + u.population[year], 0) /
                  scored.reduce((s, u) => s + u.current_seats, 0);

  return units.map(u => {
    const isAbsent = absent.has(u.code);
    const pop = u.population[year];
    const now = u.current_seats;
    const got = isAbsent ? null : (seats[u.code] ?? 0);
    const perMp = isAbsent ? null : pop / got;
    return {
      code: u.code,
      name: u.name,
      type: u.type,
      group: u.analytical_group,
      zone: u.zonal_council,
      absent: isAbsent,
      population: isAbsent ? null : pop,
      current: now,
      seats: got,
      change: isAbsent ? null : got - now,
      pctChange: isAbsent ? null : (got - now) / now,
      perMp,
      /* >1 means a vote there is worth more than the average vote. */
      voteWeight: isAbsent ? null : natlPerMp / perMp,
      voteWeightNow: isAbsent ? null : natlNow / (pop / now),
      share: isAbsent ? null : (totalSeats ? got / totalSeats : 0),
      shareNow: now / 543,
    };
  });
}

export function groupTotals(rows) {
  const out = {};
  for (const g of ["south", "hindi", "rest"]) {
    const rs = rows.filter(r => r.group === g && !r.absent);
    out[g] = {
      seats: rs.reduce((a, r) => a + r.seats, 0),
      current: rows.filter(r => r.group === g).reduce((a, r) => a + r.current, 0),
      population: rs.reduce((a, r) => a + r.population, 0),
    };
  }
  return out;
}

export const fmt = {
  n: v => (v == null ? "—" : v.toLocaleString("en-IN")),
  d: v => (v == null ? "—" : (v > 0 ? "+" : "") + v),
  pct: v => (v == null ? "—" : (v > 0 ? "+" : "") + (v * 100).toFixed(1) + "%"),
  share: v => (v == null ? "—" : (v * 100).toFixed(1) + "%"),
  w: v => (v == null ? "—" : v.toFixed(2)),
  /* Indian numbering is what the audience reads, but a bare lakh/crore string
     is hard to compare, so big numbers keep their digits and get a suffix. */
  people: v => {
    if (v == null) return "—";
    if (v >= 1e7) return (v / 1e7).toFixed(2) + " crore";
    if (v >= 1e5) return (v / 1e5).toFixed(2) + " lakh";
    return v.toLocaleString("en-IN");
  },
};
