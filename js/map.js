/* ---------------------------------------------------------------------------
   Choropleth. Diverging orange-to-blue, which stays legible under every common
   form of colour blindness and, unlike red-to-green or red-to-blue, does not
   editorialise about which direction is the bad one.

   Orange always means "worse for the people who live there" — a seat lost, or
   a vote that carries less weight than average — so the two readings do not
   fight each other when you switch modes.

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

export const MODES = {
  weight: {
    label: "What a Vote Is Worth",
    /* Vote weight is a RATIO, so it has to be measured on a log scale: 2.00 and
       0.50 are equally far from parity and a linear scale would hide the whole
       under-represented half against Lakshadweep's 34. Neutral is parity. */
    value: r => (r.voteWeight > 0 ? Math.log2(r.voteWeight) : null),
    /* Fixed domain of one doubling either way. The extremes are the tiny union
       territories, whose weight is an artefact of the one-seat minimum rather
       than a finding, and letting them set the scale would flatten every state
       that matters into the middle band. */
    domain: () => 1,
    format: v => (v >= 0 ? "×" : "÷") + Math.pow(2, Math.abs(v)).toFixed(2),
    note: "A vote's weight against the national average. Orange means a vote there counts for less than average; blue means it counts for more. Measured on a doubling scale, so ×2 and ÷2 sit equally far from the middle.",
    legendEnds: ["half an average vote", "parity", "twice an average vote"],
  },
  abs: {
    label: "Seats Gained or Lost",
    value: r => r.change,
    domain: vs => Math.max(1, ...vs.map(Math.abs)),
    format: v => (v > 0 ? "+" : "") + Math.round(v) + " seats",
    note: "Absolute change. Big states dominate because the numbers are bigger. Switch to proportional change to see what happens to small states.",
    legendEnds: null,
  },
  prop: {
    label: "Change Against Current",
    value: r => r.pctChange,
    domain: vs => Math.max(0.02, ...vs.map(Math.abs)),
    format: v => (v > 0 ? "+" : "") + Math.round(v * 100) + "%",
    note: "Change as a share of what the state holds today. A small state losing one of two seats is a 50% cut, which the absolute view hides entirely.",
    legendEnds: null,
  },
};

/* Symmetric bands, so a move of n in either direction reads as equally strong. */
function scaleFor(max) {
  const cuts = [0.08, 0.28, 0.6].map(f => f * max);
  return v => {
    if (v == null) return ABSENT;
    if (Math.abs(v) < 1e-9) return ZERO;
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

  /* Hatch for units with no population in the selected year. A texture rather
     than just a grey, so the absence survives printing and colour-blind
     viewing alike. */
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

  /* Highlights are drawn as copies of the outline in a layer ABOVE every unit.
     Stroking the unit itself does not work: a stroke is centred on the edge, and
     any neighbour painted later covers the inner half of it, so shared borders
     came out at half the width of coastlines and the international border.
     The layer takes no pointer events, so it never steals the hover. */
  const hl = svg.append("g").attr("class", "hl-layer").attr("aria-hidden", "true");
  const selectLine = hl.append("path").attr("class", "hl hl-select");
  const hoverLine = hl.append("path").attr("class", "hl hl-hover");
  const byId = new Map(geo.features.map(f => [f.id, path(f)]));
  const outline = (line, code) => line.attr("d", code ? byId.get(code) : null);

  let selected = null;
  const setSelected = code => {
    selected = code;
    paths.classed("is-selected", d => d.id === code);
    outline(selectLine, code);
    onSelect(code);
  };
  const setHover = (code, focus = false) => {
    outline(hoverLine, code);
    hoverLine.classed("is-focus", focus);
    onHover(code);
  };

  paths
    .on("pointerenter", (e, d) => setHover(d.id))
    .on("pointerleave", () => setHover(null))
    .on("focus", (e, d) => setHover(d.id, e.target.matches(":focus-visible")))
    .on("blur", () => setHover(null))
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
      const M = MODES[mode] ?? MODES.weight;
      const byCode = new Map(rows.map(r => [r.code, r]));
      const values = rows.filter(r => !r.absent).map(M.value).filter(v => v != null);
      const max = M.domain(values);
      const colour = scaleFor(max);

      paths
        .classed("is-absent", d => byCode.get(d.id)?.absent)
        .attr("fill", d => {
          const r = byCode.get(d.id);
          if (!r || r.absent) return ABSENT;
          return colour(M.value(r));
        })
        .attr("aria-label", d => {
          const r = byCode.get(d.id);
          if (!r) return d.id;
          if (r.absent) return `${r.name}: not enumerated in this census, absent from this allocation.`;
          return `${r.name}: ${r.current} seats now, ${r.seats} under these rules, ` +
                 `${r.change === 0 ? "no change" : fmt.d(r.change) + " seats"}. ` +
                 `One MP per ${fmt.people(r.perMp)} people. Vote weight ${fmt.w(r.voteWeight)}.`;
        });

      return { max, mode };
    },
  };
}

export function renderLegend(el, mode, max) {
  const M = MODES[mode] ?? MODES.weight;
  const sw = [...LOSS].reverse().concat([ZERO], GAIN);
  const ends = M.legendEnds ?? [M.format(-max), "no change", M.format(max)];
  el.innerHTML = `
    <div class="swatches">${sw.map(c => `<span class="sw" style="background:${c}"></span>`).join("")}</div>
    <div class="ends">
      <span>${ends[0]}</span><span>${ends[1]}</span><span>${ends[2]}</span>
    </div>
    <div class="legend-foot">Hatched: not enumerated in this census, so absent from the allocation.</div>`;
}
