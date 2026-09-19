---
name: new-theme
description: Build a new AgentVille theme, a whole-village look whose folders each wear a sub-theme within it (a holiday, a season, a place, a genre). Covers defining it in src/sim/themes.js, drawing its pack in src/render/themes/<id>/, previewing with `npm run sheet` and `?demo&theme=`, and testing it. Use when asked to add, draw, finish or extend a theme or a sub-theme, including the theme issues on GitHub.
---

# Making a theme

A **theme** is the whole village's look (Settings → Theme). A **sub-theme** is one folder's take
on it: each plot wears one, handed out by the repo's name. A folder can also pick any theme's
sub-theme as its own look (mix and match), so the new theme's plots will stand beside plots of
every other theme, and inside villages of every other theme. The
construction theme is the worked example: `src/sim/themes.js` (its entry in `THEMES`) and
`src/render/themes/construction/` (its pack). Read both before starting, and read CLAUDE.md's
Themes section: its rules are not optional.

## 1. Decide what it is

Write down, before any code:

- **The idea in one line**, and what makes it read at a glance at 1× zoom from a distance: the two
  or three things someone would name first (a construction site: fencing, cranes, hard hats).
- **Four to six sub-themes** that are all clearly the theme but tell folders apart: different
  materials, colour families, props or moods. Each gets an id, a label and a one-line blurb.
- **Its vocabulary (`dims`)**: the fences, grounds (`yard`), wall materials and paint families
  (`roofs`, a count) its plots are built from. Each sub-theme's recipe narrows these lists.
- **What it redraws.** A pack draws only what makes the theme itself; everything else stays the
  village's. Typical, in order of payoff: buildings, villager outfits, finished work, fences,
  plot ground and roads, footpaths, what lies about on the ground, and only then trees, the
  countryside or the square. Scope it: a theme that redraws four things well beats one that
  redraws ten badly.
- **Finished work.** The village grows a flower per finished thread in each plot's garden. Ask
  whether flowers fit: on a construction site they didn't, and became survey flags in a
  setting-out yard. Whatever it becomes (pumpkins, lanterns, crystals) must keep what a flower
  says: one look per kind of work (`work` in FLOWER_KINDS), the cloth or petal colour it's given,
  white for an unlabeled PR, a bud for an open PR, and a sprout. Name it in `finished` (see step 2).
- **Its landmark.** Every plot raises one in its field as work lands in it, six
  tiers from small to grand (the village: a campfire to a keep; the site: a survey peg to a
  topped-out tower), and each tier brings a lamp, a bench, planters, a gateway, another lamp to
  its fence line. A theme may draw its own or leave the village's standing. If it draws them,
  it names the tiers in `landmark` (see step 2), and a higher tier must always look like more.
- **What it must not touch**: what things mean. Status badges and rings, lit windows and chimney
  smoke keep their meaning in every theme. A theme may restyle a sprite; it may not change what
  the sprite tells the person.

For a holiday or a culture, depict it the way the people who celebrate it would recognise:
research its real symbols, colours and customs, prefer celebration over caricature, and keep
religious symbols respectful (on the buildings, not on the villagers' bodies as costume). When
unsure about a symbol, leave it out and say so in the pull request or issue.

## 2. Define it (pure, tested)

In `src/sim/themes.js` add an entry to `THEMES` (append; never reorder): `label`, `dims`,
`subthemes` (append-only, each `{ id, label, blurb, fence?, yard?, wall?, roofs?, outfit? }`, names
from `dims`), `auto` (the sub-themes folders are handed; changing it reshuffles folders), an
optional `outfit` naming a hat and a top, and `finished`: what finished work is called (`one`,
`many`, `place`, a one-character `glyph` that isn't the issues' ⚑, the `grow` setting's label,
and optional `names` per kind of work), and optionally `landmark`: `one` and six `tiers` names,
smallest first. The sidebar, cards and settings use these words. New
hats or tops go at the end of `HATS` / `TOPS` in `src/sim/villager.js` and get drawn in
`src/render/sprites/villagers.js`; nobody picks them for themselves (`EVERYDAY_HATS`). Ids match
`THEME_ID`.

Run `node --test test/themes.test.mjs`. It checks ids, recipes and that every sub-theme's
choices turn up.

## 3. Colours

Add a block to `src/render/sprites/palette.js`, headed like the construction block, with every
colour the theme needs, named uniquely. No hex or rgb anywhere else under `src/` (a test fails).
Plot ground colours (`patches`) must be unique to the ground: the tint pass repaints every pixel
that exactly matches one. Keep outlines `P.outline` and light from the top left.

## 4. Draw its pack

Create `src/render/themes/<id>/index.js` exporting a `ThemePack` (see the typedef in
`src/render/themes/index.js`) and register it in `PACKS` there. Copy the construction pack's shape:
an `index.js` dispatcher, and one file per area (`buildings.js`, `ground.js`, …). `sprite(name,
frame, p)` returns a PixelCanvas for the names it draws and `null` for the rest. The village's
own generators (`src/render/sprites/`) are the reference for every sprite's size, anchor and
params; the registry's header lists the names.

The rules the renderer relies on (all tested in `test/theme-packs.test.mjs`):

- Buildings: 32 px wide, `heightOf()` tall, standing on their bottom rows. Down a courtyard's sides
  (`fitted(kind, variant, false)`) 48 px tall and nothing above row 9, at every stage and wear.
  Stages 0–1 a site, 2 walls without roof plus scaffolding, 3 finished and weathered by `wear`
  exactly as the village's `drawBuilding` does. `fitted` maps every kind in `src/sim/building.js`.
- Fences: a straight run meets the next tile edge to edge; every one of the 16 masks draws.
- Ground, footpath and road tiles: 16×16, fully opaque, each variant its own picture; a
  footpath's arms are 8 px wide (4..11) so they meet; fringes leave a footpath's mouth open.
- Cover (things lying on the ground): pure and deterministic, sparse, and named unlike any of the
  village's decorations, since the pack sees every `deco.*` request.
- Chimney smoke starts on the building; animated buildings differ between frames.
- Mixed villages: a pack draws only its own plots, so it can't assume its neighbours, the
  countryside or the square are in its theme. Its road ring meets other themes' roads; check
  the join with `?demo` and a folder's Look set to it.
- Finished work (`flower.<kind>.<stage>`, params `color`): the flower's 9×13, standing on pixel
  (4, 11), each kind of work its own look, a bud unlike a bloom. Its field (`tile.bed.0` for the top
  row, `.1` below, params `tone`) is full tiles, and marks each spot on the village's 8 px grid.
- Landmarks (optional; `landmark.<tier>.<stage>` with the pack's `landmark: { heightOf, shadowOf,
  frames }`): 32 px wide, `heightOf(tier)` tall, taller each tier and 72 at most, on their bottom
  rows; stages as a building's. `lit` lights windows after dark, `busy` means somebody on the plot
  is in, day or night. What a tier brings is `static.yardlamp`, `yardbench`, `yardplanter` and
  `gateway`: a pack that draws them keeps each grounded; the gateway is walked through. The
  square's own `static.*` stay the village's, so answer only those names.

## 5. Look at it, and keep looking

    npm run sheet -- <id> --only plots,buildings,landmarks --scale 3

writes `data/sheets/<id>.png` (use `--out` to put it elsewhere) and prints what each band shows:
a sample plot per sub-theme, every building at every stage, every fence join, the ground,
finished work by kind of work, villagers in every pose. Read the PNG and compare it with
`npm run sheet -- village`. Draw, look, fix, draw again; judge it at 1× as well as zoomed. Check that each sub-theme is recognisably
different from its neighbours, and that plots still read against the green countryside.

Then see it live: `npm run dev` and open `http://127.0.0.1:5274/?demo&theme=<id>` (add
`&sub=<sub-theme>` to put every folder in one). The preview is not saved. Then open `?demo`
alone and give one folder the new look from its panel, to see it mixed into the village. Look at
night too (Settings → Time of day → Set by hand).

## 6. Finish

- `npm test` passes; `test/theme-packs.test.mjs` covers the new theme automatically.
- README's Themes section mentions it in a sentence.
- If a GitHub issue asked for it, close it from the commit (`Closes #N`) and update the roadmap
  issue as the repo's workflow describes. Commit per CLAUDE.md (bump the minor version).
