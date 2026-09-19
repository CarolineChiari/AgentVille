# Themes

A **theme** is the whole village's look. A **sub-theme** is one folder's take on it: each plot
wears one, so the repos in a village tell each other apart without leaving the theme.

- **Settings → Theme** dresses the whole village.
- **Settings → Every folder** puts every folder in one sub-theme instead of a spread.
- **Look**, in a folder's panel, gives that folder any theme's sub-theme and keeps it whatever the
  village becomes — so a roadworks site can stand in a countryside village.
- `?demo&theme=<id>` (and `&sub=<sub-theme>`) shows a theme over the demo village without saving
  anything.

Whatever a village wears, what things **mean** is the same: status badges, the selection ring, lit
windows and chimney smoke. Finished work may be drawn as something other than a flower, but it
still shows the kind of work, white for an unlabeled PR, and a bud for an open one.

---

## Countryside village · `village`

The village it has always been: lanes, hedges, cottages and a flower per finished thread in each
plot's garden.

![Five plots side by side in the countryside village: patchwork, a farmstead of split-rail fences and weatherboard, a market town of white pickets and brick, a stone hamlet with dry-stone walls, and a Tudor lane of box hedges and half-timbered houses](village.png)

| Sub-theme | `id` | |
| --- | --- | --- |
| Patchwork | `patchwork` | A bit of everything: each repo its own mix of fences, walls and roofs |
| Farmstead | `farmstead` | Split-rail fences, weatherboard walls and a golden lawn |
| Market town | `market-town` | White pickets, brick and plaster fronts, warm roofs |
| Stone hamlet | `stone-hamlet` | Dry-stone walls, stone cottages and slate-blue roofs |
| Tudor lane | `tudor-lane` | Box hedges and half-timbered houses |

**Built from** — fences: rail, picket, stone, hedge · lawns: fresh, deep, golden · walls: plaster,
wood, stone, brick, timber · four families of roof colour.
**Finished work**: a **flower** in the **garden** (✿). **Work clothes**: their own.
**Handed out**: every folder gets Patchwork unless it picks otherwise, so a village nobody has
touched looks as it always has.

---

## Construction site · `construction`

Every plot fenced off and every session's building going up: a timber frame, a tower crane, a site
office, a digger in its pit.

![Five plots side by side on a construction site: new homes on churned dirt behind mesh fencing, a high-rise of steel and glass on a poured slab behind blue hoarding, roadworks behind orange netting, a restoration of old brick behind hoarding, and an industrial park with a tower crane and a batching plant](construction.png)

| Sub-theme | `id` | |
| --- | --- | --- |
| New homes | `new-homes` | Timber frames and brick going up behind mesh fencing |
| High-rise | `high-rise` | Steel and glass on a concrete slab, cranes overhead |
| Roadworks | `roadworks` | Barriers, cones and fresh concrete, everybody in orange |
| Restoration | `restoration` | Old brick wrapped in scaffolding behind painted hoarding |
| Industrial park | `industrial` | Steel sheds, shipping containers and a batching plant |

**Built from** — fences: mesh, hoarding, barrier, netting · ground: gravel, dirt, sand, slab ·
walls: timber, brick, concrete, steel, glass · four families of machine paint.
**Finished work**: a **survey flag** in the **setting-out yard** (⚐) — a pennant for a bug fix, a
chequered flag for data, a windsock for research. **Work clothes**: a hard hat and hi-vis.

![The demo village as a construction site](../screenshots/construction.png)

---

## Elvish realm · `elvish`

A wood the elves keep: homes grown into living trees and carved from white stone under swept
roofs, ways paved in pale flagstones, lanterns lit for whatever is done.

![Five plots side by side in an elvish realm: a greenwood of living timber on a flowering glade, a silver wood of birch and white stone on pale river sand behind mithril railings, a river hall of carved stone behind runestones, a golden bough on deep leaf loam, and a thorn hold of runestones over moss](elvish.png)

| Sub-theme | `id` | |
| --- | --- | --- |
| Greenwood | `greenwood` | Homes grown into living trees under woven leaf canopies |
| Silver wood | `silverwood` | Birch and white stone under moonlit silver roofs |
| River hall | `riverhall` | Carved white halls and crystal glazing beside the water |
| Golden bough | `goldenbough` | Mallorn gold and deep leaf loam, everything lantern-warm |
| Thorn hold | `thornhold` | Briars, runestones and twilight violet over deep moss |

**Built from** — fences: woven withy, briar, mithril filigree, runestones · ground: glade, moss,
leaf loam, river sand · walls: livewood, birch, pale stone, woven leaf, crystal · four families of
roof colour.
**Finished work**: a **lantern** lit on its stand in the **lantern grove** (✦) — a teardrop lamp
for a bug fix, a rune lantern for data, a wisp for tests, a seeker's lamp for research.
**Work clothes**: a mithril circlet and a travelling cloak.

![The demo village as an elvish realm](../screenshots/elvish.png)

---

## Making one

Follow the `new-theme` skill in [`.claude/skills/new-theme/`](../../.claude/skills/new-theme/SKILL.md).
A theme is two things: its names and recipes in [`src/sim/themes.js`](../../src/sim/themes.js),
which run under Node, and its pack in [`src/render/themes/<id>/`](../../src/render/themes), which
decides what they look like. A pack draws only what makes the theme itself; whatever it passes on
is drawn the village's way, so plots of different themes stand side by side.
`test/theme-packs.test.mjs` holds every registered theme to the rules the renderer relies on, as
soon as it is registered.

## The pictures here

The plot strips are contact sheets, not screenshots: no real village, repo or path is in them.

```
npm run sheet -- <id> --only plots --scale 2 --out docs/themes/<id>.png
```

The full-window shots come from the demo village through `npm run shots`; see
[`docs/screenshots/`](../screenshots).
