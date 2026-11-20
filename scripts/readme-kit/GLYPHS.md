# Logo glyphs

Named pictograms for the VOANEVES logo frame. Set `"logo": { "glyph": "<name>" }`
in the manifest; `mark` (monogram) stays as the fallback when `glyph` is absent.
The shapes live in `glyphs.py` as pure SVG path data on the 512 grid.

## Rules (every glyph)

1. **Letter where natural, pictogram where not. Never force.** If the project's
   initial can itself be the object (snake = an S made of snake moves, timeline =
   a T whose crossbar is the path), merge them. Otherwise draw the object.
   No text and no letters set in a typeface.
2. **One stroke weight, 30**, round caps, round joins (same as the braces).
   Solid blocks are closed squares at that weight. Small solids (head, nodes) are
   `fills`/`nodes` and never read as a second weight.
3. **Texture layer** (optional): thin faint lines or dots (width 10 at 42% opacity,
   dots at 26%) for context such as the arena lattice or network links. Same
   colours as the glyph, so no new tokens. A glyph may set `soft_w`/`soft_op` when a dense field (4x4 grid) needs to be quieter. `holes` are small dots in the half's background colour (nostrils, eyes). It must be removable without losing meaning.
4. **Safe zone 300x300** centred on (256, 256), stroke included. Optical mass
   centred, not the bounding box.
5. **The divider (x = 256) is part of the drawing.** Everything is painted twice
   with a clipPath: paper on the left (ink half), ink on the right (paper half).
   Put the glyph's axis, a join, or a bar on the divider so the swap reads as
   intent.
6. **Exactly one red dot (#d70000)**, radius 22 to 30, and it must carry the
   project's story (food, now, solved cell, result, peak, savings, reward, next
   build, check-in...). It sits in clear space or on a vertex, never hidden.
   The README table below records each meaning.
7. **Readability:** minimum clear gap 24 (about 1.5 px at 32 px). Test at 16, 32,
   64, 256 on `#ffffff` and `#0d1117`. The silhouette and the red dot must be
   identifiable at 32; 16 only needs the dot and a coherent mass.
8. **No third-party IP**: no logo, mascot, character or trade dress (no Pac-Man
   shape, no Xbox/Microsoft/Google/Colab marks).
9. **No new colours**: only `logo.ink`, `logo.paper`, `logo.signal` (and the ring
   token), so the contrast gate needs no new pairs.

## Adding a glyph

```python
@glyph("name")
def _name():
    return _g(strokes=[...], dot=(cx, cy, r))   # + nodes / fills / soft / softdots
```

Then add `"glyph": "name"` to the repo manifest, run `build.py`, and look at the
contact sheet at 16/32/64/256 before committing.

## Glyph map

| glyph | project | dot means |
|---|---|---|
| braces (build.py) | dtcg-contrast | the token |
| snake | snake-arena | food the agents chase |
| pixel-snake | snake-on-pygame | the apple |
| timeline | timeline | now |
| grid | sudoku-solver | the solved cell |
| book | bible-app | bookmark ribbon |
| text | blog | the full stop |
| magnifier | python-google-search | the result |
| pipeline | azure_company_analysis | the insight |
| dashboard | xbox-sales | the KPI |
| bars | financial_sample_analysis | the peak |
| etl | etl-sdw2023 | the loaded record |
| cloud | farmacias-aws | the savings point |
| scatter | Data-Visualization-in-Python-freeCodeCamp | highlighted point |
| network | LearningML | output node |
| loop | colab-rl | the reward |
| gamepad | js-games | the winning press |
| stairs | travian-building-order | next build |
| layers | voaneves-intermediario | current layer |
| maze | pacman-on-pygame | power pellet |
| ring | loading | spinner head |
| calendar | calendario-de-aniversarios | the birthday |
| dropper | color-picker | the picked colour |
| bank | simple-bank | the coin |
| steps | altamente | the milestone |
| fasting | jejumintermitente | the eating window |
| piggy | meupoupig | the coin |
| stories | midflow-app | the post |
| notes | vote-play | the vote |
| tag | bip-kids | the check-in |
| pulse | crowd-pulse-sound | the peak |
| scale | salarioaleto | the fair point |
