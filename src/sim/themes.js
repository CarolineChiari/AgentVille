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
 * @property {Landmark} [landmark]  what stands in the middle of each plot's field, tier by tier;
 *           left out, the village's
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
 *
 * @typedef {object} Landmark  What a plot raises in its field as work lands in it (see progress.js).
 *           A theme names and draws it its own way, but a higher tier is always more work done.
 * @property {string} one      'landmark'
 * @property {string[]} tiers  one name per tier, MAX_TIER + 1 of them, smallest first
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
    landmark: { one: 'landmark', tiers: ['Campfire', 'Well', 'Market cross', 'Chapel', 'Town hall', 'Keep'] },
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
    // The site's own landmark climbs from a pegged-out plot to a topped-out tower.
    landmark: { one: 'landmark', tiers: ['Survey peg', 'Site hut', 'Scaffold tower', 'Tower crane', 'Concrete core', 'Topped out'] },
  },
  elvish: {
    label: 'Elvish realm',
    dims: {
      fence: ['woven', 'briar', 'filigree', 'standing'],
      yard: ['glade', 'moss', 'loam', 'silversand'],
      wall: ['livewood', 'birch', 'palestone', 'weave', 'crystal'],
      // Leaf green, moonlit silver, mallorn gold, twilight violet.
      roofs: 4,
    },
    subthemes: [
      { id: 'greenwood', label: 'Greenwood', blurb: 'Homes grown into living trees under woven leaf canopies', fence: ['woven', 'briar'], yard: ['moss', 'glade'], wall: ['livewood', 'weave'], roofs: [0] },
      { id: 'silverwood', label: 'Silver wood', blurb: 'Birch and white stone under moonlit silver roofs', fence: ['filigree', 'woven'], yard: ['glade', 'silversand'], wall: ['birch', 'palestone'], roofs: [1] },
      { id: 'riverhall', label: 'River hall', blurb: 'Carved white halls and crystal glazing beside the water', fence: ['filigree', 'standing'], yard: ['silversand', 'glade'], wall: ['palestone', 'crystal'], roofs: [1, 3] },
      { id: 'goldenbough', label: 'Golden bough', blurb: 'Mallorn gold and deep leaf loam, everything lantern-warm', fence: ['briar', 'woven'], yard: ['loam', 'glade'], wall: ['livewood', 'birch'], roofs: [2] },
      { id: 'thornhold', label: 'Thorn hold', blurb: 'Briars, runestones and twilight violet over deep moss', fence: ['briar', 'standing'], yard: ['moss', 'loam'], wall: ['livewood', 'palestone'], roofs: [3, 0], outfit: { vest: 1 } },
    ],
    auto: ['greenwood', 'silverwood', 'riverhall', 'goldenbough', 'thornhold'],
    outfit: { hat: 'circlet', top: 'cloak' },
    // Finished work is a lantern lit on its stand in the lantern grove. Elves hang lights for
    // what is done; the glyph is a four-pointed star, the nearest a light gets that isn't already
    // the village's bloom or the open issues' flag.
    finished: {
      one: 'lantern', many: 'lanterns', place: 'lantern grove', glyph: '\u2726', grow: 'Light lanterns for pull requests',
      names: {
        fix: 'Teardrop lamp', feature: 'Star lantern', refactor: 'Leaf lantern', docs: 'Scroll lamp', test: 'Wisp',
        ui: 'Blossom lantern', infra: 'Forge lamp', data: 'Rune lantern', perf: 'Comet lamp', review: 'Watch lamp',
        research: 'Seeker\u2019s lamp', misc: 'Ember',
      },
    },
    // What a plot's work raises in its grove: toadstools come up in a ring, then a moonstone, a
    // shrine with a star hung in it, a silver tree, a hall under a crystal dome, a white tower.
    landmark: { one: 'landmark', tiers: ['Fairy ring', 'Moonstone', 'Star shrine', 'Silver tree', 'Crystal hall', 'Starwatch'] },
  },
  halloween: {
    label: 'Halloween night',
    dims: {
      fence: ['crooked', 'ironwork', 'cornstalk', 'lights'],
      yard: ['frost', 'mulch', 'mist', 'flagstone'],
      wall: ['clapboard', 'graystone', 'sootbrick', 'daub', 'scallop'],
      // Pumpkin orange, witch's purple, poison green, bone, blood red, midnight blue, candy pink
      // and moon yellow, in five families of three (ROOF_FAMILIES in the pack's buildings).
      roofs: 5,
    },
    subthemes: [
      { id: 'pumpkin-patch', label: 'Pumpkin patch', blurb: 'Corn stooks, straw and leaf mould, and pumpkins everywhere', fence: ['cornstalk', 'crooked'], yard: ['mulch'], wall: ['clapboard', 'daub'], roofs: [0] },
      { id: 'haunted-manor', label: 'Haunted manor', blurb: 'Tall shingled houses behind iron railings, boarded windows lit green', fence: ['ironwork'], yard: ['flagstone', 'mist'], wall: ['scallop', 'clapboard'], roofs: [1] },
      { id: 'graveyard', label: 'Graveyard', blurb: 'Grey stone and wrought iron, headstones and fog in the hollows', fence: ['ironwork', 'crooked'], yard: ['mist'], wall: ['graystone'], roofs: [2] },
      { id: 'witchs-hollow', label: "Witch's hollow", blurb: 'Crooked daubed cottages, cauldrons on the boil and toadstools', fence: ['crooked', 'cornstalk'], yard: ['mulch', 'mist'], wall: ['daub', 'graystone'], roofs: [4], outfit: { vest: 0 } },
      { id: 'trick-or-treat', label: 'Trick-or-treat lane', blurb: 'Cheerful brick fronts, paper bats and a string of orange lights', fence: ['lights'], yard: ['frost'], wall: ['sootbrick', 'scallop'], roofs: [3, 0], outfit: { vest: 1 } },
    ],
    auto: ['pumpkin-patch', 'haunted-manor', 'graveyard', 'witchs-hollow', 'trick-or-treat'],
    outfit: { hat: 'witchhat', top: 'cape' },
    // Finished work is a jack-o'-lantern carved and lit in the plot's pumpkin patch. What was
    // carved into it says what kind of work it was; an open PR's pumpkin is grown but not yet
    // cut. The glyph is a grinning face, which is what a jack-o'-lantern is; the flower's bloom
    // and the open issues' flag are both already taken.
    finished: {
      one: "jack-o'-lantern", many: "jack-o'-lanterns", place: 'pumpkin patch', glyph: '☻', grow: "Carve lanterns for pull requests",
      names: {
        fix: 'Grinning lantern', feature: 'Star-eyed lantern', refactor: 'Curl-carved lantern', docs: 'Scroll lantern',
        test: 'Little gourd', ui: 'Filigree lantern', infra: 'Iron-hooped lantern', data: 'Grid-carved lantern',
        perf: 'Comet lantern', review: 'Wide-eyed lantern', research: 'Owl lantern', misc: 'Turnip lantern',
      },
    },
    // What a plot's work raises on Halloween night: a heap of pumpkins, then a scarecrow, a
    // roofed gate, the old oak, a witch's tower, and a belfry with bats pouring out of it.
    landmark: { one: 'landmark', tiers: ['Lantern heap', 'Scarecrow', 'Lych-gate', 'Gnarled oak', "Witch's tower", 'Belfry'] },
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
 * A look: one sub-theme of one theme, `{ theme, sub }`, which is what a folder picks for itself.
 * True only for a look that exists, so a saved pick naming a theme that went away is ignored.
 */
export function isLook(l) {
  return Boolean(l && typeof l === 'object' && typeof l.theme === 'string' && Object.hasOwn(THEMES, l.theme) && recipeOf(l.theme, l.sub))
}

/**
 * The sub-theme a folder wears within `theme`: the first of `choices` that is one of its
 * sub-themes (the whole village's pick), else one handed out by a hash of its name.
 */
export function subthemeFor(name, theme, ...choices) {
  const t = themeOf(theme)
  for (const c of choices) if (typeof c === 'string' && recipeOf(t, c)) return c
  return pick(rngFor(`subtheme:${t}:${name}`), THEMES[t].auto)
}

/** The words for finished work in a theme; see Finished. */
export const finishedWords = (theme) => THEMES[themeOf(theme)].finished

/** What a theme calls its plots' landmarks, tier by tier: the village's words if it has none of its own. */
export const landmarkWords = (theme) => THEMES[themeOf(theme)].landmark ?? THEMES[DEFAULT_THEME].landmark

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
  // The theme's first colour mostly, its second for one in three: everyone in one colour reads
  // as a uniform rather than a crew. A sub-theme that names one puts its whole plot in it.
  out.vest = own?.vest ?? (look.shirt % 3 === 2 ? 1 : 0)
  return out
}
