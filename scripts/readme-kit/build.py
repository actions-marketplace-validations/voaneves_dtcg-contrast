"""VOANEVES readme kit: logo, buttons, brand marks, tokens, contrast gate,
landing page and CI workflow for one repo, driven by a manifest.

Text is converted to paths so SVGs render identically on GitHub, Forgejo and
npm, where <img> SVGs cannot load web fonts.

Usage:
  python scripts/readme-kit/build.py --manifest readme-kit.json --repo-dir ../repo
Options:
  --only logo,buttons,brand,tokens,landing,workflow   (default: all)
  --no-png                                            skip logo-512.png (Chrome)
  --brand-fonts PATH                                  default: D:/GitHub/brand/fonts
  --chrome PATH
"""

from __future__ import annotations

import argparse
import copy
import html
import json
import shutil
import subprocess
import sys
import tempfile
import urllib.parse
from pathlib import Path

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

KIT = Path(__file__).resolve().parent
DEFAULT_FONTS = KIT.parent.parent.parent / "brand" / "fonts"
DEFAULT_CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe"
SCHEMA_URL = "https://raw.githubusercontent.com/voaneves/dtcg-contrast/main/dtcg-contrast.schema.json"
STEPS = ("logo", "buttons", "brand", "tokens", "landing", "workflow")


# ---------------------------------------------------------------- tokens

def _hex(value) -> str:
    return value["hex"] if isinstance(value, dict) else value


def flatten_tokens(tree: dict) -> dict:
    """Flatten the DTCG tree to {"a.b.c": {"light": hex, "dark": hex}}."""
    out: dict = {}

    def walk(node: dict, trail: list) -> None:
        if "$value" in node:
            light = _hex(node["$value"])
            dark = node.get("$extensions", {}).get("vn", {}).get("dark", light)
            out[".".join(trail)] = {"light": light, "dark": _hex(dark)}
            return
        for key, child in node.items():
            if not key.startswith("$") and isinstance(child, dict):
                walk(child, trail + [key])

    walk(tree, [])
    return out


def build_tokens(manifest: dict) -> dict:
    tree = json.loads((KIT / "tokens.base.json").read_text(encoding="utf-8"))
    if not manifest["landing"]:
        tree.pop("landing", None)
    return tree


class Palette:
    def __init__(self, tree: dict):
        self.flat = flatten_tokens(tree)

    def __call__(self, name: str, theme: str) -> str:
        try:
            return self.flat[name][theme]
        except KeyError:
            raise SystemExit(f"token '{name}' (theme '{theme}') missing") from None


# ---------------------------------------------------------------- fonts

class Outliner:
    def __init__(self, path: Path, location: dict):
        font = TTFont(path)
        if "fvar" in font:
            loc = {a.axisTag: a.defaultValue for a in font["fvar"].axes}
            loc.update(location)
            font = instancer.instantiateVariableFont(font, loc)
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

    def path(self, text: str, size: float, x: float, baseline: float, tracking: float = 0) -> str:
        scale = size / self.upm
        pen = SVGPathPen(self.glyphs, ntos=lambda v: f"{v:.1f}".rstrip("0").rstrip("."))
        cursor = 0.0
        for ch in text:
            name = self.cmap[ord(ch)]
            tpen = TransformPen(pen, (scale, 0, 0, -scale, x + cursor * scale, baseline))
            self.glyphs[name].draw(tpen)
            cursor += self.hmtx[name][0] + tracking
        return pen.getCommands()

    def boxes(self, text: str, tracking: float = 0) -> list:
        """Per-glyph (xmin, ymin, xmax, ymax) in font units, advances applied."""
        out, cursor = [], 0
        for ch in text:
            name = self.cmap[ord(ch)]
            bp = BoundsPen(self.glyphs)
            self.glyphs[name].draw(bp)
            if bp.bounds is None:
                raise SystemExit(f"glyph '{ch}' has no outline")
            x0, y0, x1, y1 = bp.bounds
            out.append((cursor + x0, y0, cursor + x1, y1))
            cursor += self.hmtx[name][0] + tracking
        return out


def load_fonts(fonts_dir: Path) -> dict:
    return {
        "sans": Outliner(fonts_dir / "schibsted-grotesk.woff2", {"wght": 600}),
        "mono": Outliner(fonts_dir / "jetbrains-mono.woff2", {"wght": 500}),
        "display": Outliner(fonts_dir / "fraunces-roman.woff2", {"opsz": 144, "wght": 600}),
    }


# ---------------------------------------------------------------- buttons

HEIGHT = 40
PAD_X = 18
RADIUS = 4


def button_palette(kind: str, theme: str, c) -> dict:
    if kind == "primary":
        return {
            "fill": c("button.primary.fill", theme),
            "stroke": None,
            "text": c("button.primary.text", theme),
            "accent": c("button.primary.signal", theme),
        }
    return {
        "fill": c("button.secondary.fill", theme),
        "stroke": c("button.secondary.border", theme),
        "text": c("button.secondary.text", theme),
        "accent": c("button.command.prompt", theme) if kind == "command" else None,
    }


def button_svg(text: str, kind: str, fontname: str, theme: str, fonts: dict, c) -> str:
    sans, mono = fonts["sans"], fonts["mono"]
    font = mono if fontname == "mono" else sans
    size = 14 if fontname == "mono" else 15
    pal = button_palette(kind, theme, c)
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
    label = html.escape(text, quote=True)
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {HEIGHT}" '
        f'width="{width}" height="{HEIGHT}" role="img" aria-label="{label}">'
        f"{rect}{''.join(parts)}</svg>\n"
    )


# ---------------------------------------------------------------- logo

BRACES = (
    "M198 150C172 150 162 160 162 186V228C162 246 152 256 126 256"
    "C152 256 162 266 162 284V326C162 352 172 362 198 362",
    "M314 150C340 150 350 160 350 186V228C350 246 360 256 386 256"
    "C360 256 350 266 350 284V326C350 352 340 362 314 362",
)

MONO_MAX_H = 160       # glyph block height cap (px in 512 box)
MONO_MAX_HALF = 145    # max horizontal reach from the divider
MONO_MIN_GAP = 0.09    # min gap between the two glyph outlines (em)
MONO_GAP = 30          # glyph block to signal dot
MONO_DOT_R = 24


def monogram_layout(text: str, display: Outliner) -> dict:
    """Place the monogram so the divider (x=256) sits at the gap between two
    glyphs (or the middle of one), with the signal dot centred beneath."""
    boxes = display.boxes(text)
    tracking = 0.0
    if len(boxes) == 2:
        tracking = max(0.0, MONO_MIN_GAP * display.upm - (boxes[1][0] - boxes[0][2]))
        boxes = display.boxes(text, tracking)
    xmin = min(b[0] for b in boxes)
    xmax = max(b[2] for b in boxes)
    ymin = min(b[1] for b in boxes)
    ymax = max(b[3] for b in boxes)
    if len(boxes) == 2:
        gc = (boxes[0][2] + boxes[1][0]) / 2
    else:
        gc = (xmin + xmax) / 2
    half = max(gc - xmin, xmax - gc)
    scale = min(MONO_MAX_H / (ymax - ymin), MONO_MAX_HALF / half)
    height = (ymax - ymin) * scale
    total = height + MONO_GAP + 2 * MONO_DOT_R
    top = 256 - total / 2
    baseline = top + ymax * scale
    return {
        "tracking": tracking,
        "size": scale * display.upm,
        "x": 256 - gc * scale,
        "baseline": baseline,
        "dot_cy": top + height + MONO_GAP + MONO_DOT_R,
    }


def logo_body(mark: str, c, theme: str, fonts: dict, uid: str = "vn") -> str:
    """Inner SVG markup for the 512 logo. `c(name, theme)` returns a color."""
    ink, paper = c("logo.ink", theme), c("logo.paper", theme)
    ring, signal = c("logo.ring", theme), c("logo.signal", theme)
    head = (
        f'  <path fill="{ink}" d="M256 8a248 248 0 0 0 0 496Z"/>\n'
        f'  <path fill="{paper}" d="M256 8a248 248 0 0 1 0 496Z"/>\n'
        f'  <circle cx="256" cy="256" r="248" fill="none" stroke="{ring}" stroke-width="16"/>\n'
    )
    if mark == "braces":
        return head + (
            '  <g fill="none" stroke-width="30" stroke-linecap="round" stroke-linejoin="round">\n'
            f'    <path stroke="{paper}" d="{BRACES[0]}"/>\n'
            f'    <path stroke="{ink}" d="{BRACES[1]}"/>\n'
            "  </g>\n"
            f'  <circle cx="256" cy="256" r="34" fill="{signal}"/>\n'
        )
    lay = monogram_layout(mark, fonts["display"])
    d = fonts["display"].path(mark, lay["size"], lay["x"], lay["baseline"], lay["tracking"])
    return head + (
        "  <defs>\n"
        f'    <clipPath id="{uid}-l"><rect x="0" y="0" width="256" height="512"/></clipPath>\n'
        f'    <clipPath id="{uid}-r"><rect x="256" y="0" width="256" height="512"/></clipPath>\n'
        "  </defs>\n"
        f'  <path fill="{paper}" clip-path="url(#{uid}-l)" d="{d}"/>\n'
        f'  <path fill="{ink}" clip-path="url(#{uid}-r)" d="{d}"/>\n'
        f'  <circle cx="256" cy="{lay["dot_cy"]:.1f}" r="{MONO_DOT_R}" fill="{signal}"/>\n'
    )


def logo_svg(name: str, mark: str, theme: str, fonts: dict, c) -> str:
    label = html.escape(f"{name} logo", quote=True)
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" '
        f'height="512" role="img" aria-label="{label}">\n'
        + logo_body(mark, c, theme, fonts)
        + "</svg>\n"
    )


def render_png(svg_path: Path, png_path: Path, chrome: str, size: int = 512) -> None:
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        page = tmp_path / "logo.html"
        page.write_text(
            "<!doctype html><meta charset=utf-8><style>html,body{margin:0;background:transparent}"
            f"img{{display:block;width:{size}px;height:{size}px}}</style>"
            f'<img src="{svg_path.resolve().as_uri()}" alt="">',
            encoding="utf-8",
        )
        subprocess.run(
            [
                chrome, "--headless=new", "--disable-gpu", "--hide-scrollbars",
                "--default-background-color=00000000", f"--user-data-dir={tmp_path / 'profile'}",
                f"--window-size={size},{size}", f"--screenshot={png_path.resolve()}",
                page.resolve().as_uri(),
            ],
            check=True, capture_output=True, timeout=120,
        )


# ---------------------------------------------------------------- brand marks

def mark_duo_svg(c) -> str:
    """VOANEVES mark visible on light and dark pages: ink disc, paper-dark ring,
    paper V, signal dot. Same geometry as assets/brand/mark-light.svg."""
    disc, ring = c("duo.disc", "light"), c("duo.ring", "light")
    glyph, signal = c("duo.glyph", "light"), c("duo.signal", "light")
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" '
        'role="img" aria-label="VOANEVES mark">\n'
        f'  <circle cx="256" cy="256" r="252" fill="{disc}" stroke="{ring}" stroke-width="8"/>\n'
        f'  <path fill="{glyph}" d="M142 148L214 148L250 244L286 148L358 148L277 364L223 364Z"/>\n'
        f'  <circle cx="340" cy="337" r="27" fill="{signal}"/>\n'
        "</svg>\n"
    )


# ---------------------------------------------------------------- contrast config

def contrast_config(manifest: dict) -> dict:
    p = lambda fg, bg, level, name, themes=None: {  # noqa: E731
        "fg": fg, "bg": bg, "level": level, "name": name,
        **({"themes": themes} if themes else {}),
    }
    pairs = [
        p("button.primary.text", "button.primary.fill", "AA", "primary button text on fill"),
        p("button.primary.signal", "button.primary.fill", "UI", "primary button signal dot on fill"),
        p("button.secondary.text", "button.secondary.fill", "AA", "secondary button text on fill"),
        p("button.command.prompt", "button.secondary.fill", "AA", "command prompt on fill"),
        p("button.secondary.border", "page", "UI", "secondary button border on page"),
        p("button.primary.fill", "page", "UI", "primary button fill on page"),
        p("logo.paper", "logo.ink", "UI", "logo paper half vs ink half"),
        p("logo.signal", "logo.paper", "UI", "logo signal dot on paper half"),
        p("logo.signal", "logo.ink", "UI", "logo signal dot on ink half"),
        p("logo.ring", "page", "UI", "logo ring on page"),
        p("duo.disc", "page", "UI", "author mark disc on light page", ["light"]),
        p("duo.ring", "page", "UI", "author mark ring on dark page", ["dark"]),
        p("duo.glyph", "duo.disc", "UI", "author mark V on disc"),
        p("duo.signal", "duo.disc", "UI", "author mark signal dot on disc"),
    ]
    if manifest["landing"]:
        pairs += [
            p("landing.text", "landing.surface", "AA", "landing text on surface"),
            p("landing.text", "landing.surfaceAlt", "AA", "landing text on alt surface"),
            p("landing.muted", "landing.surface", "AA", "landing muted text on surface"),
            p("landing.muted", "landing.surfaceAlt", "AA", "landing muted text on alt surface"),
            p("landing.link", "landing.surface", "AA", "landing link on surface"),
            p("landing.focus", "landing.surface", "UI", "landing focus ring on surface"),
            p("landing.focus", "landing.surfaceAlt", "UI", "landing focus ring on alt surface"),
            p("button.primary.fill", "landing.surface", "UI", "landing primary button fill on surface"),
            p("button.secondary.border", "landing.surface", "UI", "landing secondary button border on surface"),
            p("button.primary.text", "button.primary.fill", "AA", "landing primary button text on fill"),
            p("button.secondary.text", "button.secondary.fill", "AA", "landing secondary button text on fill"),
            p("button.command.prompt", "button.secondary.fill", "AA", "landing command prompt on fill"),
            p("logo.ring", "landing.surface", "UI", "landing logo ring on surface"),
        ]
    return {
        "$schema": SCHEMA_URL,
        "tokens": ["./tokens.json"],
        "themes": [{"name": "light"}, {"name": "dark", "extensionPath": "vn.dark"}],
        "pairs": pairs,
    }


# ---------------------------------------------------------------- workflow

def workflow_yaml(manifest: dict) -> str:
    out = f"""name: readme-kit

on:
  push:
    branches: [{manifest['branch']}]
  workflow_dispatch:

permissions:
  contents: read

jobs:
  contrast:
    name: Contrast gate
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: voaneves/dtcg-contrast@v1
        with:
          config: .github/readme-kit/contrast.config.json
          fail-on-error: true
          summary: true
"""
    if manifest["landing"]:
        out += """
  deploy:
    name: Deploy landing
    needs: contrast
    runs-on: ubuntu-latest
    permissions:
      pages: write
      id-token: write
      contents: read
    concurrency:
      group: pages
      cancel-in-progress: false
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v5
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v4
        with:
          path: landing
      - id: deployment
        uses: actions/deploy-pages@v4
"""
    return out


# ---------------------------------------------------------------- landing

I18N = {
    "en": {
        "skip": "Skip to content",
        "features": "Highlights",
        "hire_title": "Need something like this?",
        "hire_text": "I build and ship projects like this for teams. Tell me what you need.",
        "hire_cta": "Let's talk",
        "hire_href": "https://voaneves.com/en/#contact",
        "license": "Licensed under the {license} license.",
    },
    "pt": {
        "skip": "Ir para o conteúdo",
        "features": "Destaques",
        "hire_title": "Precisa de algo assim?",
        "hire_text": "Eu crio e entrego projetos como este para equipes. Conte o que você precisa.",
        "hire_cta": "Vamos conversar",
        "hire_href": "https://voaneves.com/#contato",
        "license": "Licença {license}.",
    },
}


def esc(s: str) -> str:
    return html.escape(s, quote=True)


def css_vars(c, theme: str, names: dict) -> str:
    return "\n".join(f"  --{var}:{c(tok, theme)};" for var, tok in names.items()).replace("\n  ", "\n    ")


LANDING_VARS = {
    "surface": "landing.surface", "surface-alt": "landing.surfaceAlt", "text": "landing.text",
    "muted": "landing.muted", "link": "landing.link", "focus": "landing.focus",
    "btn-primary-fill": "button.primary.fill", "btn-primary-text": "button.primary.text",
    "btn-primary-signal": "button.primary.signal", "btn-secondary-fill": "button.secondary.fill",
    "btn-secondary-text": "button.secondary.text", "btn-secondary-border": "button.secondary.border",
    "btn-command-prompt": "button.command.prompt",
}


def button_html(b: dict) -> str:
    text, href, kind = esc(b["text"]), esc(b["href"]), b.get("landing_kind", b["kind"])
    if kind == "primary":
        inner = f'<span class="dot" aria-hidden="true"></span><span>{text}</span><span aria-hidden="true">&rarr;</span>'
        cls = "btn btn-primary"
    elif kind == "command":
        inner = f'<span class="prompt" aria-hidden="true">$</span><span>{text}</span>'
        cls = "btn btn-secondary btn-command"
    else:
        inner = f"<span>{text}</span>"
        cls = "btn btn-secondary"
    return f'        <li><a class="{cls}" href="{href}">{inner}</a></li>'


def landing_html(m: dict, c, fonts: dict | None, repo_dir: Path, png_name: str | None) -> str:
    tpl = (KIT / "templates" / "landing.html").read_text(encoding="utf-8")
    t = I18N["pt" if m["lang"].lower().startswith("pt") else "en"]
    name, tagline = m["name"], m["tagline"]
    description = m.get("description") or tagline
    title = f"{name} - {tagline}"

    logo = m["logo"]
    if "existing" in logo:
        ext = Path(logo["existing"]).suffix.lower()
        mime = {".svg": "image/svg+xml", ".png": "image/png"}.get(ext, "image/png")
        src_file = repo_dir / logo["existing"]
        shutil.copyfile(src_file, repo_dir / "landing" / f"logo{ext}")
        w, h = int(logo.get("width", 112)), int(logo.get("height", 112))
        logo_markup = f'<img class="logo-img" src="logo{ext}" alt="" width="{w}" height="{h}">'
        favicon = f"logo{ext}"
        og_png = "logo.png" if ext == ".png" else png_name
    else:
        css_c = lambda n, th: "var(--logo-" + n.split(".")[1] + ")"  # noqa: E731
        body = logo_body(logo["mark"], css_c, "light", fonts, uid="vn-hero")
        logo_markup = (
            '<svg class="logo" viewBox="0 0 512 512" width="112" height="112" '
            'aria-hidden="true" focusable="false">\n' + body + "      </svg>"
        )
        fav = logo_svg(name, logo["mark"], "light", fonts, c).replace("\n", "")
        favicon = "data:image/svg+xml," + urllib.parse.quote(fav, safe="")
        og_png = png_name

    logo_vars = {k: f"logo.{k}" for k in ("ink", "paper", "ring", "signal")}

    def vars_for(theme: str) -> str:
        v = css_vars(c, theme, LANDING_VARS)
        v += "\n" + "\n".join(f"    --logo-{k}:{c(tok, theme)};" for k, tok in logo_vars.items())
        return v

    feats = []
    for f in m["features"]:
        if isinstance(f, dict):
            feats.append(f"        <li><h3>{esc(f['title'])}</h3><p>{esc(f['text'])}</p></li>")
        else:
            feats.append(f"        <li><p>{esc(f)}</p></li>")

    image = ""
    if m.get("image"):
        im = m["image"]
        wh = ""
        if im.get("width") and im.get("height"):
            wh = f' width="{int(im["width"])}" height="{int(im["height"])}"'
        image = (
            '    <section aria-label="Preview">\n'
            f'      <figure class="shot"><img src="{esc(im["src"])}" alt="{esc(im["alt"])}"{wh} loading="lazy" decoding="async"></figure>\n'
            "    </section>\n"
        )

    live = m.get("live_url")
    og_extra = f'<meta property="og:url" content="{esc(live)}">\n' if live else ""
    og_card = "summary"
    if m.get("image"):
        og_extra += f'<meta property="og:image" content="{esc(m["image"]["src"])}">\n'
        og_extra += f'<meta property="og:image:alt" content="{esc(m["image"]["alt"])}">\n'
        og_card = "summary_large_image"
    elif og_png and live:
        og_extra += f'<meta property="og:image" content="{esc(live.rstrip("/") + "/" + og_png)}">\n'
        og_extra += f'<meta property="og:image:alt" content="{esc(name)} logo">\n'
    canonical = f'<link rel="canonical" href="{esc(live)}">\n' if live else ""

    repo = m["repo"] if "/" in m["repo"] else f"voaneves/{m['repo']}"
    buttons = "\n".join(button_html(b) for b in m["buttons"] if b.get("landing", True))

    repl = {
        "LANG": esc(m["lang"]), "TITLE": esc(title), "DESCRIPTION": esc(description),
        "THEME_LIGHT": c("landing.surface", "light"), "THEME_DARK": c("landing.surface", "dark"),
        "OG_CARD": og_card, "CANONICAL": canonical, "FAVICON": esc(favicon), "OG_EXTRA": og_extra,
        "VARS_LIGHT": vars_for("light").replace("\n    ", "\n  "),
        "VARS_DARK": vars_for("dark"),
        "SKIP": esc(t["skip"]), "LOGO": logo_markup, "NAME": esc(name), "TAGLINE": esc(tagline),
        "BUTTONS": buttons, "FEATURES_TITLE": esc(t["features"]), "FEATURES": "\n".join(feats),
        "IMAGE": image, "HIRE_TITLE": esc(t["hire_title"]), "HIRE_TEXT": esc(t["hire_text"]),
        "HIRE_CTA": esc(t["hire_cta"]), "HIRE_HREF": esc(m.get("hire_href") or t["hire_href"]),
        "LICENSE_LINE": esc(t["license"].format(license=m.get("license", "MIT"))),
        "GITHUB": f"https://github.com/{repo}",
    }
    for k, v in repl.items():
        tpl = tpl.replace("{{" + k + "}}", v)
    return tpl


# ---------------------------------------------------------------- main

def load_manifest(path: Path) -> dict:
    m = json.loads(path.read_text(encoding="utf-8"))
    for key in ("repo", "name", "tagline", "logo", "buttons"):
        if key not in m:
            raise SystemExit(f"manifest: missing '{key}'")
    m.setdefault("branch", "main")
    m.setdefault("lang", "en")
    m.setdefault("landing", False)
    logo = m["logo"]
    if not ("existing" in logo or "mark" in logo):
        raise SystemExit("manifest: logo needs 'mark' or 'existing'")
    if "mark" in logo and logo["mark"] != "braces" and not 1 <= len(logo["mark"]) <= 2:
        raise SystemExit("manifest: logo.mark must be 'braces' or 1-2 characters")
    for b in m["buttons"]:
        if b.get("kind") not in ("primary", "secondary", "command"):
            raise SystemExit(f"manifest: button '{b.get('id')}' has bad kind")
        b.setdefault("font", "mono" if b["kind"] == "command" else "sans")
        if m["landing"] and b.get("landing", True) and not b.get("href"):
            raise SystemExit(f"manifest: button '{b['id']}' needs href for the landing")
    if m["landing"] and len(m.get("features", [])) != 3:
        raise SystemExit("manifest: landing needs exactly 3 features")
    return m


def write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8", newline="\n")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--manifest", required=True)
    ap.add_argument("--repo-dir", required=True)
    ap.add_argument("--only", default=",".join(STEPS))
    ap.add_argument("--no-png", action="store_true")
    ap.add_argument("--brand-fonts", default=str(DEFAULT_FONTS))
    ap.add_argument("--chrome", default=DEFAULT_CHROME)
    args = ap.parse_args()

    only = set(args.only.split(","))
    if not only <= set(STEPS):
        raise SystemExit(f"--only accepts: {', '.join(STEPS)}")
    repo = Path(args.repo_dir).resolve()
    m = load_manifest(Path(args.manifest))
    tree = build_tokens(m)
    c = Palette(tree)
    existing_logo = "existing" in m["logo"]
    fonts = load_fonts(Path(args.brand_fonts))
    png_name = None

    if "tokens" in only:
        write(repo / ".github/readme-kit/tokens.json", json.dumps(tree, indent=2, ensure_ascii=False) + "\n")
        write(repo / ".github/readme-kit/contrast.config.json",
              json.dumps(contrast_config(m), indent=2, ensure_ascii=False) + "\n")

    if "logo" in only and not existing_logo:
        out = repo / "assets/logo"
        for theme in ("light", "dark"):
            write(out / f"logo-{theme}.svg", logo_svg(m["name"], m["logo"]["mark"], theme, fonts, c))
        if not args.no_png:
            render_png(out / "logo-light.svg", out / "logo-512.png", args.chrome)

    if "buttons" in only:
        out = repo / "assets/buttons"
        for b in m["buttons"]:
            for theme in ("light", "dark"):
                write(out / f"{b['id']}-{theme}.svg",
                      button_svg(b["text"], b["kind"], b["font"], theme, fonts, c))

    if "brand" in only:
        out = repo / "assets/brand"
        out.mkdir(parents=True, exist_ok=True)
        for theme in ("light", "dark"):
            shutil.copyfile(KIT / "templates" / f"rule-{theme}.svg", out / f"rule-{theme}.svg")
        write(out / "mark-duo.svg", mark_duo_svg(c))

    if "landing" in only and m["landing"]:
        (repo / "landing").mkdir(parents=True, exist_ok=True)
        png = repo / "assets/logo/logo-512.png"
        if png.exists():
            shutil.copyfile(png, repo / "landing/logo-512.png")
            png_name = "logo-512.png"
        write(repo / "landing/index.html", landing_html(m, c, fonts, repo, png_name))

    if "workflow" in only:
        write(repo / ".github/workflows/readme-kit.yml", workflow_yaml(m))

    print("ok")


if __name__ == "__main__":
    main()
