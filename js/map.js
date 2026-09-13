/* ---------------------------------------------------------------------------
   Choropleth. Diverging orange-to-blue, which stays legible under every common
   form of colour blindness and, unlike red-to-green or red-to-blue, does not
   editorialise about which direction is the bad one.

   Orange always means "worse for the people who live there" — a seat lost, or
   a vote that carries less weight than average — so the two readings do not
   fight each other when you switch modes.

   Interaction has to work on touch, not just hover, so a tap selects and pins
   the readout. Selecting lifts the state out of the map: it grows toward the
   centre while the rest of India recedes, faded and slightly out of focus.
   Tapping it again, tapping the sea, or pressing Escape puts it back. Every
   state is also focusable, so the map is fully operable from the keyboard
   rather than being a mouse-only island in a page that claims to be accessible.
--------------------------------------------------------------------------- */
import { fmt } from "./data.js";

const LOSS = ["#f6d5ac", "#e39b4f", "#bf6a12", "#8c4a08"];
const GAIN = ["#cfe0ec", "#82aecd", "#3c7ba6", "#17486b"];
const ZERO = "#e9eaea";
const ABSENT = "#cfd3d6";

const W = 720, H = 780;
/* Where a lifted state comes to rest, and how much of the frame it may fill.
   The centre sits a little high to leave room for the name beneath. */
const REST_X = W / 2, REST_Y = 372, FILL = 0.6, MAX_ZOOM = 18, MIN_ZOOM = 1.25;

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
  wchange: {
    label: "Vote Weight Change Against Current",
    /* The ratio of a vote's weight under these rules to its weight today, on
       the same doubling scale as the weight view, so a vote that goes from
       half an average vote to parity reads as strongly as one going the other
       way. Orange means the vote there loses weight. */
    value: r => (r.voteWeight > 0 && r.voteWeightNow > 0 ? Math.log2(r.voteWeight / r.voteWeightNow) : null),
    /* Scaled to the largest movement, but capped at one doubling so a
       two-seat union territory dropping to one cannot wash out every state. */
    domain: vs => Math.min(1, Math.max(0.1, ...vs.map(Math.abs))),
    format: v => (v >= 0 ? "×" : "÷") + Math.pow(2, Math.abs(v)).toFixed(2),
    note: "How much a vote there gains or loses in weight under these rules, against what it is worth today. Blue means the vote counts for more than it does now; orange means it counts for less. The house as it stands shows no change anywhere.",
    legendEnds: null,
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
    label: "Seat Change Against Current",
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
    .attr("viewBox", `0 0 ${W} ${H}`)
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

  const projection = d3.geoMercator().fitExtent([[8, 8], [W - 8, H - 8]], geo);
  const path = d3.geoPath(projection);
  const outlines = new Map(geo.features.map(f => [f.id, path(f)]));
  const bounds = new Map(geo.features.map(f => [f.id, path.bounds(f)]));
  const names = new Map();

  /* Tapping the sea puts a lifted state back. */
  svg.append("rect").attr("class", "sea")
    .attr("width", W).attr("height", H)
    .on("click", () => setSelected(null));

  /* The stage is everything that recedes when a state is lifted: the units and
     the hover outline, which has to recede with them to stay aligned. */
  const stage = svg.append("g").attr("class", "stage");
  const paths = stage.append("g").attr("class", "units")
    .selectAll("path")
    .data(geo.features, d => d.id)
    .join("path")
    .attr("class", "unit")
    .attr("d", path)
    .attr("tabindex", 0)
    .attr("role", "button");

  /* The hover outline is a copy of the shape in a layer ABOVE every unit.
     Stroking the unit itself does not work: a stroke is centred on the edge, and
     any neighbour painted later covers the inner half of it, so shared borders
     came out at half the width of coastlines and the international border.
     The layer takes no pointer events, so it never steals the hover. */
  const hoverLine = stage.append("g").attr("class", "hl-layer").attr("aria-hidden", "true")
    .append("path").attr("class", "hl hl-hover");
  const lifts = svg.append("g").attr("class", "lift-layer").attr("aria-hidden", "true");

  const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Scale and resting place for a state: fill a fixed share of the frame, but
     never blow a sliver like Lakshadweep up past MAX_ZOOM or leave a large state
     so close to its own size that nothing seems to happen. */
  function liftFor(code) {
    const [[x0, y0], [x1, y1]] = bounds.get(code);
    const w = Math.max(x1 - x0, 1), h = Math.max(y1 - y0, 1);
    const k = Math.max(MIN_ZOOM, Math.min(FILL * W / w, FILL * H / h, MAX_ZOOM));
    return { k, h, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
  }

  /* p runs from 0 (in place) to 1 (lifted). The centre travels in a straight
     line while the scale grows, rather than swinging round a fixed origin. */
  function transformAt(L, p) {
    const k = 1 + (L.k - 1) * p;
    const x = L.cx + (REST_X - L.cx) * p, y = L.cy + (REST_Y - L.cy) * p;
    return `translate(${x - k * L.cx},${y - k * L.cy}) scale(${k})`;
  }

  function makeLift(code) {
    const src = paths.filter(d => d.id === code);
    const L = liftFor(code);
    const g = lifts.append("g").attr("class", "lift").datum({ code, L, p: 0 });
    g.append("path").attr("class", "lifted")
      .classed("is-absent", src.classed("is-absent"))
      .attr("d", outlines.get(code))
      .attr("fill", src.attr("fill"))
      .attr("transform", transformAt(L, 0))
      .on("click", () => setSelected(null));
    const half = L.k * L.h / 2;
    g.append("text").attr("class", "lift-name")
      .attr("x", REST_X)
      .attr("y", REST_Y + half + 40 <= H - 10 ? REST_Y + half + 40 : REST_Y - half - 18)
      .attr("text-anchor", "middle")
      .style("opacity", 0)
      .text(names.get(code) ?? code);
    return g;
  }

  function animate(g, to) {
    const d = g.datum(), from = d.p;
    const dur = reduceMotion() ? 0 : Math.round(620 * Math.abs(to - from));
    g.classed("is-lifted", to === 1);
    g.select("path.lifted").interrupt()
      .transition().duration(dur)
      .ease(to > from ? d3.easeCubicOut : d3.easeCubicInOut)
      .attrTween("transform", () => t => transformAt(d.L, (d.p = from + (to - from) * t)))
      .on("end", () => { if (to === 0) g.remove(); });
    g.select("text").interrupt()
      .transition().delay(to ? dur * 0.45 : 0).duration(to ? dur * 0.55 : dur * 0.3)
      .style("opacity", to);
  }

  let selected = null;
  function setSelected(code) {
    const prev = selected;
    selected = code;
    paths.classed("is-selected", d => d.id === code);
    svg.classed("has-selection", !!code);
    if (prev !== code) {
      if (prev) lifts.selectAll(".lift").filter(d => d.code === prev)
        .each(function () { animate(d3.select(this), 0); });
      if (code) {
        /* Re-selecting a state that is still settling back takes it over from
           where it is, rather than snapping it home and starting again. */
        let g = lifts.selectAll(".lift").filter(d => d.code === code);
        if (g.empty()) g = makeLift(code);
        animate(g.raise(), 1);
      }
    }
    onSelect(code);
  }

  const setHover = (code, focus = false) => {
    hoverLine.attr("d", code ? outlines.get(code) : null).classed("is-focus", focus);
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
  svg.on("keydown", e => {
    if (e.key === "Escape" && selected) setSelected(null);
  });

  return {
    selected: () => selected,
    clearSelection: () => setSelected(null),
    update(rows, mode) {
      const M = MODES[mode] ?? MODES.weight;
      const byCode = new Map(rows.map(r => [r.code, r]));
      for (const r of rows) names.set(r.code, r.name);
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

      /* A lifted state is a copy, so it has to follow the recolour. */
      lifts.selectAll(".lift").each(function (d) {
        const src = paths.filter(p => p.id === d.code);
        const g = d3.select(this);
        g.select("path.lifted").attr("fill", src.attr("fill")).classed("is-absent", src.classed("is-absent"));
        g.select("text").text(names.get(d.code) ?? d.code);
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
