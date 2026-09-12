/* ---------------------------------------------------------------------------
   Seat blocks. One square per seat, so a state's whole allocation is countable
   rather than merely comparable.

     solid grey   a seat it keeps
     solid blue   a seat it gains
     hollow ochre a seat it holds today and would lose

   Showing the lost seats as outlines rather than deleting them is the point:
   each block shows the new allocation AND what was displaced to get there.
--------------------------------------------------------------------------- */
import { fmt } from "./data.js";

export function renderBlocks(el, rows) {
  const ordered = [...rows].sort((a, b) => {
    if (a.absent !== b.absent) return a.absent ? 1 : -1;
    return (b.change ?? -Infinity) - (a.change ?? -Infinity) || a.name.localeCompare(b.name);
  });

  el.innerHTML = ordered.map(r => {
    if (r.absent) {
      return `<div class="block">
        <div class="block-head"><span class="block-name">${r.name}</span>
          <span class="block-delta same">—</span></div>
        <p class="block-sub">Not enumerated in this census.</p>
      </div>`;
    }
    const kept = Math.min(r.current, r.seats);
    const gained = Math.max(0, r.seats - r.current);
    const lost = Math.max(0, r.current - r.seats);
    const cls = r.change > 0 ? "up" : r.change < 0 ? "down" : "same";
    const squares =
      `${'<span class="sq kept"></span>'.repeat(kept)}` +
      `${'<span class="sq gain"></span>'.repeat(gained)}` +
      `${'<span class="sq loss"></span>'.repeat(lost)}`;

    return `<div class="block">
      <div class="block-head">
        <span class="block-name">${r.name}</span>
        <span class="block-delta ${cls}">${r.change === 0 ? "0" : fmt.d(r.change)}</span>
      </div>
      <p class="block-sub">${r.current} &rarr; ${r.seats} seats</p>
      <div class="squares" role="img"
           aria-label="${r.name}: ${r.current} seats now, ${r.seats} under these rules${
             lost ? `, ${lost} lost` : gained ? `, ${gained} gained` : ", unchanged"}.">
        ${squares}
      </div>
    </div>`;
  }).join("");
}
