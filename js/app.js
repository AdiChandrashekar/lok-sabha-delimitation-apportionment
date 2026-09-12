/* ---------------------------------------------------------------------------
   State, URL synchronisation and wiring.

   The whole control state lives in the query string, so a scenario can be sent
   to someone in an argument. That is what the tool is for.
--------------------------------------------------------------------------- */
import { allocate, METHODS, quotaViolations } from "./apportion.js";
import { loadAll, buildRows, groupTotals, fmt,
         YEAR_LABELS, YEAR_NOTES, GROUP_LABELS, ZONE_LABELS, BLOC_COLOURS } from "./data.js";
import { createMap, renderLegend, MODES } from "./map.js";
import { renderBlocks } from "./blocks.js";
import { renderShares, renderMembership, renderVoteWeight, renderTable, toCSV } from "./panels.js";
import { layout, buildBlocs, render as drawChamber } from "./hemicycle.js";

const $ = id => document.getElementById(id);

const DEFAULTS = {
  house: 543, method: "hare", year: "2011", base: 2,
  protectAll: false, protectSmall: false, threshold: 6000000,
  maxChange: null,
  /* Vote weight is the default map view. Seat counts are the mechanism, but
     what a vote is worth is the thing the mechanism is for. */
  view: "weight",
  bloc: "group",
};

/* Presets encode arguments, so each carries a caption saying what it shows. */
const PRESETS = [
  { id: "today", label: "The house today", state: { house: 543, method: "hare", year: "2011" },
    caption: "543 seats allocated in proportion to the 2011 Census. This is what the freeze is holding back: the south loses 17 seats, the Hindi-belt gains 23." },
  { id: "freeze", label: "The freeze, as a constraint", state: { house: 543, method: "hare", year: "2011", maxChange: 0 },
    caption: "Cap every state at zero change and you reproduce the current house exactly. The freeze is not a population rule at all — it is a rule about not moving." },
  { id: "bill2026", label: "The 2026 bill", state: { house: 815, method: "hare", year: "2011" },
    caption: "815 seats from the states, the figure in the Constitution (131st Amendment) Bill, 2026, allocated proportionally on 2011 population. The bill was negatived on 17 April 2026." },
  { id: "shah", label: "The uniform +50% offer", state: { house: 815, method: "statusQuo", year: "2011" },
    caption: "Every state's seats scaled up by the same proportion, the arrangement reported to have been offered during the April debate. Nobody's share moves at all — which is exactly why it resolves nothing about representation." },
  { id: "nobody", label: "Nobody loses", state: { house: 815, method: "hare", year: "2011", protectAll: true },
    caption: "Grow the house to 815 and forbid any state from losing a seat. It is feasible — but only because the house grows by half. Try it at 543 and nothing moves at all." },
  { id: "phased", label: "A phased transition", state: { house: 600, method: "hare", year: "2011", maxChange: 2 },
    caption: "Cap every state at two seats of movement. The south ends up with MORE seats than it holds today. The cap, not the house size, is what does the protecting." },
  { id: "y2036", label: "On 2036 projections", state: { house: 543, method: "hare", year: "2036_proj" },
    caption: "The same rule on the official 2036 projection. The southern loss roughly doubles, from 17 seats to 30. Every published projection quotes the 2011 figure." },
];

let D = null, state = { ...DEFAULTS }, mapApi = null, hovered = null, lastRows = [];

/* ------------------------------------------------------------- URL <-> state */
function readURL() {
  const q = new URLSearchParams(location.search);
  const num = (k, d) => { const v = Number(q.get(k)); return Number.isFinite(v) && q.has(k) ? v : d; };
  return {
    house: Math.min(1100, Math.max(400, Math.round(num("h", DEFAULTS.house)))),
    method: METHODS[q.get("m")] ? q.get("m") : DEFAULTS.method,
    year: q.get("y") && YEAR_LABELS[q.get("y")] ? q.get("y") : DEFAULTS.year,
    base: Math.min(10, Math.max(0, Math.round(num("b", DEFAULTS.base)))),
    protectAll: q.get("pa") === "1",
    protectSmall: q.get("ps") === "1",
    threshold: Math.max(0, Math.round(num("st", DEFAULTS.threshold))),
    maxChange: q.has("mc") ? Math.max(0, Math.round(num("mc", 5))) : null,
    view: MODES[q.get("v")] ? q.get("v") : DEFAULTS.view,
    bloc: q.get("bl") === "zonal" ? "zonal" : DEFAULTS.bloc,
  };
}

function writeURL(replace = true) {
  const q = new URLSearchParams();
  if (state.house !== DEFAULTS.house) q.set("h", state.house);
  if (state.method !== DEFAULTS.method) q.set("m", state.method);
  if (state.year !== DEFAULTS.year) q.set("y", state.year);
  if (state.method === "baseProp" && state.base !== DEFAULTS.base) q.set("b", state.base);
  if (state.protectAll) q.set("pa", "1");
  if (state.protectSmall) { q.set("ps", "1"); if (state.threshold !== DEFAULTS.threshold) q.set("st", state.threshold); }
  if (state.maxChange != null) q.set("mc", state.maxChange);
  if (state.view !== DEFAULTS.view) q.set("v", state.view);
  if (state.bloc !== DEFAULTS.bloc) q.set("bl", state.bloc);
  history[replace ? "replaceState" : "pushState"](null, "",
    location.pathname + (q.toString() ? "?" + q : ""));
}

/* ------------------------------------------------------------------ controls */
function syncControls() {
  $("house").value = state.house;
  $("house-range").value = state.house;
  $("method").value = state.method;
  $("year").value = state.year;
  $("base").value = state.base;
  $("protectAll").checked = state.protectAll;
  $("protectSmall").checked = state.protectSmall;
  $("threshold").value = state.threshold;
  $("useMaxChange").checked = state.maxChange != null;
  if (state.maxChange != null) $("maxChange").value = state.maxChange;

  $("base-field").hidden = state.method !== "baseProp";
  $("threshold-row").hidden = !state.protectSmall;
  $("maxchange-row").hidden = state.maxChange == null;

  $("method-note").textContent = METHODS[state.method].note;
  $("year-note").textContent = YEAR_NOTES[state.year] ?? "";

  document.querySelectorAll("[data-view]").forEach(b => {
    const on = b.dataset.view === state.view;
    b.classList.toggle("is-on", on);
    b.setAttribute("aria-pressed", String(on));
  });
  $("view-note").textContent = MODES[state.view].note;

  document.querySelectorAll("[data-bloc]").forEach(b => {
    const on = b.dataset.bloc === state.bloc;
    b.classList.toggle("is-on", on);
    b.setAttribute("aria-pressed", String(on));
  });
  $("chamber-note").textContent = state.bloc === "zonal"
    ? "Coloured by zonal council, which is an official grouping under the States Reorganisation Act 1956 and the North Eastern Council Act 1971. Each dot is one seat."
    : "Coloured by the analytical grouping used elsewhere on this page, which is NOT official. Each dot is one seat, and the blocs sit in contiguous wedges as they would in a chamber.";

  const active = PRESETS.find(p => matchesPreset(p));
  document.querySelectorAll(".preset").forEach(b =>
    b.classList.toggle("is-on", active && b.dataset.id === active.id));
  $("preset-caption").textContent = active ? active.caption : "";
}

function matchesPreset(p) {
  const want = { ...DEFAULTS, ...p.state };
  return ["house", "method", "year", "protectAll", "protectSmall", "maxChange"]
    .every(k => state[k] === want[k]);
}

/* -------------------------------------------------------------------- alerts */
function renderAlerts(result) {
  const el = $("alerts");
  const bits = [];

  if (result.infeasible) {
    const fixes = [];
    if (result.reason === "floors-exceed-house" && result.minimumHouse) {
      fixes.push(`<button type="button" class="btn" data-fix-house="${result.minimumHouse}">
        Set the house to ${result.minimumHouse}</button>`);
    }
    if (result.reason === "ceilings-below-house" && result.maximumHouse) {
      fixes.push(`<button type="button" class="btn" data-fix-house="${result.maximumHouse}">
        Set the house to ${result.maximumHouse}</button>`);
    }
    const why = {
      "floors-exceed-house": `These constraints need at least <b>${result.minimumHouse}</b> seats,
        which is more than the <b>${state.house}</b> you have set. Every unit has to clear its floor.`,
      "ceilings-below-house": `A cap of ${state.maxChange} seats per state means the house cannot exceed
        <b>${result.maximumHouse}</b>. You have asked for <b>${state.house}</b>.
        A phased transition and a large expansion are not simultaneously satisfiable at this cap.`,
      "did-not-converge": `The constraint solver failed to settle. This is a bug in the tool, not a
        property of your request. Please report it.`,
      "no-population": `No unit has a population figure for this series.`,
    }[result.reason] ?? "This combination cannot be satisfied.";
    bits.push(`<div class="alert is-error"><strong>No allocation satisfies these settings</strong>
      ${why} ${fixes.join(" ")}</div>`);
  }

  if (result.absent?.length) {
    const names = result.absent.map(c => D.byCode.get(c).name).join(" and ");
    bits.push(`<div class="alert"><strong>${names} ${result.absent.length > 1 ? "are" : "is"} missing from this series</strong>
      No census was conducted there in ${YEAR_LABELS[state.year].replace(" Census", "")}. Rather than invent a
      figure, the tool leaves ${result.absent.length > 1 ? "them" : "it"} out, so this allocation covers
      ${36 - result.absent.length} units and the shares below are of a house that excludes
      ${result.absent.length > 1 ? "them" : "it"}.</div>`);
  }

  el.innerHTML = bits.join("");
  el.querySelectorAll("[data-fix-house]").forEach(b =>
    b.addEventListener("click", () => { state.house = Number(b.dataset.fixHouse); apply(); }));
}

/* ------------------------------------------------------------------ headline */
function renderHeadline(rows, result) {
  const g = groupTotals(rows);
  const live = rows.filter(r => !r.absent);
  const movers = live.filter(r => r.change !== 0);
  const gained = live.filter(r => r.change > 0).reduce((a, r) => a + r.change, 0);
  const biggestUp = [...live].sort((a, b) => b.change - a.change)[0];
  const biggestDown = [...live].sort((a, b) => a.change - b.change)[0];
  const southDelta = g.south.seats - g.south.current;
  const houseTotal = live.reduce((a, r) => a + r.seats, 0) || 1;

  const stat = (k, v, s, cls = "") =>
    `<div class="stat"><p class="k">${k}</p><p class="v ${cls}">${v}</p><p class="s">${s}</p></div>`;

  $("headline").innerHTML = [
    stat("Units that move", `${movers.length}`, `of ${live.length} allocated${result.absent.length ? `, ${result.absent.length} absent` : ""}`),
    stat("Seats redistributed", `${gained}`, movers.length ? "changing hands" : "nothing moves at all"),
    stat("South", fmt.d(southDelta), `${g.south.seats} seats, ${fmt.share(g.south.seats / houseTotal)} of the house`,
      southDelta > 0 ? "up" : southDelta < 0 ? "down" : ""),
    stat("Biggest gain", `${biggestUp.code} ${fmt.d(biggestUp.change)}`, biggestUp.name, biggestUp.change > 0 ? "up" : ""),
    stat("Biggest loss", `${biggestDown.code} ${fmt.d(biggestDown.change)}`, biggestDown.name, biggestDown.change < 0 ? "down" : ""),
  ].join("");
}

/* ------------------------------------------------------------------ chamber */
function labelFor(id) {
  return GROUP_LABELS[id] ?? ZONE_LABELS[id] ?? id;
}

function renderChamber(rows) {
  const blocs = buildBlocs(rows, state.bloc, BLOC_COLOURS)
    .map(b => ({ ...b, label: labelFor(b.id) }));
  const total = blocs.reduce((a, b) => a + b.seats, 0);

  drawChamber($("chamber"), layout(total), blocs, {
    width: 820,
    label: total === 1 ? "seat" : "seats",
    sublabel: state.house === 543 ? "the house as it stands" : `against ${543} today`,
  });

  /* The legend doubles as the numbers panel: share now, share under these
     rules, and the movement between them. */
  $("chamber-legend").innerHTML = blocs.map(b => {
    const now = b.units.reduce((a, r) => a + r.current, 0);
    const nowShare = now / 543, share = b.seats / total;
    const d = share - nowShare;
    return `<div class="cl-row">
      <span class="cl-dot" style="background:${b.colour}"></span>
      <span class="cl-name">${b.label}</span>
      <span class="cl-seats">${b.seats}</span>
      <span class="cl-share">${fmt.share(share)}</span>
      <span class="cl-delta ${d > 0.0005 ? "up" : d < -0.0005 ? "down" : ""}">${
        Math.abs(d) < 0.0005 ? "—"
        : (d > 0 ? "+" : "−") + Math.abs(d * 100).toFixed(1) + " pts"}</span>
    </div>`;
  }).join("") +
  `<p class="cl-foot">Share of the house under these rules, and the movement in
    percentage points against the ${543}-seat house as it stands today.</p>`;

  /* A second, smaller chamber showing today, so the comparison is visual and
     not only numeric. Only worth drawing when the scenario actually differs. */
  const same = state.house === 543 &&
    rows.every(r => r.absent || r.seats === r.current);
  if (same) { $("chamber-compare").innerHTML = ""; return; }

  const todayBlocs = buildBlocs(
    rows.map(r => ({ ...r, seats: r.current, absent: false })), state.bloc, BLOC_COLOURS
  ).map(b => ({ ...b, label: labelFor(b.id) }));
  const host = $("chamber-compare");
  host.innerHTML = `<div class="cc-head">The house as it stands today, for comparison</div>
                    <div id="chamber-today" class="chamber chamber-small"></div>`;
  drawChamber($("chamber-today"), layout(543), todayBlocs, {
    width: 520, label: "seats today", sublabel: "",
  });
}

/* ------------------------------------------------------------------ readout */
function renderReadout(code) {
  const el = $("readout");
  const r = lastRows.find(x => x.code === code);
  if (!r) { el.innerHTML = `<p class="readout-empty">Hover, tap or tab to a state.</p>`; return; }
  if (r.absent) {
    el.innerHTML = `<h3>${r.name}</h3><p class="sub">${r.type}</p>
      <p class="readout-empty">Not enumerated in this census, so it takes no part in this allocation.</p>`;
    return;
  }
  const cls = r.change > 0 ? "up" : r.change < 0 ? "down" : "";
  el.innerHTML = `
    <h3>${r.name}</h3>
    <p class="sub">${r.type} &middot; ${GROUP_LABELS[r.group]} &middot; ${ZONE_LABELS[r.zone] ?? "—"}</p>
    <dl>
      <dt>Seats now</dt><dd>${r.current}</dd>
      <dt>Under these rules</dt><dd>${r.seats}</dd>
      <dt>Change</dt><dd class="big ${cls}">${r.change === 0 ? "0" : fmt.d(r.change)}</dd>
      <dt>Population</dt><dd>${fmt.n(r.population)}</dd>
      <dt>People per MP</dt><dd>${fmt.n(Math.round(r.perMp))}</dd>
      <dt>Vote weight</dt><dd>${fmt.w(r.voteWeight)}</dd>
    </dl>
    <p class="vw-line">A vote here is worth <b>${fmt.w(r.voteWeight)}</b> of an average vote
      under these rules${
        Math.abs(r.voteWeight - r.voteWeightNow) > 0.005
          ? `, against <b>${fmt.w(r.voteWeightNow)}</b> today.`
          : ", unchanged from today."}</p>`;
}

/* --------------------------------------------------- methodology + sources -- */
function renderStaticProse() {
  $("method-table").innerHTML = `<table class="mtable"><tbody>${
    Object.entries(METHODS).map(([k, m]) =>
      `<tr><th>${m.label}</th><td>${m.note}</td></tr>`).join("")}</tbody></table>`;

  const src = D.unitsDoc;
  $("data-report").innerHTML = `
    <p><b>Units.</b> ${src.unit_count} states and union territories on the present-day map,
      holding ${src.totals.current_seats} seats between them. Andhra Pradesh and Telangana are
      separate, as are Jammu &amp; Kashmir and Ladakh. Dadra &amp; Nagar Haveli and Daman &amp; Diu
      is one unit holding two seats, matching its post-2020 legal status.</p>
    <p><b>Population.</b> 1971 to 2011 from Census Table A-02, in which the Registrar General has
      already adjusted every earlier census to the 2011 jurisdiction. 2016 to 2036 from Table 21 of
      the Technical Group on Population Projections.</p>
    <p><b>Telangana.</b> Two figures circulate for 2011 and both reconcile to the undivided Andhra
      Pradesh total, which is why no arithmetic check can choose between them. 35,193,978 is the sum
      of the ten districts as constituted in 2011. 35,003,674 is Telangana as actually constituted,
      after the 2014 transfer of seven Khammam mandals to Andhra Pradesh for the Polavaram project.
      The gap is exactly 190,304 people, reconstructed from the schedule in Act 19 of 2014 and the
      Census village directory. This tool uses 35,003,674, because the unit holding 17 seats is
      present-day Telangana.</p>
    <p><b>Validation.</b> On the merged units the published table uses, the engine reproduces its
      figures exactly: Uttar Pradesh 89, Bihar 46, Rajasthan 30, Tamil Nadu 32 and Kerala 15 at 543
      under largest remainder, and Uttar Pradesh 133, Tamil Nadu 48 and Kerala 22 at 815 under
      Huntington-Hill. The test suite carries 130 assertions.</p>`;

  const t = D.topoSource ?? {};
  $("carto").textContent =
    `Boundaries: ${t.file ?? "states layer"} from ${t.repository ?? "source"}, retrieved ` +
    `${t.retrieved ?? "2026"}. Depicts Jammu & Kashmir as claimed including Gilgit-Baltistan, ` +
    `Aksai Chin as part of Ladakh, and Arunachal Pradesh complete, verified by point-in-polygon ` +
    `test against fifteen landmarks after simplification. ${t.provenance_caveat ?? ""}`;

  $("source-list").innerHTML = [
    ["Census of India, Table A-02", "Decadal variation in population 1901–2011. Population figures for all previous censuses are adjusted to the 2011 jurisdiction.", "https://censusindia.gov.in/nada/index.php/catalog/43333"],
    ["Registrar General / National Commission on Population", "Population Projections for India and States 2011–2036, Report of the Technical Group, July 2020. Table 21, printed pages 259–260.", "https://nhm.gov.in/New_Updates_2018/Report_Population_Projection_2019.pdf"],
    ["PRS Legislative Research", "Annexure to the analysis of the Delimitation Bill, 2026. Used as a validation fixture, under CC BY 4.0.", "https://prsindia.org/billtrack/the-delimitation-bill-2026"],
    ["Andhra Pradesh Reorganisation (Amendment) Act, 2014", "Act 19 of 2014, section 2. The schedule of mandals and revenue villages transferred to Andhra Pradesh.", "https://prsindia.org/files/bills_acts/acts_parliament/2014/the-andhra-pradesh-reorganisation-(amendment)-act,-2014.pdf"],
    ["District Census Handbook 2011, Khammam", "Village directory, used to reconstruct the 2014 transfer to the person.", "https://censusindia.gov.in/nada/index.php/catalog/142"],
    ["Boundary geometry", t.repository ?? "", t.repository ?? ""],
  ].map(([b, d, href]) => `<p class="src"><b>${b}</b><br>${d}
    ${href ? `<br><a href="${href}" rel="noopener">${href}</a>` : ""}</p>`).join("");

  $("footer-note").textContent =
    "Built as a static site: no build step, no framework, no server. Every figure traces to a " +
    "named source recorded in the data files. Code MIT licensed. The PRS projection table is " +
    "used under CC BY 4.0 with attribution.";

  renderMembership($("group-membership"), D.units);
  drawMastheadArc();
}

/* A quiet arc of seats behind the masthead: the same idea as the chamber, at
   the scale of decoration rather than data. */
function drawMastheadArc() {
  const svg = $("masthead-arc");
  if (!svg) return;
  const { seats, seatRadius } = layout(543, { innerRatio: 0.3 });
  const W = 1200, R = 520, cx = W / 2, cy = 258;
  svg.innerHTML = seats.map((s, i) => {
    const x = cx + s.x * R, y = cy + s.y * R;
    if (y < -10) return "";
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(seatRadius * R * 0.8).toFixed(2)}"/>`;
  }).join("");
}

/* --------------------------------------------------- paradox + quota panels */
function renderParadox() {
  const hits = [];
  let prev = allocate(D.units, 543, "hare", { year: state.year }).seats;
  for (let H = 544; H <= 900; H++) {
    const cur = allocate(D.units, H, "hare", { year: state.year }).seats;
    for (const u of D.units) {
      if (cur[u.code] != null && prev[u.code] != null && cur[u.code] < prev[u.code]) {
        hits.push({ H, code: u.code, from: prev[u.code], to: cur[u.code] });
      }
    }
    prev = cur;
  }
  $("paradox-summary").innerHTML = hits.length
    ? `On the <b>${YEAR_LABELS[state.year]}</b> series, largest remainder produces
       <b>${hits.length}</b> instances between a house of 543 and 900 where a state
       <em>loses</em> a seat as the house grows. Each pill below is one instance:
       the house size, the state, and the fall.`
    : `On the ${YEAR_LABELS[state.year]} series there are no instances between 543 and 900.`;
  $("paradox-list").innerHTML = `<div class="paradox-list">${
    hits.map(h => `<span class="pill">${h.H}: ${h.code} ${h.from}&rarr;${h.to}</span>`).join("")}</div>`;
}

function renderQuota(result) {
  if (result.infeasible) { $("quota-report").innerHTML = ""; return; }
  const v = quotaViolations(D.units, result.seats, state.house, state.year);
  const pinned = new Set(D.units.filter(u =>
    result.floors?.[u.code] > 1 && result.seats[u.code] === result.floors[u.code]).map(u => u.code));
  const list = v.map(x => `${D.byCode.get(x.code).name} has ${x.got} where quota is
    ${x.lower}–${x.upper}${pinned.has(x.code) ? " <em>(pinned by a constraint, not by the rule)</em>" : ""}`);
  $("quota-report").innerHTML = v.length
    ? `<p>Under these settings, <b>${v.length}</b> unit${v.length > 1 ? "s fall" : " falls"} outside quota:
       ${list.join("; ")}.</p>`
    : `<p>Under these settings no unit falls outside its quota.</p>`;
}

/* --------------------------------------------------------------------- main */
function apply(pushHistory = false) {
  const opts = {
    year: state.year, baseSeats: state.base,
    protectAll: state.protectAll, protectSmall: state.protectSmall,
    smallThreshold: state.threshold,
  };
  if (state.maxChange != null) opts.maxChange = state.maxChange;

  const result = allocate(D.units, state.house, state.method, opts);
  syncControls();
  writeURL(!pushHistory);
  renderAlerts(result);

  if (result.infeasible) {
    for (const id of ["headline", "blocks", "shares", "voteweight", "chamber",
                      "chamber-legend", "chamber-compare"]) $(id).innerHTML = "";
    renderQuota(result);
    return;
  }

  const rows = buildRows(D.units, result, state.year);
  lastRows = rows;

  const { max } = mapApi.update(rows, state.view);
  renderLegend($("map-legend"), state.view, max);
  renderHeadline(rows, result);
  renderChamber(rows);
  renderBlocks($("blocks"), rows);
  renderShares($("shares"), rows, state.house);
  renderVoteWeight($("voteweight"), rows, state.year);
  renderTable($("table"), rows);
  renderQuota(result);
  renderParadox();
  renderReadout(mapApi.selected() ?? hovered);
}

function wire() {
  const set = (k, v) => { state[k] = v; apply(); };

  $("house").addEventListener("input", e => {
    const v = Number(e.target.value);
    if (Number.isFinite(v) && v >= 400 && v <= 1100) set("house", Math.round(v));
  });
  $("house-range").addEventListener("input", e => set("house", Number(e.target.value)));
  $("method").addEventListener("change", e => set("method", e.target.value));
  $("year").addEventListener("change", e => set("year", e.target.value));
  $("base").addEventListener("input", e => set("base", Math.max(0, Math.min(10, Number(e.target.value) || 0))));
  $("protectAll").addEventListener("change", e => set("protectAll", e.target.checked));
  $("protectSmall").addEventListener("change", e => set("protectSmall", e.target.checked));
  $("threshold").addEventListener("input", e => set("threshold", Math.max(0, Number(e.target.value) || 0)));
  $("useMaxChange").addEventListener("change", e =>
    set("maxChange", e.target.checked ? Number($("maxChange").value) || 0 : null));
  $("maxChange").addEventListener("input", e => set("maxChange", Math.max(0, Number(e.target.value) || 0)));

  document.querySelectorAll("[data-view]").forEach(b =>
    b.addEventListener("click", () => set("view", b.dataset.view)));
  document.querySelectorAll("[data-bloc]").forEach(b =>
    b.addEventListener("click", () => set("bloc", b.dataset.bloc)));

  $("reset").addEventListener("click", () => { state = { ...DEFAULTS }; apply(true); });

  $("copy-link").addEventListener("click", async () => {
    const url = location.origin + location.pathname + location.search;
    try { await navigator.clipboard.writeText(url); $("copied").textContent = "Link copied."; }
    catch { $("copied").textContent = "Copy from the address bar."; }
    setTimeout(() => { $("copied").textContent = ""; }, 2600);
  });

  $("export-csv").addEventListener("click", () => {
    const meta = {
      methodLabel: METHODS[state.method].label,
      yearLabel: YEAR_LABELS[state.year],
      absent: lastRows.filter(r => r.absent).map(r => r.code),
      url: location.origin + location.pathname + location.search,
    };
    const blob = new Blob([toCSV(lastRows, state, meta)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `lok-sabha-${state.method}-${state.house}-${state.year}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  $("show-groups").addEventListener("click", e => {
    const el = $("group-membership");
    el.hidden = !el.hidden;
    e.target.setAttribute("aria-expanded", String(!el.hidden));
    e.target.textContent = el.hidden ? "Show membership" : "Hide membership";
  });

  addEventListener("popstate", () => { state = readURL(); apply(); });
}

/* ------------------------------------------------------------------- boot */
(async function boot() {
  try {
    D = await loadAll();
  } catch (err) {
    $("alerts").innerHTML = `<div class="alert is-error"><strong>Could not load the data</strong>
      ${err.message}. If you opened this file directly from disk, browsers block
      <code>fetch</code> on <code>file://</code> — serve the folder over HTTP instead,
      for example <code>python -m http.server</code>.</div>`;
    return;
  }

  $("method").innerHTML = Object.entries(METHODS)
    .map(([k, m]) => `<option value="${k}">${m.label}</option>`).join("");
  $("year").innerHTML = D.years
    .map(y => `<option value="${y}">${YEAR_LABELS[y] ?? y}</option>`).join("");
  $("preset-buttons").innerHTML = PRESETS
    .map(p => `<button type="button" class="preset" data-id="${p.id}">${p.label}</button>`).join("");
  document.querySelectorAll(".preset").forEach(b =>
    b.addEventListener("click", () => {
      const p = PRESETS.find(x => x.id === b.dataset.id);
      state = { ...DEFAULTS, ...p.state, view: state.view, bloc: state.bloc };
      apply(true);
    }));

  mapApi = createMap($("map"), D.geo, {
    onHover: code => { hovered = code; renderReadout(mapApi.selected() ?? code); },
    onSelect: () => renderReadout(mapApi.selected() ?? hovered),
  });

  state = readURL();
  renderStaticProse();
  wire();
  apply();
})();
