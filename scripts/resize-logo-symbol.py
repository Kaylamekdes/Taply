"""
Enlarge the Taply symbol inside the horizontal lockups.

Reads the untouched originals from public/brand/originals/ and writes
public/brand/taply-logo.png and public/brand/taply-logo-reversed.png.
Safe to re-run: it always starts from the originals.

Only the symbol is scaled and moved. The wordmark pixels are copied 1:1, and
nothing is recoloured, redrawn, skewed or given effects.

    python scripts/resize-logo-symbol.py [scale]     # default scale 1.17
"""

import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "public" / "brand" / "originals"
OUT = ROOT / "public" / "brand"
FILES = ["taply-logo.png", "taply-logo-reversed.png"]
SCALE = float(sys.argv[1]) if len(sys.argv) > 1 else 1.17


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


def process(name: str) -> tuple[int, int]:
    src = Image.open(SRC / name).convert("RGBA")
    w, h = src.size
    alpha = src.getchannel("A")

    gap_start, gap_end = find_split(opaque_columns(alpha))

    sym_box = alpha.crop((0, 0, gap_start, h)).getbbox()  # (l, t, r, b)
    word_box = alpha.crop((gap_end, 0, w, h)).getbbox()
    word_top, word_bottom = word_box[1], word_box[3]

    symbol = src.crop(sym_box)
    sw, sh = symbol.size
    nw, nh = round(sw * SCALE), round(sh * SCALE)
    # Pillow premultiplies alpha for RGBA resampling, so edges stay clean.
    symbol = symbol.resize((nw, nh), Image.Resampling.LANCZOS)

    left_pad = sym_box[0]
    gap = round((gap_end - sym_box[2]) * SCALE)  # keep the gap proportional
    wordmark = src.crop((gap_end, 0, w, h))  # keeps original right padding

    new_w = left_pad + nw + gap + wordmark.width
    canvas = Image.new("RGBA", (new_w, h), (0, 0, 0, 0))

    # Centre the symbol on the wordmark's full vertical extent, as in the original.
    centre = (word_top + word_bottom) / 2
    top = round(centre - nh / 2)
    if top < 0 or top + nh > h:
        raise SystemExit(f"{name}: scaled symbol does not fit the canvas height")

    canvas.alpha_composite(symbol, (left_pad, top))
    canvas.alpha_composite(wordmark, (left_pad + nw + gap, 0))
    canvas.save(OUT / name, optimize=True)

    print(
        f"{name}: symbol {sw}x{sh} -> {nw}x{nh} at y={top}, gap "
        f"{gap_end - sym_box[2]} -> {gap}, canvas {w}x{h} -> {new_w}x{h}"
    )
    return new_w, h


if __name__ == "__main__":
    for f in FILES:
        process(f)
