// The one place colours live. Sprites, tints and plot accents all read from here, so a new
// season or theme is a palette swap rather than a code change.

export const TILE_PX = 16

/** A plot's lawn: fresh (the default), deep and golden. A repo's style picks one. */
const YARD_TONES = [
  ['#86c264', '#7dba5c', '#90ca6d'],
  ['#7cbe6c', '#73b564', '#88c878'],
  ['#9cc463', '#93bb5b', '#a7cc6e'],
]

export const PALETTE = {
  outline: '#2a2233',
  eye: '#221c2b',
  blush: '#f09a92',
  shoe: '#4a3428',
  skin: ['#f6d2b0', '#e2aa7c', '#b97a4f', '#7d4f33'],
  hair: ['#3a2618', '#7a4424', '#d19b47', '#e8e0d0', '#b8433f'],
  cloth: ['#4f7fbf', '#c3524a', '#5a9c52', '#d7b440', '#8a5cb4', '#dd7d45'],
  pants: ['#3f4a6b', '#5b4636', '#4b5a3c'],
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
  roof: ['#c0503f', '#5d73a8', '#6f9450', '#8c6848', '#6a6570'],
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
  void: '#4e8a3c', // outside the map: more countryside

  // Drawn straight onto the canvas by the renderer rather than into a sprite.
  highlight: '#ffffff', // under a hovered flower
  glitterGlow: '#ffe278', // the pulse under an open PR's bud
  labelInk: '#1c1624', // the halo round a plot's name
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
