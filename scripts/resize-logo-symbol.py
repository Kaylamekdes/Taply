"""
Enlarge the Taply symbol inside the horizontal lockups.

Reads the untouched originals from public/brand/originals/ and writes
public/brand/taply-logo.png and public/brand/taply-logo-reversed.png.
Safe to re-run: it always starts from the originals, so scaling never compounds.

Only the symbol is scaled (Lanczos) and moved. The wordmark pixels are copied
1:1, and nothing is recoloured, redrawn, skewed or given effects.

Placement is measured from the artwork:
  - cap height = top of the wordmark's "T", baseline = bottom of its stem;
  - the scaled symbol is vertically centred on that span;
  - the gap to the wordmark equals the symbol's (scaled) bar thickness.
If the symbol is taller than the canvas allows, transparent rows are added at
the top only, so the wordmark keeps its position at the bottom of the canvas.

    python scripts/resize-logo-symbol.py [scale]     # default scale 1.30
"""

import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "public" / "brand" / "originals"
OUT = ROOT / "public" / "brand"
FILES = ["taply-logo.png", "taply-logo-reversed.png"]
SCALE = float(sys.argv[1]) if len(sys.argv) > 1 else 1.30
SOLID = 128  # alpha threshold for "ink" when measuring


def opaque_columns(alpha: Image.Image) -> list[bool]:
    w, h = alpha.size
    px = alpha.load()
    return [any(px[x, y] > 0 for y in range(h)) for x in range(w)]


def find_split(cols: list[bool]) -> tuple[int, int]:
    """Return (symbol_right, wordmark_left): the widest transparent column gap."""
    best = (0, 0, 0)  # (width, gap_start, gap_end)
    x, w = 0, len(cols)
    while x < w and not cols[x]:
        x += 1
    while x < w:
        if not cols[x]:
            start = x
            while x < w and not cols[x]:
                x += 1
            if x < w and x - start > best[0]:
                best = (x - start, start, x)
        x += 1
    if best[0] == 0:
        raise SystemExit("Could not find a gap between symbol and wordmark")
    return best[1], best[2]


def first_run(px, x: int, y0: int, y1: int) -> tuple[int, int]:
    """First run of solid pixels in column x between y0 and y1: (top, bottom exclusive)."""
    y = y0
    while y < y1 and px[x, y] <= SOLID:
        y += 1
    top = y
    while y < y1 and px[x, y] > SOLID:
        y += 1
    return top, y


def measure(alpha: Image.Image, gap_start: int, gap_end: int):
    w, h = alpha.size
    px = alpha.load()
    sym = alpha.crop((0, 0, gap_start, h)).getbbox()
    # The "T": its crossbar top is the cap height; its stem's bottom is the baseline.
    word_left = gap_end
    cap_top, _ = first_run(px, word_left + 8, 0, h)
    mid = cap_top + (h - cap_top) // 2
    stem_x = next(x for x in range(word_left, w) if px[x, mid] > SOLID)
    _, baseline = first_run(px, stem_x + 8, cap_top, h)
    # The symbol's bar thickness (its top bar, right of the stem).
    bar_x = sym[0] + int((sym[2] - sym[0]) * 0.75)
    bar_top, bar_bottom = first_run(px, bar_x, 0, h)
    return sym, cap_top, baseline, bar_bottom - bar_top


def process(name: str) -> tuple[int, int]:
    src = Image.open(SRC / name).convert("RGBA")
    w, h = src.size
    alpha = src.getchannel("A")
    gap_start, gap_end = find_split(opaque_columns(alpha))
    sym_box, cap_top, baseline, bar = measure(alpha, gap_start, gap_end)

    symbol = src.crop(sym_box)
    sw, sh = symbol.size
    nw, nh = round(sw * SCALE), round(sh * SCALE)
    # Pillow premultiplies alpha for RGBA resampling, so edges stay clean.
    symbol = symbol.resize((nw, nh), Image.Resampling.LANCZOS)

    left_pad = sym_box[0]
    gap = round(bar * SCALE)  # one (scaled) bar thickness
    wordmark = src.crop((gap_end, 0, w, h))  # keeps original right padding

    centre = (cap_top + baseline) / 2
    top = round(centre - nh / 2)
    pad_top = max(0, -top)
    if top + nh > h:
        raise SystemExit(f"{name}: scaled symbol runs below the canvas")

    new_w, new_h = left_pad + nw + gap + wordmark.width, h + pad_top
    canvas = Image.new("RGBA", (new_w, new_h), (0, 0, 0, 0))
    canvas.alpha_composite(symbol, (left_pad, top + pad_top))
    canvas.alpha_composite(wordmark, (left_pad + nw + gap, pad_top))
    canvas.save(OUT / name, optimize=True)

    print(
        f"{name}: cap height y={cap_top}, baseline y={baseline}, bar {bar}px; "
        f"symbol {sw}x{sh} -> {nw}x{nh} (x{SCALE}), centred on y={centre:.0f}; "
        f"gap {gap_end - sym_box[2]} -> {gap}; canvas {w}x{h} -> {new_w}x{new_h}"
    )
    return new_w, new_h


if __name__ == "__main__":
    for f in FILES:
        process(f)
