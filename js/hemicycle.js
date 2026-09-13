/* ---------------------------------------------------------------------------
   The chamber. A Lok Sabha hemicycle where every seat is a real seat, so a
   house of 543 and a house of 888 look as different as they are.

   Seats are laid out in concentric arcs, the number in each arc proportional to
   its radius so the density stays even. They are then ordered by ANGLE across
   all arcs at once, left to right, rather than row by row. That is what makes a
   bloc occupy a contiguous wedge of the chamber instead of a stripe in every
   row, and it is the thing that makes these diagrams readable at a glance.
--------------------------------------------------------------------------- */

/* How many arcs to use. Enough that seats stay large at 400 and the chamber
   does not become a thin ribbon at 1100. */
function arcCount(n) {
  return Math.max(4, Math.min(17, Math.round(Math.sqrt(n / 3.1))));
}

/* Seat centres, ordered left to right across the whole chamber. */
export function layout(n, { innerRatio = 0.46, padAngle = 0.035 } = {}) {
  if (n <= 0) return { seats: [], rows: 0, seatRadius: 0 };
  const rows = Math.min(arcCount(n), n);

  const radii = [];
  for (let i = 0; i < rows; i++) {
    radii.push(rows === 1 ? (1 + innerRatio) / 2
                          : innerRatio + (1 - innerRatio) * (i / (rows - 1)));
  }

  /* Seats per arc in proportion to arc length, then settle the rounding on
     whichever arcs are furthest from their exact share so the density stays
     even rather than piling the remainder on the outside. */
  const total = radii.reduce((a, b) => a + b, 0);
  const exact = radii.map(r => (n * r) / total);
  const counts = exact.map(v => Math.max(1, Math.floor(v)));
  let diff = n - counts.reduce((a, b) => a + b, 0);
  const order = exact.map((v, i) => ({ i, frac: v - Math.floor(v) }))
                     .sort((a, b) => b.frac - a.frac);
  let k = 0;
  while (diff > 0) { counts[order[k % rows].i] += 1; diff--; k++; }
  while (diff < 0) {
    const j = order[k % rows].i;
    if (counts[j] > 1) { counts[j] -= 1; diff++; }
    k++;
  }

  const seats = [];
  for (let r = 0; r < rows; r++) {
    const c = counts[r], rad = radii[r];
    for (let s = 0; s < c; s++) {
      /* Spread across the half-circle, inset at both ends so the outermost
         seats do not sit exactly on the baseline. */
      const t = c === 1 ? 0.5 : s / (c - 1);
      const a = Math.PI - padAngle - t * (Math.PI - 2 * padAngle);
      seats.push({ angle: a, radius: rad, row: r,
                   x: Math.cos(a) * rad, y: -Math.sin(a) * rad });
    }
  }

  /* Left to right. Ties inside a column resolve outermost-first, which reads
     more naturally than the reverse. */
  seats.sort((p, q) => q.angle - p.angle || q.radius - p.radius);

  const arcGap = (1 - innerRatio) / Math.max(1, rows - 1);
  const seatRadius = Math.min(arcGap * 0.36,
    (Math.PI * innerRatio) / Math.max(counts[0], 1) * 0.42);

  return { seats, rows, seatRadius: Math.max(0.004, seatRadius) };
}

/* Assemble the blocs in the order they should appear across the chamber, and
   hand back both the seat list and a legend. */
export function buildBlocs(rows, mode, palette, groupOrder = []) {
  const key = mode === "zonal" ? "zone" : "group";
  const ORDER = mode === "zonal"
    ? ["southern", "western", "central", "northern", "eastern", "nec", "none"]
    : groupOrder;

  const buckets = new Map();
  for (const r of rows) {
    if (r.absent || !r.seats) continue;
    const id = r[key] ?? "none";
    if (!buckets.has(id)) buckets.set(id, { id, seats: 0, units: [] });
    const b = buckets.get(id);
    b.seats += r.seats;
    b.units.push(r);
  }
  const ordered = ORDER.filter(id => buckets.has(id)).map(id => buckets.get(id));
  for (const b of buckets.values()) if (!ORDER.includes(b.id)) ordered.push(b);

  return ordered.map(b => ({ ...b, colour: palette[b.id] ?? "#9aa4ac" }));
}

export function render(el, { seats, seatRadius }, blocs, opts = {}) {
  const { width = 760, label = "", sublabel = "" } = opts;
  const pad = 10;
  const R = (width - pad * 2) / 2;
  const height = R + pad * 2 + (label ? 46 : 0);
  const cx = width / 2, cy = R + pad + (label ? 46 : 0);

  /* Paint blocs left to right across the ordered seat list. */
  const colours = [];
  for (const b of blocs) for (let i = 0; i < b.seats; i++) colours.push(b.colour);

  const rSeat = Math.max(1.4, seatRadius * R);
  const circles = seats.map((s, i) =>
    `<circle cx="${(cx + s.x * R).toFixed(1)}" cy="${(cy + s.y * R).toFixed(1)}" ` +
    `r="${rSeat.toFixed(2)}" fill="${colours[i] ?? "#c9ced3"}"/>`).join("");

  const total = blocs.reduce((a, b) => a + b.seats, 0);
  const centre = label
    ? `<text x="${cx}" y="${cy - 14}" text-anchor="middle" class="hc-total">${total}</text>
       <text x="${cx}" y="${cy + 8}" text-anchor="middle" class="hc-total-label">${label}</text>
       ${sublabel ? `<text x="${cx}" y="${cy + 27}" text-anchor="middle" class="hc-sub">${sublabel}</text>` : ""}`
    : "";

  el.innerHTML =
    `<svg viewBox="0 0 ${width} ${height}" width="100%" role="img"
          aria-label="${total} seats arranged as a chamber. ${
            blocs.map(b => `${b.label ?? b.id}: ${b.seats}`).join(". ")}.">
       ${circles}${centre}
     </svg>`;
}
