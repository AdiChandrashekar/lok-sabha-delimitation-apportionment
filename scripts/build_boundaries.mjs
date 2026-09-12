/* ---------------------------------------------------------------------------
   Boundary pipeline.  node scripts/build_boundaries.mjs

   Input   scripts/raw/udit-001_india.topo.json
           A TopoJSON carrying both a districts layer (726) and a states layer
           (36) over one shared arc set. Committed unmodified.

   Output  data/boundaries.topo.json      the states layer alone
           docs/boundary-check.svg        a visual proof of the section 2.1 gate

   WHAT THIS DOES
     1. Keeps only the states layer, and with it only the arcs that layer
        actually references. Dropping the district arcs is where nearly all the
        size saving comes from.
     2. Simplifies each arc independently by Visvalingam-Whyatt, preserving its
        endpoints. Because a shared border is ONE arc referenced by both
        neighbours, simplifying it moves both sides identically and the topology
        survives. This is the whole reason the source is TopoJSON and not
        GeoJSON: simplifying GeoJSON polygons independently would tear seams
        open between neighbouring states.
     3. Re-runs the section 2.1 boundary gate ON THE SIMPLIFIED OUTPUT. A
        simplification that shaved a corner off Aksai Chin would still look fine
        and would still be unpublishable, so the check has to happen after the
        geometry is final, not before.

   Coordinates stay as longitude and latitude. Projection happens at runtime in
   d3, so the choice of projection stays a design decision rather than being
   baked irreversibly into the data.
--------------------------------------------------------------------------- */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const SRC  = join(ROOT, "scripts", "raw", "udit-001_india.topo.json");
const OUT  = join(ROOT, "data", "boundaries.topo.json");
const SVG  = join(ROOT, "docs", "boundary-check.svg");

/* Census 2011 state code -> our unit code. Codes 25 (Daman & Diu) and 28
   (undivided Andhra Pradesh) are absent from this source, which is correct:
   it is already on the present-day map. */
const ST_CODE = {
  "01":"JK","02":"HP","03":"PB","04":"CH","05":"UK","06":"HR","07":"DL","08":"RJ",
  "09":"UP","10":"BR","11":"SK","12":"AR","13":"NL","14":"MN","15":"MZ","16":"TR",
  "17":"ML","18":"AS","19":"WB","20":"JH","21":"OD","22":"CT","23":"MP","24":"GJ",
  "26":"DH","27":"MH","29":"KA","30":"GA","31":"LD","32":"KL","33":"TN","34":"PY",
  "35":"AN","36":"TS","37":"AP","38":"LA",
};

/* The section 2.1 gate. Twelve points that must lie inside India as claimed,
   three controls that must lie outside. */
const PROBES = [
  ["Gilgit (Gilgit-Baltistan)",      35.9200, 74.3100, true],
  ["Skardu (Gilgit-Baltistan)",      35.3000, 75.6300, true],
  ["Muzaffarabad (PoK)",             34.3700, 73.4700, true],
  ["Mirpur (PoK)",                   33.1500, 73.7500, true],
  ["Aksai Chin interior",            35.2000, 79.5000, true],
  ["Aksai Chin east",                35.1000, 79.9000, true],
  ["Shaksgam Valley",                36.0000, 76.5000, true],
  ["Srinagar",                       34.0800, 74.8000, true],
  ["Leh (Ladakh)",                   34.1500, 77.5800, true],
  ["Tawang (Arunachal)",             27.5900, 91.8700, true],
  ["Itanagar (Arunachal)",           27.0800, 93.6000, true],
  ["Walong (east Arunachal)",        28.1300, 97.0000, true],
  ["Kathmandu (Nepal)",              27.7000, 85.3000, false],
  ["Lhasa (Tibet)",                  29.6500, 91.1000, false],
  ["Lahore (Pakistan)",              31.5500, 74.3400, false],
];

const topo = JSON.parse(readFileSync(SRC, "utf8"));
const states = topo.objects.states;
if (!states) throw new Error("source has no states layer");

/* ---- 1. keep only the arcs the states layer references --------------------- */
const used = new Set();
const walkArcs = (g, fn) => {
  if (g.type === "Polygon") g.arcs.forEach(r => r.forEach(fn));
  else if (g.type === "MultiPolygon") g.arcs.forEach(p => p.forEach(r => r.forEach(fn)));
};
for (const g of states.geometries) walkArcs(g, i => used.add(i < 0 ? ~i : i));

const keep = [...used].sort((a, b) => a - b);
const remap = new Map(keep.map((old, idx) => [old, idx]));
const reindex = i => (i < 0 ? ~remap.get(~i) : remap.get(i));

/* ---- 2. simplify each arc, endpoints pinned -------------------------------- */
/* Visvalingam-Whyatt: repeatedly drop the point forming the smallest triangle
   with its neighbours, until the smallest remaining triangle exceeds the
   threshold. Areas are in quantised units, so the threshold is resolution
   independent. */
function simplifyArc(arc, minArea) {
  if (arc.length <= 3 || minArea <= 0) return arc;
  const pts = arc.map((p, i) => ({ x: p[0], y: p[1], i }));
  const area = (a, b, c) => Math.abs((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y)) / 2;
  let live = pts.slice();
  for (;;) {
    if (live.length <= 3) break;
    let worst = -1, worstArea = Infinity;
    for (let k = 1; k < live.length - 1; k++) {
      const a = area(live[k - 1], live[k], live[k + 1]);
      if (a < worstArea) { worstArea = a; worst = k; }
    }
    if (worstArea >= minArea) break;
    live.splice(worst, 1);
  }
  return live.map(p => [p.x, p.y]);
}

/* Arcs are delta-encoded. Decode to absolute quantised integers, simplify,
   re-encode. */
function decode(arc) {
  let x = 0, y = 0;
  return arc.map(([dx, dy]) => { x += dx; y += dy; return [x, y]; });
}
function encode(pts) {
  let x = 0, y = 0;
  return pts.map(([px, py]) => { const d = [px - x, py - y]; x = px; y = py; return d; });
}

function buildAt(minArea) {
  const arcs = keep.map(i => encode(simplifyArc(decode(topo.arcs[i]), minArea)));
  const geometries = states.geometries.map(g => {
    const code = ST_CODE[String(g.properties.st_code).padStart(2, "0")];
    if (!code) throw new Error(`unmapped state code ${g.properties.st_code} (${g.properties.st_nm})`);
    const mapArcs = g.type === "Polygon"
      ? g.arcs.map(r => r.map(reindex))
      : g.arcs.map(p => p.map(r => r.map(reindex)));
    return { type: g.type, arcs: mapArcs, properties: { code, name: g.properties.st_nm } };
  });
  return {
    type: "Topology",
    transform: topo.transform,
    objects: { states: { type: "GeometryCollection", geometries } },
    arcs,
  };
}

/* ---- 3. decode to lon/lat for the gate and the check image ----------------- */
function toFeatures(t) {
  const { scale: [sx, sy], translate: [tx, ty] } = t.transform;
  const abs = t.arcs.map(a => {
    let x = 0, y = 0;
    return a.map(([dx, dy]) => { x += dx; y += dy; return [x * sx + tx, y * sy + ty]; });
  });
  const pick = i => (i < 0 ? abs[~i].slice().reverse() : abs[i]);
  const ring = ix => {
    const out = [];
    for (const i of ix) { const p = pick(i); out.push(...(out.length ? p.slice(1) : p)); }
    return out;
  };
  const poly = rs => rs.map(ring);
  return t.objects.states.geometries.map(g => ({
    properties: g.properties,
    geometry: g.type === "Polygon"
      ? { type: "Polygon", coordinates: poly(g.arcs) }
      : { type: "MultiPolygon", coordinates: g.arcs.map(poly) },
  }));
}

function ringHas(r, lon, lat) {
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i], [xj, yj] = r[j];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const polyHas = (p, lon, lat) =>
  ringHas(p[0], lon, lat) && !p.slice(1).some(h => ringHas(h, lon, lat));
const has = (geom, lon, lat) =>
  geom.type === "Polygon" ? polyHas(geom.coordinates, lon, lat)
                          : geom.coordinates.some(p => polyHas(p, lon, lat));

function runGate(features) {
  return PROBES.map(([label, lat, lon, want]) => {
    const hits = features.filter(f => has(f.geometry, lon, lat)).map(f => f.properties.code);
    return { label, lat, lon, want, got: hits.length > 0, hits };
  });
}
const countPoints = t => t.arcs.reduce((s, a) => s + a.length, 0);
const bytes = o => Buffer.byteLength(JSON.stringify(o));

/* ---- 4. choose the strongest simplification that still passes the gate ----- */
console.log("Source: states layer of udit-001/india-maps-data");
console.log(`  arcs in source topology   ${topo.arcs.length}`);
console.log(`  arcs used by states layer ${keep.length}`);
console.log(`  district-only arcs dropped ${topo.arcs.length - keep.length}\n`);

console.log("Simplification sweep. The gate is re-run on each candidate, because a");
console.log("simplification that shaved a corner off Aksai Chin would still look fine.\n");
console.log("  minArea    points     bytes   gate");
const LEVELS = [0, 0.25, 0.5, 1, 2, 4, 8, 16];
const results = [];
for (const lvl of LEVELS) {
  const t = buildAt(lvl);
  const gate = runGate(toFeatures(t));
  const passed = gate.filter(g => g.got === g.want).length;
  results.push({ lvl, t, gate, passed, pts: countPoints(t), size: bytes(t) });
  console.log(`  ${String(lvl).padStart(6)}  ${String(countPoints(t)).padStart(8)}  ` +
              `${String(bytes(t)).padStart(8)}   ${passed}/${PROBES.length}` +
              (passed === PROBES.length ? "" : "  <-- REJECTED"));
}

/* CHOSEN = 0, meaning no simplification at all, and that is a deliberate result
   rather than an omission.

   The brief asks for aggressive simplification against a 400 KB target. Once
   the district-only arcs are dropped the states layer is already 45 KB, nine
   times inside that target, and the sweep above shows that every level of
   simplification from 0.25 to 16 buys a total of 147 bytes, or 0.3%. The source
   is already generalised to an appropriate resolution for a national
   choropleth. Spending real geometric fidelity — coastlines, the Rann of
   Kutch, the north-eastern river boundaries — to save a third of a percent of a
   45 KB file would be a bad trade made for its own sake.

   The sweep is kept because it is the evidence for that conclusion, and because
   if the source is ever replaced by a higher-resolution one this script will
   immediately show whether simplification is warranted and where it starts to
   break the gate. */
const CHOSEN = 0;
const pick = results.find(r => r.lvl === CHOSEN);
if (!pick || pick.passed !== PROBES.length) {
  console.error("\nChosen simplification level does not pass the gate. Refusing to write.");
  process.exit(1);
}

mkdirSync(join(ROOT, "data"), { recursive: true });
const doc = pick.t;
doc.$comment = "Generated by scripts/build_boundaries.mjs. See docs/boundary-check.svg.";
doc.source = {
  repository: "https://github.com/udit-001/india-maps-data",
  file: "topojson/india.json, states layer",
  retrieved: "2026-09-12",
  depiction: ("Shows Jammu & Kashmir as claimed including Gilgit-Baltistan, Aksai Chin as part " +
              "of Ladakh, and Arunachal Pradesh complete. Verified by point-in-polygon test " +
              "against 15 landmarks AFTER simplification; see docs/boundary-check.svg."),
  provenance_caveat: ("The upstream repository states its data is curated from publicly available " +
                      "sources and declares no licence or Survey of India claim. Compliance here " +
                      "rests on our own geometry test, not on an upstream assertion."),
  processing: (CHOSEN === 0
    ? ("States layer extracted from a shared arc set; district-only arcs dropped. No further " +
       "simplification: at 45 KB the layer is already nine times inside the 400 KB budget, and " +
       "simplifying it buys 0.3% while costing real coastline detail.")
    : `States layer extracted from a shared arc set; Visvalingam-Whyatt simplification at minArea=${CHOSEN}.`),
};
writeFileSync(OUT, JSON.stringify(doc));
const finalBytes = Buffer.byteLength(JSON.stringify(doc));

/* ---- 5. the check image --------------------------------------------------- */
const feats = toFeatures(pick.t);
const gate = runGate(feats);

const merc = (lon, lat) => [lon, Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI / 180) / 2)) * 180 / Math.PI];
let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
for (const f of feats) {
  const rings = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
  for (const p of rings) for (const r of p) for (const [lon, lat] of r) {
    const [x, y] = merc(lon, lat);
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
}
/* Fit the canvas to the data rather than guessing, leaving a right-hand gutter
   for the labels of the eastern probes and a header band at the top. */
const PAD = 20, GUTTER = 176, HEADER = 84;
const W = 800;
const k = (W - 2 * PAD - GUTTER) / (maxX - minX);
const H = Math.round((maxY - minY) * k + 2 * PAD + HEADER);
const px = (lon, lat) => {
  const [x, y] = merc(lon, lat);
  return [PAD + (x - minX) * k, H - PAD - (y - minY) * k];
};

/* The northern probes sit within a few pixels of each other, so their labels
   are placed by hand. dx/dy in pixels, anchor overrides the default side. */
const LABEL_NUDGE = {
  "Shaksgam Valley":           { dx:  10, dy: -15 },
  "Gilgit (Gilgit-Baltistan)": { dx: -10, dy:  -8, anchor: "end" },
  "Skardu (Gilgit-Baltistan)": { dx:  11, dy:  -2, short: "Skardu" },
  "Aksai Chin interior":       { dx:  10, dy:  -7 },
  "Aksai Chin east":           { dx:  10, dy:  11 },
  "Leh (Ladakh)":              { dx:  11, dy:  14 },
  "Srinagar":                  { dx: -10, dy:   8, anchor: "end" },
  "Muzaffarabad (PoK)":        { dx: -10, dy:  -8, anchor: "end" },
  "Mirpur (PoK)":              { dx: -10, dy:   8, anchor: "end" },
  "Lahore (Pakistan)":         { dx: -10, dy:   0, anchor: "end" },
  /* Arunachal sits at the eastern edge, so its labels are shortened and hung to
     the left of the dot rather than running off the canvas. The header already
     says Arunachal Pradesh is complete, so repeating it three times adds nothing. */
  "Tawang (Arunachal)":        { dx:  -9, dy: -13, anchor: "end", short: "Tawang" },
  "Itanagar (Arunachal)":      { dx:  -9, dy:   4, anchor: "end", short: "Itanagar" },
  "Walong (east Arunachal)":   { dx:   9, dy:  16, short: "Walong" },
  "Kathmandu (Nepal)":         { dx:   0, dy:  17, anchor: "middle" },
  "Lhasa (Tibet)":             { dx:   9, dy:  -1 },
};
const pathOf = f => {
  const rings = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
  return rings.map(p => p.map(r =>
    r.map(([lon, lat], i) => (i ? "L" : "M") + px(lon, lat).map(n => n.toFixed(1)).join(",")).join("") + "Z"
  ).join("")).join("");
};

const HILITE = new Set(["JK", "LA", "AR"]);
const svg = [];
svg.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="system-ui,sans-serif">`);
svg.push(`<rect width="${W}" height="${H}" fill="#f7f7f5"/>`);
for (const f of feats) {
  const hi = HILITE.has(f.properties.code);
  svg.push(`<path d="${pathOf(f)}" fill="${hi ? "#cfe0ea" : "#e4e4e0"}" stroke="#8a8a84" stroke-width="0.6" stroke-linejoin="round"/>`);
}
for (const g of gate) {
  const good = g.got === g.want;
  const [x, y] = px(g.lon, g.lat);
  const col = good ? (g.want ? "#1a6b3c" : "#2b4c7e") : "#b3261e";
  const n = LABEL_NUDGE[g.label] ?? {};
  const dx = n.dx ?? 9, dy = n.dy ?? 0;
  const anchor = n.anchor ?? "start";
  const lx = x + dx, ly = y + dy + 3.5;
  /* A hairline from the dot to its label, so a nudged label is never ambiguous. */
  if (Math.abs(dy) > 6) {
    svg.push(`<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${(lx - Math.sign(dx) * 2).toFixed(1)}" y2="${(ly - 3.5).toFixed(1)}" stroke="#9a9a93" stroke-width="0.7"/>`);
  }
  const text = (n.short ?? g.label).replace(/&/g, "&amp;");
  svg.push(`<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" font-size="11" text-anchor="${anchor}" fill="#33332f" paint-order="stroke" stroke="#f7f7f5" stroke-width="3" stroke-linejoin="round">${text}</text>`);
  svg.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.5" fill="${col}" stroke="#fff" stroke-width="1.3"/>`);
}
const okCount = gate.filter(g => g.got === g.want).length;
svg.push(`<text x="${PAD}" y="26" font-size="15" font-weight="600" fill="#22221f">Boundary compliance check &#8212; final geometry</text>`);
svg.push(`<text x="${PAD}" y="45" font-size="11.5" fill="#55554f"><tspan font-weight="600" fill="#1a6b3c">${okCount}/${PROBES.length} probes as expected.</tspan> <tspan fill="#1a6b3c">&#9679;</tspan> inside India as claimed. <tspan fill="#2b4c7e">&#9679;</tspan> control, correctly outside.</text>`);
svg.push(`<text x="${PAD}" y="62" font-size="11.5" fill="#55554f">PoK, Gilgit-Baltistan, Aksai Chin and Shaksgam are inside; Arunachal Pradesh is complete.</text>`);
svg.push(`<text x="${PAD}" y="79" font-size="11.5" fill="#55554f">data/boundaries.topo.json &#8212; 36 units, ${countPoints(pick.t).toLocaleString()} points, ${(finalBytes / 1024).toFixed(0)} KB uncompressed.</text>`);
svg.push(`</svg>`);
writeFileSync(SVG, svg.join("\n"));

console.log(`\nChosen minArea=${CHOSEN}`);
console.log(`  data/boundaries.topo.json   ${(finalBytes / 1024).toFixed(1)} KB  (${countPoints(pick.t).toLocaleString()} points, ${pick.t.arcs.length} arcs, 36 units)`);
console.log(`  gzip-equivalent estimate    roughly ${(finalBytes / 1024 / 3.2).toFixed(0)} KB over the wire`);
console.log(`  docs/boundary-check.svg     written`);
console.log(`\nGate on the FINAL simplified geometry: ${okCount}/${PROBES.length}`);
for (const g of gate) {
  const good = g.got === g.want;
  console.log(`  ${good ? "PASS" : "FAIL"}  ${g.label.padEnd(28)} expect ${g.want ? "in " : "out"}  got ${g.got ? "in " : "out"}  ${g.hits.join("/")}`);
}
if (okCount !== PROBES.length) process.exit(1);

const codes = doc.objects.states.geometries.map(g => g.properties.code).sort();
console.log(`\n36 unit codes present: ${codes.join(" ")}`);
