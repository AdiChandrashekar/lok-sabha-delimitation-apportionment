/* Geometry inspector for the section 2.1 boundary gate.
   Usage: node inspect_boundary.mjs <path-to-geojson> [namePropHint] */
import { readFileSync } from "fs";

const path = process.argv[2];
const gj = JSON.parse(readFileSync(path, "utf8"));
const feats = gj.type === "FeatureCollection" ? gj.features : [gj];

/* Landmarks that decide the gate. "in" = must be inside India as claimed. */
const PROBES = [
  ["Gilgit (Gilgit-Baltistan)",        35.9200, 74.3100, "in"],
  ["Skardu (Gilgit-Baltistan)",        35.3000, 75.6300, "in"],
  ["Muzaffarabad (PoK)",               34.3700, 73.4700, "in"],
  ["Mirpur (PoK)",                     33.1500, 73.7500, "in"],
  ["Aksai Chin interior",              35.2000, 79.5000, "in"],
  ["Aksai Chin east",                  35.1000, 79.9000, "in"],
  ["Shaksgam Valley",                  36.0000, 76.5000, "in"],
  ["Srinagar (Indian-administered)",   34.0800, 74.8000, "in"],
  ["Leh (Ladakh)",                     34.1500, 77.5800, "in"],
  ["Tawang (Arunachal)",               27.5900, 91.8700, "in"],
  ["Itanagar (Arunachal)",             27.0800, 93.6000, "in"],
  ["Walong (east Arunachal)",          28.1300, 97.0000, "in"],
  ["Kathmandu (Nepal)",                27.7000, 85.3000, "out"],
  ["Lhasa (Tibet)",                    29.6500, 91.1000, "out"],
  ["Lahore (Pakistan)",                31.5500, 74.3400, "out"],
];

function ringContains(ring, lon, lat) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function polyContains(poly, lon, lat) {
  if (!ringContains(poly[0], lon, lat)) return false;
  for (let k = 1; k < poly.length; k++) if (ringContains(poly[k], lon, lat)) return false;
  return true;
}
function geomContains(geom, lon, lat) {
  if (!geom) return false;
  if (geom.type === "Polygon") return polyContains(geom.coordinates, lon, lat);
  if (geom.type === "MultiPolygon") return geom.coordinates.some(p => polyContains(p, lon, lat));
  return false;
}
function bbox(geom, acc = [Infinity, Infinity, -Infinity, -Infinity]) {
  const walk = c => {
    if (typeof c[0] === "number") {
      acc[0] = Math.min(acc[0], c[0]); acc[1] = Math.min(acc[1], c[1]);
      acc[2] = Math.max(acc[2], c[0]); acc[3] = Math.max(acc[3], c[1]);
    } else c.forEach(walk);
  };
  if (geom) walk(geom.coordinates);
  return acc;
}
function countCoords(geom) {
  let n = 0;
  const walk = c => { if (typeof c[0] === "number") n++; else c.forEach(walk); };
  if (geom) walk(geom.coordinates);
  return n;
}

const nameKey = k => {
  const cand = ["STATE", "ST_NM", "NAME_1", "name", "State_Name", "stname", "NAME", "st_nm"];
  for (const c of cand) if (k && c in k) return k[c];
  return JSON.stringify(k).slice(0, 60);
};

console.log(`File: ${path}`);
console.log(`Features: ${feats.length}`);
console.log(`Property keys on first feature: ${Object.keys(feats[0].properties || {}).join(", ")}`);

let total = [Infinity, Infinity, -Infinity, -Infinity], totalPts = 0;
const rows = [];
for (const f of feats) {
  const b = bbox(f.geometry);
  total = [Math.min(total[0], b[0]), Math.min(total[1], b[1]), Math.max(total[2], b[2]), Math.max(total[3], b[3])];
  const n = countCoords(f.geometry);
  totalPts += n;
  rows.push({ name: nameKey(f.properties), b, n });
}
console.log(`\nNational bbox  lon ${total[0].toFixed(3)} .. ${total[2].toFixed(3)}   lat ${total[1].toFixed(3)} .. ${total[3].toFixed(3)}`);
console.log(`Total coordinate points: ${totalPts.toLocaleString()}`);

console.log(`\n--- Decisive bbox signatures ---`);
console.log(`  max latitude ${total[3].toFixed(3)}   (>=36.5 implies Gilgit-Baltistan present; ~35.5 implies absent)`);
console.log(`  min longitude ${total[0].toFixed(3)}  (~68.1 Gujarat; PoK pushes west boundary to ~73.9 at lat 33)`);
console.log(`  max longitude ${total[2].toFixed(3)}  (~97.4 implies Arunachal complete)`);

console.log(`\n--- Point-in-polygon probes ---`);
let pass = 0, failList = [];
for (const [label, lat, lon, expect] of PROBES) {
  const hits = feats.filter(f => geomContains(f.geometry, lon, lat)).map(f => nameKey(f.properties));
  const inside = hits.length > 0;
  const wanted = expect === "in";
  const good = inside === wanted;
  if (good) pass++; else failList.push(label);
  console.log(`  ${good ? "PASS" : "FAIL"}  ${label.padEnd(32)} expected ${expect.padEnd(3)} got ${inside ? "in " : "out"}  ${hits.join("/")}`);
}
console.log(`\n${pass}/${PROBES.length} probes as expected.` + (failList.length ? `  Failed: ${failList.join("; ")}` : ""));

console.log(`\n--- Per-feature bbox (states of interest) ---`);
for (const r of rows) {
  if (/jammu|kashmir|ladakh|arunachal|J&K/i.test(r.name)) {
    console.log(`  ${String(r.name).padEnd(34)} lon ${r.b[0].toFixed(2)}..${r.b[2].toFixed(2)}  lat ${r.b[1].toFixed(2)}..${r.b[3].toFixed(2)}  pts ${r.n}`);
  }
}
console.log(`\n--- All feature names ---`);
console.log(rows.map(r => r.name).sort().join(" | "));
