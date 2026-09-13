#!/usr/bin/env python3
"""
Generates assets/social-card.png, the 1200x630 Open Graph preview, and
assets/og-square.png for contexts that want a square.

The chamber on the card is the REAL 543-seat allocation coloured by analytical
bloc, laid out by the same algorithm as js/hemicycle.js, so the preview is a
picture of the thing rather than a stock graphic. It is regenerated from
data/units.json, so if the data changes the card changes with it.

Run:  python scripts/make_social_card.py
"""
import json, math, os, sys
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
FONTS = os.path.join(HERE, "raw", "fonts")
OUT = os.path.join(ROOT, "assets")

INK = (20, 26, 32)
PAPER = (242, 243, 244)
MUTED = (147, 165, 178)
BRAND = (127, 176, 207)
RULE = (58, 74, 87)
# Must match GROUP_ORDER, GROUP_LABELS and BLOC_COLOURS in js/data.js.
BLOC = {"south": (23, 96, 122), "west": (93, 138, 58), "north": (168, 82, 125),
        "hindi": (179, 114, 42), "east": (79, 111, 168), "northeast": (192, 86, 58)}
LABELS = {"south": "South", "west": "West", "north": "Punjab & J&K",
          "hindi": "Hindi-belt", "east": "East", "northeast": "North-East"}
ORDER = ["south", "west", "north", "hindi", "east", "northeast"]


def font(name, size):
    """Brand font if we have it, a sane system serif or sans if we do not."""
    p = os.path.join(FONTS, name)
    if os.path.exists(p):
        return ImageFont.truetype(p, size)
    fallback = "georgia.ttf" if "Serif" in name else "arial.ttf"
    for d in (r"C:\Windows\Fonts", "/usr/share/fonts/truetype/dejavu", "/Library/Fonts"):
        q = os.path.join(d, fallback)
        if os.path.exists(q):
            return ImageFont.truetype(q, size)
    return ImageFont.load_default()


def hemicycle(n, inner_ratio=0.46, pad=0.035):
    """Port of js/hemicycle.js layout(), so the card and the site agree."""
    rows = max(4, min(17, round(math.sqrt(n / 3.1))))
    rows = min(rows, n)
    radii = [inner_ratio + (1 - inner_ratio) * (i / (rows - 1)) if rows > 1
             else (1 + inner_ratio) / 2 for i in range(rows)]
    total = sum(radii)
    exact = [n * r / total for r in radii]
    counts = [max(1, int(v)) for v in exact]
    diff = n - sum(counts)
    order = sorted(range(rows), key=lambda i: -(exact[i] - int(exact[i])))
    k = 0
    while diff > 0:
        counts[order[k % rows]] += 1; diff -= 1; k += 1
    while diff < 0:
        j = order[k % rows]
        if counts[j] > 1:
            counts[j] -= 1; diff += 1
        k += 1

    seats = []
    for r in range(rows):
        c, rad = counts[r], radii[r]
        for s in range(c):
            t = 0.5 if c == 1 else s / (c - 1)
            a = math.pi - pad - t * (math.pi - 2 * pad)
            seats.append((a, rad, math.cos(a) * rad, -math.sin(a) * rad))
    seats.sort(key=lambda p: (-p[0], -p[1]))
    arc_gap = (1 - inner_ratio) / max(1, rows - 1)
    seat_r = max(0.004, min(arc_gap * 0.36, math.pi * inner_ratio / max(counts[0], 1) * 0.42))
    return seats, seat_r


def load_blocs():
    with open(os.path.join(ROOT, "data", "units.json")) as f:
        units = json.load(f)["units"]
    tot = {g: 0 for g in ORDER}
    for u in units:
        tot[u["analytical_group"]] += u["current_seats"]
    return tot, sum(tot.values())


def draw_chamber(d, cx, cy, R, totals, scale=1.0):
    seats, seat_r = hemicycle(sum(totals.values()))
    colours = []
    for g in ORDER:
        colours += [BLOC[g]] * totals[g]
    r = max(2.0, seat_r * R * scale)
    for (a, rad, x, y), col in zip(seats, colours):
        px, py = cx + x * R, cy + y * R
        d.ellipse([px - r, py - r, px + r, py + r], fill=col)


def build(width, height, path, compact=False):
    img = Image.new("RGB", (width, height), INK)
    d = ImageDraw.Draw(img)
    totals, total = load_blocs()

    d.rectangle([0, 0, width, 6], fill=(31, 79, 122))
    pad = 62 if not compact else 46

    fb = font("FiraSans-SemiBold.ttf", 22 if not compact else 19)
    fb2 = font("FiraSans-Regular.ttf", 22 if not compact else 19)
    d.text((pad, pad), "LOK SABHA", font=fb, fill=BRAND)
    d.text((pad + d.textlength("LOK SABHA ", font=fb), pad),
           "DELIMITATION VISUALISER", font=fb2, fill=(178, 195, 208))

    ft = font("IBMPlexSerif-Medium.ttf", 88 if not compact else 58)
    d.text((pad, pad + 46), "The Frozen House", font=ft, fill=(240, 243, 245))

    fs = font("IBMPlexSerif-Regular.ttf", 26 if not compact else 21)
    y = pad + (156 if not compact else 116)
    for ln in ["Seats have been frozen on the 1971 Census since 1976.",
               "When the freeze lifts, some rule has to decide."]:
        d.text((pad, y), ln, font=fs, fill=(188, 203, 214))
        y += 36 if not compact else 30

    # The bloc key sits ABOVE the arc, in clear space. Putting it at the foot
    # left it sitting on top of the seats and unreadable.
    fk = font("FiraSans-Regular.ttf", 19 if not compact else 16)
    keys = [(LABELS[g], BLOC[g]) for g in ORDER]
    ky = y + (16 if not compact else 12)
    kx = pad
    for label, col in keys:
        d.ellipse([kx, ky + 5, kx + 11, ky + 16], fill=col)
        d.text((kx + 19, ky), label, font=fk, fill=(196, 211, 222))
        kx += 19 + d.textlength(label, font=fk) + 26
    d.text((width - pad - d.textlength(f"{total} seats today", font=fk), ky),
           f"{total} seats today", font=fk, fill=MUTED)

    # The WHOLE half-circle fits below the key. Bleeding it off the bottom edge
    # looked grander, but with six blocs it cut the two at the far right end of
    # the arc out of the picture while the key still listed them.
    top = ky + (44 if not compact else 34)
    R = min(width * (0.44 if not compact else 0.46), height - top - (22 if not compact else 40))
    draw_chamber(d, width / 2, top + R, R, totals)

    img.save(path, "PNG", optimize=True)
    return path


def main():
    os.makedirs(OUT, exist_ok=True)
    a = build(1200, 630, os.path.join(OUT, "social-card.png"))
    b = build(1000, 1000, os.path.join(OUT, "og-square.png"), compact=True)
    for p in (a, b):
        print(f"  {os.path.relpath(p, ROOT)}  {os.path.getsize(p) / 1024:.1f} KB")


if __name__ == "__main__":
    main()
