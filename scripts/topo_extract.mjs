/* Minimal TopoJSON -> GeoJSON decoder. No dependencies.
   Usage: node topo_extract.mjs <topo.json> <objectName> <out.geojson> */
import { readFileSync, writeFileSync } from "fs";

const [, , inPath, objName, outPath] = process.argv;
const topo = JSON.parse(readFileSync(inPath, "utf8"));
const { scale: [sx, sy], translate: [tx, ty] } = topo.transform;

/* Quantised arcs are stored as delta-encoded integers. */
const arcs = topo.arcs.map(arc => {
  let x = 0, y = 0;
  return arc.map(([dx, dy]) => { x += dx; y += dy; return [x * sx + tx, y * sy + ty]; });
});

const arcPoints = i => (i < 0 ? arcs[~i].slice().reverse() : arcs[i]);
function ring(indices) {
  const out = [];
  for (const i of indices) {
    const pts = arcPoints(i);
    // consecutive arcs share an endpoint; drop the duplicate
    out.push(...(out.length ? pts.slice(1) : pts));
  }
  return out;
}
const poly = rings => rings.map(ring);
function toGeom(g) {
  if (g.type === "Polygon") return { type: "Polygon", coordinates: poly(g.arcs) };
  if (g.type === "MultiPolygon") return { type: "MultiPolygon", coordinates: g.arcs.map(poly) };
  return null;
}

const obj = topo.objects[objName];
const features = obj.geometries.map(g => ({
  type: "Feature", properties: g.properties || {}, geometry: toGeom(g)
})).filter(f => f.geometry);

writeFileSync(outPath, JSON.stringify({ type: "FeatureCollection", features }));
console.log(`Wrote ${features.length} features to ${outPath}`);
console.log(`Property keys: ${Object.keys(features[0].properties).join(", ")}`);
console.log(`\nst_code  st_nm`);
for (const f of features.sort((a, b) => (a.properties.st_code || "").localeCompare(b.properties.st_code || ""))) {
  console.log(`  ${String(f.properties.st_code).padStart(3)}    ${f.properties.st_nm}`);
}
