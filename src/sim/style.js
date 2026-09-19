// A plot's personality: how its repo fences its land, the ground inside, what its houses are
// built from and the colours they share. Picked from its sub-theme's recipe (see themes.js),
// seeded by the repo's name, so a repo is recognisable at a glance and keeps its look across
// reloads. Only small numbers here; the renderer decides what they look like.
import { key } from './grid.js'
import { rngFor } from './rng.js'
import { DEFAULT_THEME, THEMES, recipeOf, subthemeFor, themeOf } from './themes.js'

// The countryside village's vocabulary, which the village's own sprites draw.
export const FENCES = THEMES.village.dims.fence
export const WALLS = THEMES.village.dims.wall
/** Lawn greens to choose from; see the palette's `yardTones`. */
export const YARD_TONES = THEMES.village.dims.yard.length
/** Families of roof colours a plot's houses share; see ROOF_FAMILIES in the building sprites. */
export const ROOF_FAMILY_COUNT = THEMES.village.dims.roofs

/** The look of a plot with no name, and of anything drawn outside one. */
export const PLAIN_STYLE = Object.freeze({ theme: DEFAULT_THEME, sub: THEMES[DEFAULT_THEME].auto[0], fence: 0, yard: 0, wall: 0, roofs: 0 })

/** The plain look in another theme: its first sub-theme, and the first of everything. */
export function plainStyle(theme) {
  const t = themeOf(theme)
  return t === DEFAULT_THEME ? PLAIN_STYLE : Object.freeze({ ...PLAIN_STYLE, theme: t, sub: THEMES[t].auto[0] })
}

/**
 * A repo's style in `theme`, as sub-theme `sub` if that is one of the theme's, else as whichever
 * one the repo is handed. Draws in the order fence, yard, wall, roofs, each from the recipe's
 * choices or all of them, so a recipe that leaves everything open (the village's patchwork)
 * picks what every repo had before there were themes.
 *
 * @returns {{ theme: string, sub: string, fence: number, yard: number, wall: number, roofs: number }}
 */
export function plotStyle(name, theme = DEFAULT_THEME, sub = null) {
  const t = themeOf(theme)
  const { dims } = THEMES[t]
  const id = subthemeFor(name, t, sub)
  const recipe = recipeOf(t, id)
  const r = rngFor(`style:${name}`)
  const from = (all, allowed) => {
    const list = allowed?.length ? allowed.map((n) => all.indexOf(n)).filter((i) => i >= 0) : all.map((_, i) => i)
    return list[Math.floor(r() * list.length)]
  }
  const fence = from(dims.fence, recipe.fence)
  const yard = from(dims.yard, recipe.yard)
  const wall = from(dims.wall, recipe.wall)
  const roofs = from(Array.from({ length: dims.roofs }, (_, i) => i), recipe.roofs)
  return { theme: t, sub: id, fence, yard, wall, roofs }
}

/** Every plot cell's style, by "cx,cy", for drawing the ground a cell at a time. */
export function cellStyles(plots) {
  const out = new Map()
  for (const p of plots) for (const [cx, cy] of p.cells) out.set(key(cx, cy), p.style)
  return out
}
