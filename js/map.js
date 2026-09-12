/* ---------------------------------------------------------------------------
   Choropleth. Diverging orange-to-blue, which stays legible under every common
   form of colour blindness and, unlike red-to-green or red-to-blue, does not
   editorialise about which direction is the bad one.

   Interaction has to work on touch, not just hover, so a tap selects and pins
   the readout. Every state is also focusable, so the map is fully operable from
   the keyboard rather than being a mouse-only island in a page that claims to
   be accessible.
--------------------------------------------------------------------------- */
import { fmt } from "./data.js";

const LOSS = ["#f6d5ac", "#e39b4f", "#bf6a12", "#8c4a08"];
const GAIN = ["#cfe0ec", "#82aecd", "#3c7ba6", "#17486b"];
const ZERO = "#e9eaea";
const ABSENT = "#cfd3d6";

/* Symmetric bands so a gain of n and a loss of n read as equally strong. */
function scaleFor(values) {
  const max = Math.max(1, ...values.filter(v => v != null).map(v => Math.abs(v)));
  const cuts = [0.08, 0.28, 0.6].map(f => f * max);
  return v => {
    if (v == null) return ABSENT;
    if (v === 0) return ZERO;
    const a = Math.abs(v), ramp = v > 0 ? GAIN : LOSS;
    if (a <= cuts[0]) return ramp[0];
    if (a <= cuts[1]) return ramp[1];
    if (a <= cuts[2]) return ramp[2];
    return ramp[3];
  };
}

export function createMap(container, geo, { onHover, onSelect }) {
  const svg = d3.select(container).append("svg")
    .attr("viewBox", "0 0 720 780")
    .attr("preserveAspectRatio", "xMidYMid meet")
    .attr("role", "img");

  /* Hatch for units with no population in the selected year. A distinct
     texture rather than just a grey, so the absence survives printing and
     colour-blind viewing alike. */
  const defs = svg.append("defs");
  const hatch = defs.append("pattern")
    .attr("id", "hatch").attr("width", 6).attr("height", 6)
    .attr("patternUnits", "userSpaceOnUse").attr("patternTransform", "rotate(45)");
  hatch.append("rect").attr("width", 6).attr("height", 6).attr("fill", "#e3e6e8");
  hatch.append("line").attr("x1", 0).attr("y1", 0).attr("x2", 0).attr("y2", 6)
    .attr("stroke", "#9aa3aa").attr("stroke-width", 2.4);

  const projection = d3.geoMercator().fitExtent([[8, 8], [712, 772]], geo);
  const path = d3.geoPath(projection);

  const g = svg.append("g");
  const paths = g.selectAll("path")
    .data(geo.features, d => d.id)
    .join("path")
    .attr("class", "unit")
    .attr("d", path)
    .attr("tabindex", 0)
    .attr("role", "button");

  let selected = null;

  const setSelected = code => {
    selected = code;
    paths.classed("is-selected", d => d.id === code);
    onSelect(code);
  };

  paths
    .on("pointerenter", (e, d) => onHover(d.id))
    .on("pointerleave", () => onHover(null))
    .on("focus", (e, d) => onHover(d.id))
    .on("blur", () => onHover(null))
    .on("click", (e, d) => setSelected(selected === d.id ? null : d.id))
    .on("keydown", (e, d) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setSelected(selected === d.id ? null : d.id);
      }
    });

  return {
    selected: () => selected,
    clearSelection: () => setSelected(null),
    update(rows, mode) {
      const byCode = new Map(rows.map(r => [r.code, r]));
      const values = rows.map(r => (mode === "prop" ? r.pctChange : r.change));
      const colour = scaleFor(values);

      paths
        .classed("is-absent", d => byCode.get(d.id)?.absent)
        .attr("fill", d => {
          const r = byCode.get(d.id);
          if (!r || r.absent) return ABSENT;
          return colour(mode === "prop" ? r.pctChange : r.change);
        })
        .attr("aria-label", d => {
          const r = byCode.get(d.id);
          if (!r) return d.id;
          if (r.absent) return `${r.name}: not enumerated in this census, absent from this allocation.`;
          return `${r.name}: ${r.current} seats now, ${r.seats} under these rules, ` +
                 `${r.change === 0 ? "no change" : fmt.d(r.change) + " seats"}. ` +
                 `One MP per ${fmt.people(r.perMp)} people. Vote weight ${fmt.w(r.voteWeight)}.`;
        });

      return { colour, max: Math.max(1, ...values.filter(v => v != null).map(Math.abs)) };
    },
  };
}

export function renderLegend(el, mode, max) {
  const label = v => (mode === "prop" ? Math.round(v * 100) + "%" : Math.round(v));
  const sw = [...LOSS].reverse().concat([ZERO], GAIN);
  const unit = mode === "prop" ? "of its current seats" : "seats";
  el.innerHTML = `
    <div class="swatches">${sw.map(c => `<span class="sw" style="background:${c}"></span>`).join("")}</div>
    <div class="ends">
      <span>&minus;${label(max)} ${unit}</span>
      <span>no change</span>
      <span>+${label(max)} ${unit}</span>
    </div>
    <div style="margin-top:6px">Hatched: not enumerated in this census, so absent from the allocation.</div>`;
}
