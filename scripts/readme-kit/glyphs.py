"""Pictogram glyphs for the VOANEVES logo frame (512 grid, split disc).

Each glyph is pure geometry. Rules live in GLYPHS.md. A glyph is a dict:

  strokes   list of SVG path strings, drawn with the one stroke weight (30)
  nodes     list of (cx, cy, r) solid dots in the glyph colour (graph nodes)
  fills     list of SVG path strings filled in the glyph colour (snake head, small solids)
  holes     list of (cx, cy, r) dots in the half's background colour (nostrils, eyes)
  soft      list of SVG path strings, thin low-contrast texture (grids, links)
  softdots  list of (cx, cy, r) faint dots (arena lattices)
  dot       (cx, cy, r) the ONE signal-red dot; it carries the glyph's story

build.py paints strokes/nodes/soft in paper on the left half and ink on the
right half (clipPath polarity), then the signal dot on top.
"""

from __future__ import annotations

import math
import re

STROKE = 30
SOFT_W = 10
SOFT_OPACITY = 0.42
SOFT_DOT_OPACITY = 0.26
R = 26  # default signal dot radius


def pt(x, y):
    """A stroke-weight dot: a zero-length round-capped subpath."""
    return f"M{x} {y}h.01"


def lattice(x0, x1, y0, y1, pitch, r=4.5):
    """Faint dot lattice including both end values."""
    xs = range(x0, x1 + 1, pitch)
    ys = range(y0, y1 + 1, pitch)
    return [(x, y, r) for y in ys for x in xs]


def rect(x, y, w, h, rad=0):
    if not rad:
        return f"M{x} {y}h{w}v{h}h{-w}Z"
    return (f"M{x + rad} {y}h{w - 2 * rad}a{rad} {rad} 0 0 1 {rad} {rad}v{h - 2 * rad}"
            f"a{rad} {rad} 0 0 1 {-rad} {rad}h{-(w - 2 * rad)}a{rad} {rad} 0 0 1 {-rad} {-rad}"
            f"v{-(h - 2 * rad)}a{rad} {rad} 0 0 1 {rad} {-rad}Z")


def circle(cx, cy, r):
    return f"M{cx - r} {cy}a{r} {r} 0 1 0 {2 * r} 0a{r} {r} 0 1 0 {-2 * r} 0Z"


def polar(cx, cy, r, deg):
    a = math.radians(deg)
    return cx + r * math.cos(a), cy + r * math.sin(a)


def arc(cx, cy, r, a0, a1):
    """Clockwise arc from angle a0 to a1 (degrees, 0 = 3 o'clock, SVG y-down)."""
    x0, y0 = polar(cx, cy, r, a0)
    x1, y1 = polar(cx, cy, r, a1)
    large = 1 if (a1 - a0) % 360 > 180 else 0
    return f"M{x0:.1f} {y0:.1f}A{r} {r} 0 {large} 1 {x1:.1f} {y1:.1f}"


def chevron(cx, cy, r, deg, size=30):
    """Clockwise arrowhead whose tip sits on the circle at `deg`."""
    a = math.radians(deg)
    tx, ty = -math.sin(a), math.cos(a)   # clockwise tangent
    nx, ny = math.cos(a), math.sin(a)    # outward normal
    px, py = cx + r * math.cos(a), cy + r * math.sin(a)
    p1 = (px - tx * size + nx * size * 0.9, py - ty * size + ny * size * 0.9)
    p2 = (px - tx * size - nx * size * 0.9, py - ty * size - ny * size * 0.9)
    return f"M{p1[0]:.1f} {p1[1]:.1f}L{px:.1f} {py:.1f}L{p2[0]:.1f} {p2[1]:.1f}"


def block(cx, cy, half=14):
    """Solid rounded block: a closed square at the glyph weight (side 2*half+30)."""
    return rect(cx - half, cy - half, 2 * half, 2 * half)


def xf(path, s, tx, ty):
    """Scale+translate a path made only of absolute M/C/L/Z commands (x y pairs)."""
    parts = re.findall(r"[MCLZ]|-?\d+\.?\d*", path)
    out, pair = [], []
    for p in parts:
        if p in "MCLZ":
            out.append(p)
            continue
        pair.append(float(p))
        if len(pair) == 2:
            out.append(f"{pair[0] * s + tx:.1f} {pair[1] * s + ty:.1f}")
            pair = []
    return " ".join(out)


def _g(strokes=(), nodes=(), soft=(), softdots=(), dot=(256, 256, R), fills=(), holes=(), soft_w=None, soft_op=None):
    return {"strokes": list(strokes), "nodes": list(nodes), "fills": list(fills), "holes": list(holes),
            "soft": list(soft), "soft_w": soft_w or SOFT_W, "soft_op": soft_op or SOFT_OPACITY,
            "softdots": list(softdots), "dot": dot}


GLYPHS: dict = {}


def glyph(name):
    def deco(fn):
        GLYPHS[name] = fn()
        return fn
    return deco


# ------------------------------------------------------------ letter hybrids

@glyph("snake")
def _snake():
    # An S made of grid-snake moves with rounded corners. Tail bottom-left,
    # head top-right; the head points at the food (red dot) on the arena.
    x = 151
    s = (f"M{x} 346H{x + 128}a30 30 0 0 0 30-30V286a30 30 0 0 0-30-30H{x + 30}a30 30 0 0 1-30-30V196"
         f"a30 30 0 0 1 30-30H{x + 132}")
    return _g([s], fills=[rect(x + 111, 143, 58, 46, 15)],
              softdots=lattice(121, 391, 106, 376, 30, 4.2),
              dot=(361, 166, R))


@glyph("timeline")
def _timeline():
    # A T: the crossbar is the path with round milestone nodes; the stem drops
    # from the junction node on the divider. The red dot closes the path: now.
    bar = "M141 186H340"
    stem = "M256 186V336"
    nodes = [(141, 186, 25), (201, 186, 25), (256, 186, 25), (316, 186, 25)]
    return _g([bar, stem], nodes=nodes, dot=(376, 186, R))


# ------------------------------------------------------------ pictograms

@glyph("grid")
def _grid():
    # Sudoku board: framed 3x3. The dot is the solved cell.
    frame = rect(121, 121, 270, 270, 36)
    inner = "M211 121V391M301 121V391M121 211H391M121 301H391"
    return _g([frame, inner], dot=(256, 256, 22))


@glyph("book")
def _book():
    pages = ("M126 168C170 153 222 158 256 183C290 158 342 153 386 168V294"
             "C342 279 290 284 256 309C222 284 170 279 126 294Z")
    return _g([pages, "M256 183V309"], dot=(256, 358, 24))


@glyph("text")
def _text():
    return _g(["M156 176H391M121 256H391M121 336H290"], dot=(344, 336, R))


@glyph("magnifier")
def _magnifier():
    return _g([circle(216, 216, 78), "M271 271L385 385"], dot=(216, 216, 28))


@glyph("pipeline")
def _pipeline():
    cyl = ("M121 186a45 20 0 1 0 90 0a45 20 0 1 0-90 0V326a45 20 0 0 0 90 0V186"
           "M121 256a45 20 0 0 0 90 0")
    chart = "M296 346L334 296L362 322L391 252"
    return _g([cyl, chart], dot=(391, 192, R))


@glyph("bars")
def _bars():
    bars = "M136 374V304M196 374V254M256 374V204M316 374V244M376 374V284"
    return _g([bars], dot=(256, 148, R))


@glyph("etl")
def _etl():
    funnel = "M121 186C186 186 196 256 256 256M121 326C186 326 196 256 256 256M121 256H300"
    head = "M290 226L320 256L290 286"
    return _g([funnel, head], dot=(376, 256, 24))


@glyph("cloud")
def _cloud():
    c = ("M181 351C146 351 121 326 121 296C121 266 143 246 171 244C173 194 209 161 256 161"
         "C297 161 326 185 336 219C368 221 391 247 391 286C391 325 366 351 331 351Z")
    # cloud on top, the cost curve falling beneath it to the savings point
    return _g([xf(c, 0.8, 51, 0), "M136 336C206 336 226 366 296 366"], dot=(352, 366, R))


@glyph("scatter")
def _scatter():
    axes = "M121 121V391H391"
    pts = [pt(186, 326), pt(226, 286), pt(266, 316), pt(306, 236)]
    return _g([axes] + pts, soft=["M150 360L380 150"], dot=(356, 176, R))


@glyph("network")
def _network():
    ins = [(136, 186), (136, 256), (136, 326)]
    hid = [(256, 221), (256, 291)]
    out = (376, 256)
    links = [f"M{a[0]} {a[1]}L{b[0]} {b[1]}" for a in ins for b in hid]
    links += [f"M{a[0]} {a[1]}L{out[0]} {out[1]}" for a in hid]
    nodes = [(x, y, 24) for x, y in ins + hid]
    return _g(nodes=nodes, soft=links, dot=(376, 256, 30))


@glyph("gamepad")
def _gamepad():
    body = ("M171 176H341C376 176 391 201 391 246C391 296 381 346 356 346C336 346 331 326 316 306"
            "H196C181 326 176 346 156 346C131 346 121 296 121 246C121 201 136 176 171 176Z")
    pad = "M186 222V270M162 246H210"
    return _g([body, pad, pt(296, 268)], dot=(340, 234, R))


@glyph("stairs")
def _stairs():
    # Travian build queue: a pyramid of blocks with a dashed empty slot on top.
    # The dot is the next build.
    rows = [(346, (176, 256, 336)), (266, (216, 296))]
    bl = [block(x, y) for y, xs in rows for x in xs]
    slot = [arc(256, 186, 40, 45 * k, 45 * k + 22) for k in range(8)]
    return _g(bl, soft=slot, dot=(256, 186, 24))


@glyph("layers")
def _layers():
    top = "M256 136L386 196L256 256L126 196Z"
    mid = "M126 262L256 322L386 262"
    low = "M126 328L256 388L386 328"
    return _g([top, mid, low], dot=(256, 196, 22))


@glyph("loop")
def _loop():
    # RL agent/environment loop; the dot is the reward at its centre.
    r = 105
    a = arc(256, 256, r, 200, 335)
    b = arc(256, 256, r, 20, 155)
    return _g([a, chevron(256, 256, r, 335), b, chevron(256, 256, r, 155)], dot=(256, 256, 28))


@glyph("maze")
def _maze():
    # Concentric corridor walls with offset gaps, a pellet trail along the
    # corridor and a power pellet (the dot) at the corner junction.
    outer = ("M391 246V151a30 30 0 0 0-30-30H151a30 30 0 0 0-30 30V361a30 30 0 0 0 30 30"
             "H361a30 30 0 0 0 30-30V326")
    mid = ("M201 227V221a20 20 0 0 1 20-20H291a20 20 0 0 1 20 20V291a20 20 0 0 1-20 20"
           "H221a20 20 0 0 1-20-20V285")
    pellets = [(x, 161, 8) for x in (166, 206, 246, 286)] + [(351, y, 8) for y in (206, 246)]
    return _g([outer, mid], nodes=pellets,
              dot=(351, 161, 22))


@glyph("ring")
def _ring():
    # Spinner: five arcs and the red head leading the sixth slot.
    r = 110
    arcs = [arc(256, 256, r, -60 + 60 * k - 14, -60 + 60 * k + 14) for k in range(1, 6)]
    x, y = polar(256, 256, r, -60)
    return _g(arcs, dot=(round(x, 1), round(y, 1), R))


@glyph("calendar")
def _calendar():
    frame = rect(126, 156, 260, 230, 30)
    head = "M126 232H386M196 126V186M316 126V186"
    days = [(x, y, 8) for y in (284, 336) for x in (186, 256, 326)]
    days.remove((326, 284, 8))
    return _g([frame, head], softdots=days, dot=(326, 284, 24))


@glyph("dropper")
def _dropper():
    # Eyedropper; the dot is the picked colour.
    return _g(["M308 150L366 208M338 180L204 314"], fills=[circle(372, 140, 30)],
              dot=(160, 352, 26))


@glyph("bank")
def _bank():
    roof = "M126 196L256 131L386 196"
    cols = "M166 246V336M256 246V336M346 246V336"
    base = "M126 376H386"
    return _g([roof, cols, base], dot=(256, 198, 22))


@glyph("pixel-snake")
def _pixel_snake():
    # snake-on-pygame: a chunky pixel snake (square segments, tapering tail)
    # stair-stepping across a faint 4x4 field; its head faces the apple.
    xs = [148, 220, 292, 364]
    cells = [(0, 3, 8), (1, 3, 12), (1, 2, 12), (2, 2, 12), (3, 2, 12), (3, 1, 12)]
    bl = [rect(xs[c] - h, xs[r] - h, 2 * h, 2 * h) for c, r, h in cells]
    grid = [f"M{x} 112V400" for x in (112, 184, 256, 328, 400)]
    grid += [f"M112 {y}H400" for y in (112, 184, 256, 328, 400)]
    return _g(bl, soft=grid, soft_w=4, soft_op=0.24, dot=(364, 148, 24))


@glyph("dashboard")
def _dashboard():
    frame = rect(121, 151, 270, 210, 30)
    div = "M286 151V361"
    bars = "M171 321V261M226 321V221"
    return _g([frame, div, bars, "M326 316H346"], dot=(336, 226, 24))


@glyph("steps")
def _steps():
    st = "M126 366H186V306H246V246H306V186H336"
    return _g([st], dot=(366, 150, R))


@glyph("fasting")
def _fasting():
    # 16h fast as a long arc; the 8h eating window is the gap where the dot sits.
    return _g([arc(256, 256, 108, 330, 570), "M256 256V196M256 256L296 280"], dot=(256, 148, R))


@glyph("piggy")
def _piggy():
    # Piggy bank: round body with a coin slot, ear, snout with nostrils, legs.
    # The dot is the coin dropping into the slot.
    body = "M264.5 188.7A110 80 0 1 1 207.5 188.7"
    return _g([body, "M292 200L312 158L340 208", "M176 338V382M296 338V382"],
              nodes=[(300, 240, 8)],
              fills=[circle(362, 272, 34)],
              holes=[(352, 272, 6), (372, 272, 6)],
              dot=(236, 146, 24))


def _rot(px, py, ang, pts):
    a = math.radians(ang)
    ca, sa = math.cos(a), math.sin(a)
    return [(px + (x - px) * ca - (y - py) * sa, py + (x - px) * sa + (y - py) * ca) for x, y in pts]


@glyph("stories")
def _stories():
    # A stack of story cards, each peeking up and to the left of the next;
    # progress segments on the front card. The dot is the post.
    return _g(["M150 265V135H250", "M206 321V191H306", rect(262, 247, 100, 130, 22)],
              soft=["M282 281H317M327 281H342"], dot=(312, 326, 26))


@glyph("notes")
def _notes():
    stems = "M206 336V176L326 146V316"
    beam = "M206 216L326 186"
    return _g([stems, beam], nodes=[(176, 336, 30)], dot=(296, 316, 30))


@glyph("tag")
def _tag():
    # Lanyard badge with a check mark; the dot is the check-in.
    frame = rect(176, 190, 160, 190, 30)
    strap = "M216 190L236 132H276L296 190"
    check = "M216 312L244 340L296 282"
    return _g([frame, strap, check], dot=(296, 282, 24))


@glyph("pulse")
def _pulse():
    line = "M121 266H176L206 226L236 306L266 166L296 296L316 266H391"
    return _g([line], dot=(266, 166, 28))


@glyph("scale")
def _scale():
    beam = "M166 176H346"
    pans = "M166 176L128 236M166 176L204 236M346 176L308 236M346 176L384 236"
    bowls = "M128 236a38 38 0 0 0 76 0ZM308 236a38 38 0 0 0 76 0Z"
    base = "M256 176V366M196 366H316"
    return _g([beam, pans, bowls, base], dot=(256, 176, 24))
