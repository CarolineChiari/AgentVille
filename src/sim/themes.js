// Themes: the look of the whole village, and the sub-themes its folders take within it.
//
// A theme is the overarching look: the countryside village, a construction site. A sub-theme is
// one folder's take on it: a farmstead or a stone hamlet in the village, new homes or roadworks
// on the site. Each theme names the vocabulary its plots are built from (`dims`: fences, ground,
// wall materials, paint), and each sub-theme is a recipe that narrows it. A plot's style is then
// drawn from its recipe, seeded by the repo's name (see style.js), so a folder keeps its look.
//
// Only names and small numbers live here, so it runs under Node and the settings can list it.
// What they look like is up to the theme's pack in src/render/themes/.
import { HATS, TOPS } from './villager.js'
import { FLOWER_KINDS } from './flowers.js'
import { pick, rngFor } from './rng.js'

/** Theme and sub-theme ids are saved in village.json and settings, so they're checked before they're trusted. */
export const THEME_ID = /^[a-z][a-z0-9-]{0,31}$/

export const DEFAULT_THEME = 'village'

/**
 * @typedef {object} Subtheme
 * @property {string} id
 * @property {string} label
 * @property {string} blurb        one line for the picker's tooltip
 * @property {string[]} [fence]    names from its theme's dims; left out, any of them
 * @property {string[]} [yard]
 * @property {string[]} [wall]
 * @property {number[]} [roofs]    paint families, by index
 * @property {{ vest?: number }} [outfit]  overrides the theme's outfit for this sub-theme's villagers
 *
 * @typedef {object} Theme
 * @property {string} label
 * @property {{ fence: string[], yard: string[], wall: string[], roofs: number }} dims
 *           What a plot is made of. The renderer's pack draws each name; `roofs` is how many
 *           families of roof (or paint) colours it has.
 * @property {Subtheme[]} subthemes
 * @property {string[]} auto  the sub-themes a folder is given when nobody has picked one. Adding one
 *           reshuffles which folder gets which, so add sub-themes to it sparingly.
 * @property {{ hat?: string, top?: string }} [outfit]  what every villager wears to work here, by
 *           name from HATS and TOPS in villager.js
 * @property {Finished} finished  what finished work is called here
 *
 * @typedef {object} Finished  The words for finished work, which the village calls flowers. A
 *           theme may draw it as something else (its pack draws `flower.*`), but it still says
 *           what the flower said: its kind is the kind of work, white is an unlabeled PR, and an
 *           open PR is a bud.
 * @property {string} one     'flower'
 * @property {string} many    'flowers'
 * @property {string} place   'garden': where they are
 * @property {string} glyph   one character that stands for one, in counts and on the card
 * @property {string} grow    the setting that turns PRs into them
 * @property {Record<string, string>} [names]  each kind of work's name for one (see WORK in
 *           flowers.js); left out, every flower keeps its own name (a daisy, a tulip)
 */

/** @type {Record<string, Theme>} */
export const THEMES = {
  village: {
    label: 'Countryside village',
    dims: {
      fence: ['rail', 'picket', 'stone', 'hedge'],
      yard: ['fresh', 'deep', 'golden'],
      wall: ['plaster', 'wood', 'stone', 'brick', 'timber'],
      roofs: 4,
    },
    subthemes: [
      // No recipe: any fence, lawn, walls and roofs. Its picks are exactly the ones every repo had
      // before there were themes, so the default village looks as it always has.
      { id: 'patchwork', label: 'Patchwork', blurb: 'A bit of everything: each repo its own mix of fences, walls and roofs' },
      { id: 'farmstead', label: 'Farmstead', blurb: 'Split-rail fences, weatherboard walls and a golden lawn', fence: ['rail'], yard: ['golden'], wall: ['wood'], roofs: [0, 2] },
      { id: 'market-town', label: 'Market town', blurb: 'White pickets, brick and plaster fronts, warm roofs', fence: ['picket'], yard: ['fresh'], wall: ['brick', 'plaster'], roofs: [0, 3] },
      { id: 'stone-hamlet', label: 'Stone hamlet', blurb: 'Dry-stone walls, stone cottages and slate-blue roofs', fence: ['stone'], yard: ['deep'], wall: ['stone'], roofs: [1] },
      { id: 'tudor-lane', label: 'Tudor lane', blurb: 'Box hedges and half-timbered houses', fence: ['hedge'], yard: ['fresh', 'deep'], wall: ['timber', 'plaster'], roofs: [3, 0] },
    ],
    auto: ['patchwork'],
    finished: { one: 'flower', many: 'flowers', place: 'garden', glyph: '✿', grow: 'Grow flowers from pull requests' },
  },
  construction: {
    label: 'Construction site',
    dims: {
      fence: ['mesh', 'hoarding', 'barrier', 'netting'],
      yard: ['gravel', 'dirt', 'sand', 'slab'],
      wall: ['timber', 'brick', 'concrete', 'steel', 'glass'],
      // Paint for the machines, cabins and containers: yellow, orange, red, blue.
      roofs: 4,
    },
    subthemes: [
      { id: 'new-homes', label: 'New homes', blurb: 'Timber frames and brick going up behind mesh fencing', fence: ['mesh', 'netting'], yard: ['dirt'], wall: ['timber', 'brick'], roofs: [0] },
      { id: 'high-rise', label: 'High-rise', blurb: 'Steel and glass on a concrete slab, cranes overhead', fence: ['hoarding'], yard: ['slab', 'gravel'], wall: ['steel', 'glass', 'concrete'], roofs: [0, 2] },
      { id: 'roadworks', label: 'Roadworks', blurb: 'Barriers, cones and fresh concrete, everybody in orange', fence: ['barrier', 'netting'], yard: ['gravel', 'sand'], wall: ['concrete'], roofs: [1], outfit: { vest: 1 } },
      { id: 'restoration', label: 'Restoration', blurb: 'Old brick wrapped in scaffolding behind painted hoarding', fence: ['hoarding', 'mesh'], yard: ['gravel', 'dirt'], wall: ['brick'], roofs: [3] },
      { id: 'industrial', label: 'Industrial park', blurb: 'Steel sheds, shipping containers and a batching plant', fence: ['mesh'], yard: ['slab', 'gravel'], wall: ['steel', 'concrete'], roofs: [3, 2] },
    ],
    auto: ['new-homes', 'high-rise', 'roadworks', 'restoration', 'industrial'],
    outfit: { hat: 'hardhat', top: 'hivis' },
    // Survey marker flags in a setting-out yard: sites really do colour-code their flags. The
    // glyph is an outline flag because the open issues' count already has the filled one.
    finished: {
      one: 'flag', many: 'flags', place: 'setting-out yard', glyph: '⚐', grow: 'Plant flags for pull requests',
      names: {
        fix: 'Pennant', feature: 'Square flag', refactor: 'Swallowtail', docs: 'Streamer', test: 'Flagging tape',
        ui: 'Split flag', infra: 'Banded flag', data: 'Chequered flag', perf: 'Arrow flag', review: 'Spot flag',
        research: 'Windsock', misc: 'Tape tie',
      },
    },
  },
}

export const THEME_IDS = Object.keys(THEMES)

/** A known theme's id: `id` itself, or the default for anything else. */
export const themeOf = (id) => (typeof id === 'string' && Object.hasOwn(THEMES, id) ? id : DEFAULT_THEME)

/** A theme's sub-theme by id, or null if it has none by that name. */
export function recipeOf(theme, sub) {
  return THEMES[themeOf(theme)].subthemes.find((s) => s.id === sub) || null
}

/**
 * The sub-theme a folder wears: the first of `choices` that is one of its theme's (its own pick,
 * then the whole village's), else one handed out by a hash of its name.
 */
export function subthemeFor(name, theme, ...choices) {
  const t = themeOf(theme)
  for (const c of choices) if (typeof c === 'string' && recipeOf(t, c)) return c
  return pick(rngFor(`subtheme:${t}:${name}`), THEMES[t].auto)
}

/** The words for finished work in a theme; see Finished. */
export const finishedWords = (theme) => THEMES[themeOf(theme)].finished

/** What one finished thread's flower (FLOWER_KINDS[kind]) is called in a theme: a daisy, a pennant. */
export function finishedName(theme, kind) {
  const k = FLOWER_KINDS[kind] || FLOWER_KINDS[0]
  return finishedWords(theme).names?.[k.work] ?? k.name
}

/**
 * Work clothes. A theme with an outfit puts every villager in it: the hat and top by name, and
 * `vest`, which of its colours, from the sub-theme or else from the villager's own shirt. Anything
 * else about the villager (face, hair, glasses) is left as it was.
 */
export function dress(look, theme, sub) {
  const t = THEMES[themeOf(theme)]
  const o = t.outfit
  if (!o) return look
  const own = recipeOf(theme, sub)?.outfit
  const out = { ...look }
  if (o.hat) out.hat = HATS.indexOf(o.hat)
  if (o.top) out.top = TOPS.indexOf(o.top)
  // Yellow mostly, orange for one in three: a crew in one colour reads as a uniform, not a site.
  out.vest = own?.vest ?? (look.shirt % 3 === 2 ? 1 : 0)
  return out
}
