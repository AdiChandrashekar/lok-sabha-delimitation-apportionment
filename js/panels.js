/* ---------------------------------------------------------------------------
   Share of the house, vote weight, and the full sortable table with CSV export.
   The export matters: it is what turns this from a thing people look at into a
   thing people cite.
--------------------------------------------------------------------------- */
import { fmt, GROUP_LABELS, GROUP_ORDER, BLOC_COLOURS, groupTotals } from "./data.js";

/* ------------------------------------------------------------- share panel */
export function renderShares(el, rows, houseSize) {
  const g = groupTotals(rows);
  const live = rows.filter(r => !r.absent).reduce((a, r) => a + r.seats, 0) || houseSize;

  el.innerHTML = GROUP_ORDER.map(key => {
    const now = g[key].current / 543;
    const next = g[key].seats / live;
    const delta = next - now;
    return `<div class="share-row">
      <div class="share-top">
        <span class="nm">${GROUP_LABELS[key]}</span>
        <span class="vl">${fmt.share(next)} of the house
          <span style="color:${delta > 0 ? "var(--gain-4)" : delta < 0 ? "var(--loss-4)" : "var(--faint)"}">
            (${delta === 0 ? "no change"
               : (delta > 0 ? "+" : "−") + Math.abs(delta * 100).toFixed(1) + " points"})</span>
        </span>
      </div>
      <div class="share-bar" role="img"
           aria-label="${GROUP_LABELS[key]}: ${fmt.share(next)} of the house under these rules, against ${fmt.share(now)} today.">
        <div class="share-fill" style="width:${(next * 100).toFixed(2)}%"></div>
        <div class="share-now" style="left:${(now * 100).toFixed(2)}%"
             title="Share today: ${fmt.share(now)}"></div>
      </div>
      <div class="share-legend">${g[key].seats} seats, against ${g[key].current} today.</div>
    </div>`;
  }).join("");
}

export function renderMembership(el, units) {
  el.innerHTML = GROUP_ORDER.map(key => {
    const names = units.filter(u => u.analytical_group === key).map(u => u.name).sort();
    return `<p><span class="cl-dot" style="background:${BLOC_COLOURS[key]}"></span>
      <b>${GROUP_LABELS[key]}:</b> ${names.join(", ")}.</p>`;
  }).join("") +
  `<p class="fine">These are analytical groupings chosen for this tool. They are not
   official and carry no legal status. The official grouping in <code>units.json</code>
   is zonal council membership, which cuts differently.</p>`;
}

/* -------------------------------------------------------- vote weight panel */
export function renderVoteWeight(el, rows, year) {
  const live = rows.filter(r => !r.absent && r.seats > 0);
  if (!live.length) { el.innerHTML = ""; return; }

  const sorted = [...live].sort((a, b) => a.voteWeight - b.voteWeight);
  const worst = sorted.slice(0, 5);
  const best = sorted.slice(-5).reverse();

  /* Bars are scaled within their own table. Scaling all of them against
     Lakshadweep, whose weight is about 35, would flatten every other bar to a
     sliver and make the panel useless. */
  const bar = (w, scaleMax) => {
    const px = Math.max(3, (w / scaleMax) * 62);
    const col = w < 1 ? "var(--loss-3)" : "var(--gain-3)";
    return `<span class="vw-bar" style="width:${px.toFixed(1)}px;background:${col}"></span>`;
  };
  const table = (caption, list) => {
    const scaleMax = Math.max(...list.map(r => r.voteWeight));
    return `
    <p class="vw-head">${caption}</p>
    <table class="vw-table">
      <thead><tr><th>Unit</th><th>People per MP</th><th>Vote weight</th></tr></thead>
      <tbody>${list.map(r => `<tr>
        <td>${r.name}</td>
        <td>${fmt.people(r.perMp)}</td>
        <td>${bar(r.voteWeight, scaleMax)}${fmt.w(r.voteWeight)}</td>
      </tr>`).join("")}</tbody>
    </table>`;
  };

  /* The sharpest sentence this data says, computed rather than asserted.
     It has to be anchored on TODAY's allocation: the whole point is that a
     proportional rule very nearly equalises vote weight, so quoting only the
     post-reallocation ratio would read as "1.06" and say nothing. The gap the
     freeze has opened is the story; what the rule does to it is the answer. */
  const big = live.filter(r => r.current >= 10);
  let punch = "";
  if (big.length > 1) {
    const byNow = [...big].sort((a, b) => a.voteWeightNow - b.voteWeightNow);
    const lo = byNow[0], hi = byNow[byNow.length - 1];
    const nowRatio = hi.voteWeightNow / lo.voteWeightNow;
    const thenRatio = hi.voteWeight / lo.voteWeight;
    punch = `<p class="vw-punch">Among the larger states today, a vote in
      <b>${hi.name}</b> is worth <b>${nowRatio.toFixed(2)}</b> of a vote in
      <b>${lo.name}</b>. Under these rules that gap ${
        Math.abs(thenRatio - 1) < 0.02 ? "closes almost entirely, to"
        : thenRatio < nowRatio ? "narrows to" : "widens to"}
      <b>${thenRatio.toFixed(2)}</b>.</p>`;
  }

  el.innerHTML =
    table("Most under-represented — a vote here is worth least", worst) +
    table("Most over-represented — a vote here is worth most", best) +
    punch +
    `<p class="fine" style="margin-top:10px">The smallest units are excluded from that
      sentence because a one-seat minimum guarantees them a high weight whatever
      the rule: Lakshadweep's 64,473 people elect one MP either way.</p>`;
}

/* --------------------------------------------------------------- the table */
const COLUMNS = [
  { key: "name",        label: "Unit",             kind: "text" },
  { key: "population",  label: "Population",       kind: "num",  f: r => fmt.n(r.population) },
  { key: "current",     label: "Seats now",        kind: "num",  f: r => r.current },
  { key: "seats",       label: "New seats",        kind: "num",  f: r => (r.absent ? "—" : r.seats) },
  { key: "change",      label: "Change",           kind: "num",  f: r => fmt.d(r.change), colour: true },
  { key: "pctChange",   label: "Change %",         kind: "num",  f: r => fmt.pct(r.pctChange), colour: true },
  { key: "perMp",       label: "People per MP",    kind: "num",  f: r => fmt.n(r.perMp && Math.round(r.perMp)) },
  { key: "voteWeight",  label: "Vote weight",      kind: "num",  f: r => fmt.w(r.voteWeight) },
  { key: "share",       label: "Share of house",   kind: "num",  f: r => fmt.share(r.share) },
];

let sortKey = "change", sortDir = "asc";

export function renderTable(el, rows) {
  const thead = el.querySelector("thead"), tbody = el.querySelector("tbody");

  const sorted = [...rows].sort((a, b) => {
    const A = a[sortKey], B = b[sortKey];
    if (A == null && B == null) return 0;
    if (A == null) return 1;               // absent units always sink
    if (B == null) return -1;
    const c = typeof A === "string" ? A.localeCompare(B) : A - B;
    return sortDir === "asc" ? c : -c;
  });

  thead.innerHTML = `<tr>${COLUMNS.map(c => {
    const on = c.key === sortKey;
    const aria = on ? (sortDir === "asc" ? "ascending" : "descending") : "none";
    return `<th scope="col" aria-sort="${aria}" data-key="${c.key}" tabindex="0"
              role="columnheader">${c.label}</th>`;
  }).join("")}</tr>`;

  tbody.innerHTML = sorted.map(r => `<tr>${COLUMNS.map(c => {
    const cls = c.colour && r.change != null
      ? (r.change > 0 ? " class=\"up\"" : r.change < 0 ? " class=\"down\"" : "")
      : "";
    const v = c.kind === "text" ? r[c.key] : c.f(r);
    return c.key === "name"
      ? `<th scope="row">${v}${r.absent ? ' <span class="fine">(not enumerated)</span>' : ""}</th>`
      : `<td${cls}>${v}</td>`;
  }).join("")}</tr>`).join("");

  thead.querySelectorAll("th").forEach(th => {
    const go = () => {
      const k = th.dataset.key;
      if (k === sortKey) sortDir = sortDir === "asc" ? "desc" : "asc";
      else { sortKey = k; sortDir = k === "name" ? "asc" : "desc"; }
      renderTable(el, rows);
      el.querySelector(`th[data-key="${k}"]`)?.focus();
    };
    th.addEventListener("click", go);
    th.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); }
    });
  });
}

export function toCSV(rows, state, meta) {
  const esc = v => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  /* The scenario travels with the numbers. A CSV that does not say which rules
     produced it is not citable. */
  const header = [
    `# Lok Sabha apportionment scenario`,
    `# generated,${new Date().toISOString()}`,
    `# house_size,${state.house}`,
    `# method,${meta.methodLabel}`,
    `# population_series,${meta.yearLabel}`,
    `# no_state_loses,${state.protectAll}`,
    `# small_states_protected,${state.protectSmall}${state.protectSmall ? `,threshold,${state.threshold}` : ""}`,
    `# max_change_per_state,${state.maxChange ?? "none"}`,
    `# absent_units,${meta.absent.join(" ") || "none"}`,
    `# permalink,${meta.url}`,
    `# source,See SOURCES.md. Population from Census of India and the RGI Technical Group projections.`,
  ].join("\n");

  const cols = ["code", "name", "type", "group", "population", "current", "seats",
                "change", "pctChange", "perMp", "voteWeight", "share"];
  const body = [cols.join(",")].concat(
    rows.map(r => cols.map(c => {
      let v = r[c];
      if (c === "perMp" && v != null) v = Math.round(v);
      if (c === "pctChange" && v != null) v = (v * 100).toFixed(2);
      if (c === "voteWeight" && v != null) v = v.toFixed(4);
      if (c === "share" && v != null) v = (v * 100).toFixed(3);
      return esc(v);
    }).join(","))
  ).join("\n");

  return `${header}\n${body}\n`;
}
