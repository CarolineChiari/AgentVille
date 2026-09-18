// A plot's personality: how its repo fences its land, the green of its lawn, and what its houses
// are built from. Seeded by the repo's name, so a repo is recognisable at a glance and keeps its
// look across reloads. Only small numbers here; the renderer decides what they look like.
import { key } from './grid.js'
import { rngFor } from './rng.js'

export const FENCES = ['rail', 'picket', 'stone', 'hedge']
export const WALLS = ['plaster', 'wood', 'stone', 'brick', 'timber']
/** Lawn greens to choose from; see the palette's `yardTones`. */
export const YARD_TONES = 3
/** Families of roof colours a plot's houses share; see ROOF_FAMILIES in the building sprites. */
export const ROOF_FAMILY_COUNT = 4

/** The look of a plot with no name, and of anything drawn outside one. */
export const PLAIN_STYLE = Object.freeze({ fence: 0, yard: 0, wall: 0, roofs: 0 })

/** @returns {{ fence: number, yard: number, wall: number, roofs: number }} */
export function plotStyle(name) {
  const r = rngFor(`style:${name}`)
  return {
    fence: Math.floor(r() * FENCES.length),
    yard: Math.floor(r() * YARD_TONES),
    wall: Math.floor(r() * WALLS.length),
    roofs: Math.floor(r() * ROOF_FAMILY_COUNT),
  }
}

/** Every plot cell's style, by "cx,cy", for drawing the ground a cell at a time. */
export function cellStyles(plots) {
  const out = new Map()
  for (const p of plots) for (const [cx, cy] of p.cells) out.set(key(cx, cy), p.style)
  return out
}
