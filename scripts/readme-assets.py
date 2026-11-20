"""Generate README logo and button SVGs with outlined brand fonts.

Text is converted to paths so the SVGs render identically on GitHub,
Forgejo and npm, where <img> SVGs cannot load web fonts.

Usage: python scripts/readme-assets.py [--brand-fonts PATH]
"""

from __future__ import annotations

import argparse
from pathlib import Path

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = Path(__file__).resolve().parent.parent
OUT_LOGO = ROOT / "assets" / "logo"
OUT_BTN = ROOT / "assets" / "buttons"

INK = "#0a0a0a"
PAPER = "#f4ead4"
PAPER_DARK = "#e8dec5"
SIGNAL_FIXED = "#d70000"  # the OKLCH-fixed red from the README showcase
SIGNAL_INK = "#b80000"
SIGNAL_NIGHT = "#ff5a5a"
LINE_NIGHT = "#8a816f"

# label -> (text, kind, font)
BUTTONS = {
    "quick-start-en": ("Quick start", "primary", "sans"),
    "quick-start-pt": ("Começo rápido", "primary", "sans"),
    "npm": ("npm i dtcg-contrast", "command", "mono"),
    "action": ("GitHub Action", "secondary", "sans"),
    "audit-en": ("Book an accessibility audit", "primary", "sans"),
    "audit-pt": ("Agende uma auditoria de acessibilidade", "primary", "sans"),
    "site": ("voaneves.com", "secondary", "sans"),
}

HEIGHT = 40
PAD_X = 18
RADIUS = 4


class Outliner:
    def __init__(self, path: Path, weight: int):
        font = TTFont(path)
        if "fvar" in font:
            font = instancer.instantiateVariableFont(font, {"wght": weight})
        self.font = font
        self.upm = font["head"].unitsPerEm
        self.cmap = font.getBestCmap()
        self.glyphs = font.getGlyphSet()
        self.hmtx = font["hmtx"]
        os2 = font["OS/2"]
        self.cap = getattr(os2, "sCapHeight", 0) or int(self.upm * 0.7)

    def width(self, text: str, size: float) -> float:
        scale = size / self.upm
        return sum(self.hmtx[self.cmap[ord(c)]][0] for c in text) * scale

    def path(self, text: str, size: float, x: float, baseline: float) -> str:
        scale = size / self.upm
        pen = SVGPathPen(self.glyphs, ntos=lambda v: f"{v:.1f}".rstrip("0").rstrip("."))
        cursor = 0.0
        for ch in text:
            name = self.cmap[ord(ch)]
            tpen = TransformPen(pen, (scale, 0, 0, -scale, x + cursor * scale, baseline))
            self.glyphs[name].draw(tpen)
            cursor += self.hmtx[name][0]
        return pen.getCommands()


def palette(kind: str, theme: str) -> dict:
    light = theme == "light"
    if kind == "primary":
        return {
            "fill": INK if light else PAPER_DARK,
            "stroke": None,
            "text": PAPER if light else INK,
            "accent": "#ff3838" if light else SIGNAL_INK,
        }
    if kind == "command":
        return {
            "fill": PAPER if light else INK,
            "stroke": INK if light else LINE_NIGHT,
            "text": INK if light else PAPER_DARK,
            "accent": SIGNAL_INK if light else SIGNAL_NIGHT,
        }
    return {
        "fill": PAPER if light else INK,
        "stroke": INK if light else LINE_NIGHT,
        "text": INK if light else PAPER_DARK,
        "accent": None,
    }


def button_svg(text: str, kind: str, fontname: str, theme: str, fonts: dict) -> str:
    sans, mono = fonts["sans"], fonts["mono"]
    font = mono if fontname == "mono" else sans
    size = 14 if fontname == "mono" else 15
    pal = palette(kind, theme)
    baseline = HEIGHT / 2 + (font.cap * size / font.upm) / 2

    parts = []
    x = PAD_X
    if kind == "primary":
        parts.append(f'<circle cx="{x + 4}" cy="{HEIGHT / 2}" r="4" fill="{pal["accent"]}"/>')
        x += 16
    if kind == "command":
        parts.append(f'<path fill="{pal["accent"]}" d="{mono.path("$", size, x, baseline)}"/>')
        x += mono.width("$ ", size)

    parts.append(f'<path fill="{pal["text"]}" d="{font.path(text, size, x, baseline)}"/>')
    x += font.width(text, size)

    if kind == "primary":
        x += 10
        parts.append(f'<path fill="{pal["text"]}" d="{sans.path("→", size, x, baseline)}"/>')
        x += sans.width("→", size)

    width = round(x + PAD_X)
    sw = 1.5
    rect = (
        f'<rect x="{sw / 2}" y="{sw / 2}" width="{width - sw}" height="{HEIGHT - sw}" '
        f'rx="{RADIUS}" fill="{pal["fill"]}"'
        + (f' stroke="{pal["stroke"]}" stroke-width="{sw}"' if pal["stroke"] else "")
        + "/>"
    )
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {HEIGHT}" '
        f'width="{width}" height="{HEIGHT}" role="img" aria-label="{text}">'
        f"{rect}{''.join(parts)}</svg>\n"
    )


def logo_svg(theme: str) -> str:
    ring = INK if theme == "light" else PAPER_DARK
    left_brace = (
        "M198 150C172 150 162 160 162 186V228C162 246 152 256 126 256"
        "C152 256 162 266 162 284V326C162 352 172 362 198 362"
    )
    right_brace = (
        "M314 150C340 150 350 160 350 186V228C350 246 360 256 386 256"
        "C360 256 350 266 350 284V326C350 352 340 362 314 362"
    )
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" role="img" aria-label="dtcg-contrast logo">
  <path fill="{INK}" d="M256 8a248 248 0 0 0 0 496Z"/>
  <path fill="{PAPER}" d="M256 8a248 248 0 0 1 0 496Z"/>
  <circle cx="256" cy="256" r="248" fill="none" stroke="{ring}" stroke-width="16"/>
  <g fill="none" stroke-width="30" stroke-linecap="round" stroke-linejoin="round">
    <path stroke="{PAPER}" d="{left_brace}"/>
    <path stroke="{INK}" d="{right_brace}"/>
  </g>
  <circle cx="256" cy="256" r="34" fill="{SIGNAL_FIXED}"/>
</svg>
"""


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--brand-fonts", default=str(ROOT.parent / "brand" / "fonts"))
    args = parser.parse_args()
    fonts_dir = Path(args.brand_fonts)
    fonts = {
        "sans": Outliner(fonts_dir / "schibsted-grotesk.woff2", 600),
        "mono": Outliner(fonts_dir / "jetbrains-mono.woff2", 500),
    }
    OUT_LOGO.mkdir(parents=True, exist_ok=True)
    OUT_BTN.mkdir(parents=True, exist_ok=True)
    for theme in ("light", "dark"):
        (OUT_LOGO / f"logo-{theme}.svg").write_text(logo_svg(theme), encoding="utf-8")
        for name, (text, kind, fontname) in BUTTONS.items():
            svg = button_svg(text, kind, fontname, theme, fonts)
            (OUT_BTN / f"{name}-{theme}.svg").write_text(svg, encoding="utf-8")
    print("ok")


if __name__ == "__main__":
    main()
