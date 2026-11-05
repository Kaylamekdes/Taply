"""Measure section edges and product-object clearances at desktop widths.

Usage (after `npm run build`; needs `pip install playwright` and
`python -m playwright install chromium`):

    python scripts/measure-gutters.py [--shots DIR]

Serves dist/ locally, loads the page at each width (intro off), scrolls
through so every reveal has run, then prints a table:
  - L / R: left and right content edges of each section (eyebrow, heading,
    grid or panel). Every L must match the container's left edge, and every R
    the container's right edge.
  - Product objects (hero cards, profile phone and card, pricing cards):
    their closest distance to the viewport edge (>= 24px required), and for
    the profile card and pricing cards, their inset inside their stage
    (>= 24px required), checked at the float and pointer-parallax extremes.
Decorative full-bleed shapes (lime circle and leaf, violet fields, the
real-world photo) are not measured. Exits non-zero if anything fails.
"""
import json
import subprocess
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"
PORT = 4210
WIDTHS = [1024, 1280, 1366, 1440, 1536, 1920]
MIN_GAP = 24
TOL = 0.5

# Section content edges: [name, left-edge selector, right-edge selector]. A
# null selector means that side isn't a section edge (e.g. the real-world copy
# sits in the right half, beside the full-bleed photo, so only its right edge
# lines up with the container).
SECTIONS = [
    ["nav", ".nav", ".nav"],
    ["hero", ".hero__copy .eyebrow", ".hero__inner"],
    ["hero band", ".hero__band .container > *", ".hero__band .container > *"],
    ["problem", "#why .eyebrow", "#why .compare"],
    ["problem panel", "#why .compare", "#why .compare"],
    ["how it works", "#how .eyebrow", "#how .steps"],
    ["features", "#features .eyebrow", "#features .fgrid"],
    ["profile", "#profile .profile__visual", "#profile .profile__copy"],
    ["pricing", "#pricing .panel", "#pricing .panel"],
    ["faq", "#faq .eyebrow", "#faq .accordion"],
    ["real world", None, ".real__copy .usecases"],
    ["final cta", ".final .eyebrow", ".final__inner"],
    ["footer", ".footer__grid", ".footer__grid"],
]

MEASURE = """(sections) => {
  const c = document.querySelector('main .container').getBoundingClientRect();
  const box = (sel) => { const el = sel && document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); return r; };
  const out = {vw: document.documentElement.clientWidth, container: {l: c.left, r: c.right}, sections: {}};
  for (const [name, ls, rs] of sections) {
    const l = box(ls), r = box(rs);
    out.sections[name] = {l: l ? l.left : null, r: r ? r.right : null};
  }
  return out;
}"""

# Product objects: viewport clearance, and inset inside their own stage.
PRODUCTS = """() => {
  const vw = document.documentElement.clientWidth;
  const R = (el) => el.getBoundingClientRect();
  const items = [
    ['hero rear card', '.stage__card--rear .pcard', null],
    ['hero front card', '.stage__card--front .pcard', null],
    ['profile phone', '.pstage__phone .phone', null],
    ['profile card', '.pstage__card .pcard', '.pstage'],
    ['pricing rear card', '.panel__card--rear .pcard', '.panel__visual'],
    ['pricing front card', '.panel__card--front .pcard', '.panel__visual'],
  ];
  const out = {};
  for (const [name, sel, stageSel] of items) {
    const el = document.querySelector(sel); if (!el) continue;
    const r = R(el);
    const o = {l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, vpGap: Math.min(r.left, vw - r.right)};
    if (stageSel) { const s = R(el.closest(stageSel));
      o.stage = {l: s.left, r: s.right, t: s.top, b: s.bottom};
      o.inset = {l: r.left - s.left, r: s.right - r.right, t: r.top - s.top, b: s.bottom - r.bottom}; }
    out[name] = o;
  }
  // The profile stage must sit inside the container.
  const ps = R(document.querySelector('.pstage')), pc = R(document.querySelector('#profile .container'));
  out._pstageInContainer = ps.left >= pc.left - 0.5 && ps.right <= pc.right + 0.5;
  return out;
}"""

# Float phase (0 = rest, 3000 = peak of the 6s loop) and hero pointer
# parallax (nx, ny in -1..1), applied the way Hero.tsx applies it.
POSE = """([floatMs, nx, ny]) => {
  document.querySelectorAll('.float').forEach(el => el.getAnimations().forEach(a => { a.pause();
    a.currentTime = floatMs + (getComputedStyle(el).animationDelay.startsWith('-3') ? 3000 : 0); }));
  const st = document.querySelector('.stage');
  st.style.transition = 'none';
  st.style.transform = `translate3d(${nx * 6}px, ${ny * 6}px, 0)`;
  const rear = document.querySelector('.stage__card--rear .stage__rotor'), front = document.querySelector('.stage__card--front .stage__rotor');
  [rear, front].forEach(el => { el.style.transition = 'none'; });
  rear.style.transform = `translate3d(${nx * -2}px, ${ny * -2}px, 0) rotate(${nx * 3.5}deg)`;
  front.style.transform = `translate3d(${nx * 2}px, ${ny * 2}px, 0)`;
}"""


def main():
    shots = None
    if "--shots" in sys.argv:
        shots = Path(sys.argv[sys.argv.index("--shots") + 1])
        shots.mkdir(parents=True, exist_ok=True)
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1"], cwd=DIST,
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    results, failures = {}, []
    try:
        time.sleep(1)
        with sync_playwright() as p:
            b = p.chromium.launch()
            for w in WIDTHS:
                pg = b.new_context(viewport={"width": w, "height": 900}).new_page()
                pg.goto(f"http://localhost:{PORT}/?intro=0", wait_until="commit")
                pg.wait_for_selector("main")
                time.sleep(1)
                # Scroll through so every reveal has played, then let them settle.
                h = pg.evaluate("document.documentElement.scrollHeight")
                for y in range(0, h, 400):
                    pg.evaluate(f"window.scrollTo(0, {y})")
                    time.sleep(0.05)
                time.sleep(1.6)
                pg.evaluate("window.scrollTo(0, 0)")
                time.sleep(0.3)
                m = pg.evaluate(MEASURE, SECTIONS)
                worst = {}
                for fm in (0, 3000):
                    for nx in (-1, 0, 1):
                        for ny in (-1, 1):
                            pg.evaluate(POSE, [fm, nx, ny])
                            prods = pg.evaluate(PRODUCTS)
                            for k, v in prods.items():
                                if k.startswith("_"):
                                    worst[k] = worst.get(k, True) and v
                                    continue
                                cur = worst.setdefault(k, {"vpGap": 1e9, "inset": None, "w": v["w"]})
                                cur["vpGap"] = min(cur["vpGap"], v["vpGap"])
                                if "inset" in v:
                                    cur["inset"] = {s: min((cur["inset"] or {}).get(s, 1e9), v["inset"][s]) for s in "lrtb"}
                pg.evaluate(POSE, [0, 0, 0])
                m["products"] = worst
                results[w] = m
                if shots:
                    for name, sel in [("profile", ".pstage"), ("pricing", ".panel")]:
                        pg.evaluate(f"document.querySelector('{sel}').scrollIntoView({{block: 'center', behavior: 'instant'}})")
                        time.sleep(0.6)
                        pg.evaluate(POSE, [0, 0, 0])
                        if w in (1280, 1440):
                            pg.screenshot(path=str(shots / f"{name}-{w}.png"))
                pg.context.close()
            b.close()
    finally:
        srv.terminate()

    # ---- table
    names = [s[0] for s in SECTIONS]
    print("\nSection content edges (px). Container L / R first; every row must match it.\n")
    head = f"{'section':<15}" + "".join(f"{w:>17}" for w in WIDTHS)
    print(head)
    print(f"{'container':<15}" + "".join(f"{results[w]['container']['l']:>8.1f} /{results[w]['container']['r']:>7.1f}" for w in WIDTHS))
    for n in names:
        row = f"{n:<15}"
        for w in WIDTHS:
            s, c = results[w]["sections"][n], results[w]["container"]
            cells = []
            for side in "lr":
                v = s[side]
                if v is None:
                    cells.append("     -")
                    continue
                ok = abs(v - c[side]) <= TOL
                if not ok:
                    failures.append(f"{w}px {n} {side.upper()} = {v:.1f}, container {c[side]:.1f}")
                cells.append(f"{v:>6.1f}{'' if ok else '!'}")
            row += f"{cells[0]:>8} /{cells[1]:>7}"
        print(row)

    print(f"\nProduct objects: worst case over float and pointer parallax (px). Need >= {MIN_GAP}.\n")
    print(f"{'object':<20}" + "".join(f"{w:>24}" for w in WIDTHS))
    for k in ["hero rear card", "hero front card", "profile phone", "profile card", "pricing rear card", "pricing front card"]:
        row = f"{k:<20}"
        for w in WIDTHS:
            v = results[w]["products"].get(k)
            if not v:
                row += f"{'n/a':>24}"
                continue
            cell = f"vp {v['vpGap']:.0f}"
            if v["vpGap"] < MIN_GAP:
                failures.append(f"{w}px {k}: {v['vpGap']:.1f}px from the viewport edge")
                cell += "!"
            if v["inset"]:
                ins = v["inset"]
                cell += f" in L{ins['l']:.0f} R{ins['r']:.0f}"
                bad = [s for s in ("l", "r") if ins[s] < MIN_GAP]
                if k.startswith("pricing"):
                    bad += [s for s in ("t", "b") if ins[s] < MIN_GAP]
                else:  # the profile card must also sit wholly inside its stage
                    bad += [s for s in ("t", "b") if ins[s] < 0]
                if bad:
                    failures.append(f"{w}px {k}: inset {ins} inside its stage")
                    cell += "!"
            row += f"{cell:>24}"
        print(row)
    print("\nprofile stage inside container: " + ", ".join(f"{w}: {results[w]['products']['_pstageInContainer']}" for w in WIDTHS))
    for w in WIDTHS:
        if not results[w]["products"]["_pstageInContainer"]:
            failures.append(f"{w}px profile stage leaves the container")
    print("profile card width: " + ", ".join(f"{w}: {results[w]['products']['profile card']['w']:.0f}px" for w in WIDTHS))

    print("\n" + ("PASS" if not failures else "FAIL\n  " + "\n  ".join(failures)))
    (ROOT / "scripts" / ".gutters.json").write_text(json.dumps(results, indent=1)) if "--json" in sys.argv else None
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
