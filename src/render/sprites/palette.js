// The one place colours live. Sprites, tints and plot accents all read from here, so a new
// season or theme is a palette swap rather than a code change.

export const TILE_PX = 16

/** A plot's lawn: fresh (the default), deep and golden. A repo's style picks one. */
const YARD_TONES = [
  ['#86c264', '#7dba5c', '#90ca6d'],
  ['#7cbe6c', '#73b564', '#88c878'],
  ['#9cc463', '#93bb5b', '#a7cc6e'],
]
/** Each lawn's greens in a sunny patch and a lush one, one for one; see src/render/ground.js. */
const YARD_SUNNY = [
  ['#92c860', '#89c058', '#9cd069'],
  ['#88c468', '#7fbb60', '#94ce74'],
  ['#a8ca5f', '#9fc157', '#b3d26a'],
]
const YARD_LUSH = [
  ['#78b662', '#6fae5a', '#82be6b'],
  ['#6eb26a', '#65a962', '#7abc76'],
  ['#8eb861', '#85af59', '#99c06c'],
]

export const PALETTE = {
  outline: '#2a2233',
  eye: '#221c2b',
  blush: '#f09a92',
  shoe: '#4a3428',
  shoes: ['#4a3428', '#2b2730', '#9a6f45'], // brown, black, tan
  skin: ['#f6d2b0', '#e2aa7c', '#b97a4f', '#7d4f33'],
  // The first five of each are the originals; the rest came later (see lookFor).
  hair: ['#3a2618', '#7a4424', '#d19b47', '#e8e0d0', '#b8433f', '#231c1f', '#d0763a', '#8a6fc0'],
  cloth: ['#4f7fbf', '#c3524a', '#5a9c52', '#d7b440', '#8a5cb4', '#dd7d45', '#3fa7a0', '#e07aa0', '#ece6d6', '#5b5f6b'],
  pants: ['#3f4a6b', '#5b4636', '#4b5a3c', '#8a7a62', '#2f3340'],
  hat: '#e6c36d',
  hatBand: '#b3453b',
  metal: '#a8aeb8',
  metalDark: '#6b7079',

  wood: '#9a6a3e',
  woodDark: '#6b4527',
  woodLight: '#bf8a55',
  plaster: '#efe3c8',
  plasterShade: '#d8c8a6',
  stone: '#a7a39c',
  stoneDark: '#7c7872',
  stoneLight: '#c8c4bb',
  thatch: '#d4ac52',
  thatchDark: '#a07a30',
  // Red, blue, green, brown, slate grey, terracotta, teal, plum. A plot's houses share a family
  // of three of them (ROOF_FAMILIES in buildings.js).
  roof: ['#c0503f', '#5d73a8', '#6f9450', '#8c6848', '#6a6570', '#c9773f', '#4f8a86', '#8a4d6b'],
  brick: '#b35a42',
  brickDark: '#8e4330',
  mortar: '#d6c2a2',
  slate: '#5d6574',
  glass: '#a8d8e0',
  glassLight: '#e0f4f6',
  barnGreen: '#6d8a5e',
  window: '#3d4e72',
  windowShine: '#8fa4c9',
  windowLit: '#ffd873',
  windowLitCore: '#fff4c2',
  door: '#7a4b2a',
  dirt: '#9b7652',
  dirtDark: '#7a5a3c',
  soil: '#6e4e34',
  crop: '#7cc050',
  cropDark: '#4f8f36',
  white: '#fbf8ef',

  grass: ['#78b857', '#6daf4f', '#83c262', '#62a347'],
  // The same four greens in a sunny patch and a lush one; see src/render/ground.js.
  grassSunny: ['#88c05a', '#7eb752', '#95ca68', '#70a94a'],
  grassLush: ['#68aa52', '#5ea04a', '#73b65d', '#529442'],
  yard: YARD_TONES[0],
  yardTones: YARD_TONES,
  yardSunny: YARD_SUNNY,
  yardLush: YARD_LUSH,
  path: '#d4b483',
  pathDark: '#b4925f',
  pathLight: '#e2c697',
  plaza: '#c9c2b4',
  plazaDark: '#a39c8f',
  plazaLight: '#ddd7cb',
  fence: '#c49a64',
  fenceDark: '#8c6a40',
  leaf: '#4f9a45',
  leafDark: '#357a33',
  leafLight: '#72b85d',
  pine: '#2f7050',
  pineDark: '#1f5139',
  fruit: '#e0503f',
  trunk: '#6f4a2d',
  flower: ['#f06a92', '#f5d94e', '#ffffff', '#9a7cf0', '#ff9f43', '#7fc8f0'],
  pebble: '#b8b2a6',
  trail: '#c4a06c', // earth worn bare by feet: softer and darker than the road
  trailDark: '#a88556',
  trailLight: '#d3b280',
  birch: '#ece6d6',
  birchMark: '#4a4545',
  birchLeaf: '#a3cf5c',
  birchLeafDark: '#7fb046',
  autumn: ['#e8913a', '#c7612c', '#f4b84c'], // leaf, shade, highlight
  willow: '#7cad49',
  willowDark: '#5a8a36',
  willowLight: '#9dc764',
  moss: '#6f9a3e',
  mushroom: ['#d9463b', '#b07a4a'], // a red cap, a brown one
  reed: '#7a9a3e',
  reedHead: '#6e4a2c',
  berry: '#5b6fd6',
  lampGlow: '#ffc86e', // the warm pool a lit window or lamp throws at night
  water: '#5a93cf',
  waterDeep: '#4677b4', // along the north bank, where the ground shades the pond
  waterLight: '#8cbde8', // ripples and shallows
  waterGlint: '#e8f5ff',
  shore: '#9a8659', // wet mud at the water's edge
  lily: '#5aa04a',
  lilyDark: '#3d7b36',

  bed: '#8b6445',
  bedDark: '#74523a',
  bedHole: '#5e412c',
  bedEdge: '#a57a4e',
  pollen: '#f7d64a',
  petalWhite: '#f7f5ee',
  glitter: '#fff3b0',
  paper: '#f6f0dc',
  pin: '#d9443a',
  seed: '#6b4426',
  cactus: '#5f9a4c',

  shadow: '#18122047', // 28% alpha
  interior: '#3a2a24',
  // Wear and tear (see weathering.js): what paint fades towards as a building ages, and the
  // grime that stains and streaks its walls.
  dust: '#a39a88',
  grime: '#5b5342',
  void: '#4e8a3c', // outside the map: more countryside

  // The arrival square: its portal, the runes that wake it, and the mosaic round its foot.
  portal: '#5fd8e8',
  portalDeep: '#3d6fd6',
  portalAbyss: '#231f6e', // the far end of the vortex
  crystal: '#8fe9f5',
  crystalDark: '#3f8fb8',
  portalCore: '#e8fdff',
  rune: '#6fa9b3', // carved into stone, unlit
  runeGlow: '#a8f6ff',
  sandstone: '#d9c7a0',
  sandstoneDark: '#b8a47c',
  cobbleSlate: '#7c8494',
  cobbleSlateDark: '#5f6676',
  inlay: '#e6c257', // the gold star at the portal's foot
  blossom: '#f4a6c1', // cherry blossom
  blossomDark: '#d97a9f',
  blossomLight: '#fcd6e3',
  pigeon: '#9a9fae',
  pigeonDark: '#6c7080',
  pigeonNeck: '#6fa89a', // the green-and-purple sheen on a pigeon's neck
  bird: '#3b3645',
  smoke: '#f2eff5',
  smokeShade: '#aaa5b4', // the underside of a puff, so smoke shows against pale paths too
  cloudShadow: '#6f86a8', // multiplied over the ground, so a blue-grey shade rather than grey
  dusk: '#ff9a5a', // the warm light at sunrise and sunset, multiplied over everything

  // Drawn straight onto the canvas by the renderer rather than into a sprite.
  highlight: '#ffffff', // under a hovered flower
  glitterGlow: '#ffe278', // the pulse under an open PR's bud
  labelInk: '#1c1624', // the halo round a plot's name

  // ---------- the construction theme (src/render/themes/construction/) ----------
  // Work gear. Hard hats are yellow for most, then white, orange, blue and green. Hi-vis yellow is
  // a yellow-green, as the real thing is: a plain yellow vest read as a T-shirt.
  hardHat: ['#f4c20d', '#f2efe6', '#f07a1f', '#3f78c8', '#4fa14a'],
  hiVis: ['#d6ee2c', '#f4781c'], // yellow, orange
  reflective: '#e4eaee', // the silver bands round a vest
  // Site buildings and machines (construction/buildings.js).
  // Machine paint: yellow, amber, orange, burnt orange, red, maroon, blue, navy, sky blue. A plot's
  // machines, cabins and containers share a family of three (PAINT_FAMILIES there).
  sitePaint: ['#f2b62a', '#d9921c', '#ea7428', '#c4581f', '#cc4136', '#96302e', '#3b72bf', '#2b4d8a', '#6d9fd8'],
  cladWhite: '#dfe2dc', // a site cabin's white: greyer than paint, so it reads as sheet steel
  concrete: '#bab7ae',
  concreteDark: '#8f8c84',
  concreteLight: '#d6d3ca',
  steel: '#6f7c8c', // structural steel: bluer than the village's metal, so beams read as beams
  steelDark: '#4a5462',
  steelLight: '#9eabba',
  osb: '#d9ae66', // oriented strand board, the sheathing on a timber frame
  osbFleck: '#b3843f',
  houseWrap: '#eef0f1',
  wrapPrint: '#5f8fcc', // the maker's name printed along house-wrap
  rebar: '#8a4e2f',
  rust: '#a5552e',
  rustDark: '#7b3d21',
  tarp: '#3d7cc9',
  rubber: '#3c3b42', // tracks and tyres: a grey dark enough to be rubber, lighter than the outline
  // Site ground, roads and fences (construction/ground.js).
  // A plot's ground by its yard tone: gravel, dirt, sand, a poured slab. Each is its base, shade,
  // light and deepest colour; then the same in a dry patch and a damp one, one for one (see
  // src/render/ground.js). Only the ground is drawn in these, or the patches would recolour it too.
  siteGround: [
    ['#a9a397', '#8f897d', '#c2bcb0', '#76716a'],
    ['#a57a52', '#8c6443', '#b98f66', '#735037'],
    ['#dcc38c', '#c9ad76', '#e9d5a4', '#b39460'],
    ['#b8b7b0', '#a6a59e', '#c9c8c1', '#8e8d87'],
  ],
  siteGroundSunny: [
    ['#b0aca2', '#969288', '#c9c5bb', '#7f7a73'],
    ['#a98560', '#936f4e', '#ba9a77', '#7b5a41'],
    ['#dcca9e', '#cab587', '#e9dbb6', '#b49d71'],
    ['#c0bfba', '#aeada8', '#d1d0cb', '#969691'],
  ],
  siteGroundLush: [
    ['#a09889', '#857d71', '#b9b1a2', '#6a655f'],
    ['#996d47', '#805738', '#b68152', '#66432d'],
    ['#dbb976', '#c7a261', '#e9cc8d', '#af884d'],
    ['#aeaca3', '#9b9a92', '#bfbdb4', '#83827b'],
  ],
  asphalt: '#56585d',
  asphaltLight: '#6a6c71', // the aggregate showing through
  asphaltDark: '#48494e',
  tarSeal: '#313135', // a crack or a patch's seam, sealed with tar
  kerb: '#b1afa7',
  roadPaint: '#c7c3b4', // a white line, faded
  // Scaffold boards laid for a walkway: paler than the village's timber, and darker and redder
  // than building sand, or a walkway across sand all but vanished.
  plank: '#c2995c',
  plankDark: '#936c3e',
  plankLight: '#d8b476',
  heras: '#cfd5da', // galvanised tube
  herasDark: '#8d959d',
  hoarding: '#3f6fb4',
  hoardingDark: '#2d538c',
  hoardingLight: '#5a88c8',
  barrierRed: '#d8433a',
  barrierRedDark: '#a5302a',
  barrierRedLight: '#ee6d60',
  safetyOrange: '#f36b1c',
  safetyOrangeDark: '#c24e14',
  puddle: '#6f8ba3',
  puddleLight: '#a6bfd2', // the sky in it
  hose: '#e0b22e',
  hoseDark: '#b3861c',
  pipe: '#c8683a', // plastic drainage pipe
  pipeDark: '#9a4a26',
  pipeLight: '#e39264', // the shine along its top
  sack: '#d8cdb4',
  sackDark: '#b0a488',

  // ---------- the elvish theme (src/render/themes/elvish/) ----------
  // Elf-silver, for circlets, filigree railings and a lantern's frame. Not the village's `metal`,
  // a grey tool-steel: mithril has to read as bright work against pale stone and pale bark.
  mithril: '#d6dde6',
  mithrilDark: '#97a2b0',
  mithrilLight: '#f0f5fa',
  // Travelling cloaks: greenleaf and twilight, the two an elvish villager wears over its shirt.
  elfCloak: ['#5c7a63', '#67699c'],
  // Elvish buildings (elvish/buildings.js).
  // Living wood: a tree still growing, so warmer and greener than the village's felled `wood`.
  livewood: '#8a6a4a',
  livewoodDark: '#5a4330',
  livewoodLight: '#ad8a62',
  barkMoss: '#6d8a58', // the green in the bark's furrows
  // Carved white stone. Paler than the village's plaster, which read as a rendered cottage wall.
  paleStone: '#e4e1d5',
  paleStoneDark: '#b7b3a4',
  paleStoneLight: '#f5f3ec',
  carving: '#9ba49f', // the shadow inside a carved line, cool against the stone's warm white
  // Woven leaf-and-withy panels, the fifth wall material.
  weave: '#9ab86a',
  weaveDark: '#6e8c46',
  weaveLight: '#bdd68d',
  vine: '#4e7a3e', // the cord an elf makes of a living creeper: darker than a leaf, and woodier
  vineLight: '#79a85a',
  // Roofs and paint: leaf green, moonlit silver-blue, mallorn gold, twilight violet, then deep
  // green, pale silver, amber and dusk rose. A plot's buildings share a family of three.
  elfRoof: ['#4f8f52', '#6f8fc0', '#d9ae4a', '#8a6aa8', '#37684a', '#aebdd4', '#bf8434', '#c08298'],
  lanternGlow: '#ffeab0', // the light inside a lantern's glass, warmer than a lit window's
  // Elvish ground, ways and fences (elvish/ground.js).
  // A plot's ground by its yard tone: a flowering glade, deep moss, leaf loam, pale river sand.
  // Each is its base, shade, light and deepest; then the same dry and damp, one for one (see
  // src/render/ground.js). Only the ground is drawn in these, or the patches would recolour it.
  elfGround: [
    ['#7fb85c', '#6ca84b', '#95c972', '#5a8e42'],
    ['#5f9061', '#4e7d53', '#78a578', '#3d6544'],
    ['#b8935d', '#9f7b49', '#d0ac73', '#7e5f39'],
    ['#d9d7c9', '#c1beae', '#ebe9de', '#a29f90'],
  ],
  elfGroundSunny: [
    ['#8dc25f', '#7ab24e', '#a3d375', '#679845'],
    ['#6e9a60', '#5d8752', '#87af77', '#4c6f43'],
    ['#c4a067', '#ab8853', '#dcb97d', '#8a6c43'],
    ['#e2dfce', '#cac6b3', '#f2f0e3', '#aba795'],
  ],
  elfGroundLush: [
    ['#6fab58', '#5c9b47', '#85bc6e', '#4a813e'],
    ['#4f8563', '#3e7255', '#689a7a', '#2d5a46'],
    ['#a5875a', '#8c6f46', '#bda070', '#6b5336'],
    ['#c8c9c2', '#b0b0a7', '#dadbd7', '#919189'],
  ],
  // The paved way round a plot: pale stones fitted close, moss in the seams.
  wayStone: '#c8c4b6',
  wayStoneDark: '#a29e90',
  wayStoneLight: '#dedbd0',
  waySeam: '#8a8678',
  wayMoss: '#7f9a5e',
  // Stepping stones, for the footpaths inside a plot: cooler and lighter than the way's, so a
  // path reads as its own thing where it leaves the road.
  stepStone: '#cfd3cb',
  stepStoneDark: '#a3a79f',
  stepStoneLight: '#e7eae3',
  // Fences: a woven withy hurdle, a briar in flower, filigree, and low runestones.
  withy: '#c6a06a',
  withyDark: '#96754a',
  withyLight: '#dcbb87',
  briarThorn: '#7b5a3c',
  briarBloom: '#f2d3e0',
  runestone: '#9aa0a4',
  runestoneDark: '#70767b',
  runestoneLight: '#c2c7cb',
  // What lies about under the trees.
  fern: '#5d9a4a',
  fernDark: '#3f7334',
  glowCap: '#8fd8e8', // toadstools that glow faintly blue, even by day
  glowCapStem: '#e4ecd8',
  petalFall: '#f3d7e2',
  petalFallDark: '#d4a9be',
  shard: '#9fe0ea', // a splinter of the crystal the halls are glazed with
  shardDark: '#5fa3b8',
  acorn: '#a9743f',

  // ---------- landmarks (src/render/sprites/landmarks.js) ----------
  // A campfire's flame, outside in to its white-hot heart, and the embers left when nobody is in.
  flame: '#f0662a',
  flameTip: '#ffa53a',
  flameCore: '#ffe07a',
  ember: '#b8402a',
  ash: '#8a8078',
  gilt: '#e9bb3f', // finials, weathervanes, a clock's hands and a bell
  giltDark: '#b58a24',
}

/** One per plot, picked by a hash of its name with collisions stepped past. */
export const ACCENTS = [
  '#e0584f', '#f09a3a', '#e8c93a', '#7bc34f', '#3fb59c',
  '#46a6e0', '#5f79e6', '#9b6ce0', '#dd6bb8', '#a8845a',
]

export const BADGE = {
  waiting: '#ffc93c',
  blocked: '#ef4f4f',
  working: '#5cc4f2',
  done: '#4fcf6f', // finished, ready for review
  party: '#f7b733', // a merged PR
}

/**
 * Petal colours. A flower's colour is a hash of its id into this list. White is deliberately
 * missing: a white flower always means a PR nobody labelled.
 */
export const PETALS = [
  '#f06a92', '#f5d94e', '#9a7cf0', '#ef5a4a', '#ff9f43', '#5cc4f2',
  '#e87fd4', '#c93f6b', '#ffd1dc', '#7ad0b0', '#b8e05a', '#6f7cf0', '#ffb3a0',
]

export const CONFETTI = ['#ef4f4f', '#ffc93c', '#6fdb8a', '#5cc4f2', '#b27cf0', '#ff8fc8']

/** Butterfly wings: brimstone, cabbage white, orange tip, blue, pink. */
export const BUTTERFLIES = ['#f5d94e', '#fbf8ef', '#f09a3a', '#8fd0f5', '#e87fd4']

/** Night is a multiply towards this colour; lights are then added back on top. */
// The desktop window's backdrop before the page paints; the same as `--bg` in styles.css.
export const APP_BG = '#12111a'

export const NIGHT = { r: 52, g: 60, b: 128 }

export function hexToRgb(hex) {
  const h = hex.replace('#', '')
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) }
}

/** A palette colour at some opacity, for canvas fills that fade in and out. */
export function rgba(hex, a) {
  const { r, g, b } = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${a})`
}

/** Lighten (f > 0) or darken (f < 0) a hex colour. */
export function shade(hex, f) {
  const { r, g, b } = hexToRgb(hex)
  const t = f < 0 ? 0 : 255
  const p = Math.abs(f)
  const c = (v) => Math.round((t - v) * p + v).toString(16).padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`
}
