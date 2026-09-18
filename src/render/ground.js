// What the grass looks like from place to place. Pure, so it is tested under Node; the renderer
// applies it to a chunk as it bakes it.
//
// - Tone patches: sunny and lush patches in the countryside's meadows and in every plot's lawn.
//   Tiles are drawn in plain grass and recoloured pixel by pixel, rather than drawn in one tone
//   per tile, because a tone per tile makes every patch a staircase of 16-pixel squares.
// - Lawn cover: drifts of clover and of one kind of small flower at a time across a lawn, and the
//   odd tuft, so a big courtyard is not one flat green.
import { fbm, lattice } from '../sim/noise.js'

/** 4×4 ordered dither thresholds, so an edge is a tidy pixel-art checker rather than noise. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16)

/**
 * A field of tones over world pixels: 0 plain, 1 sunny below `sunny`, 2 lush above `lush`, with
 * `band` either side of each threshold dithered between the two.
 */
function toneField({ scale, octaves, seed, sunny, lush, band }) {
  return (px, py) => {
    const n = fbm(px * scale, py * scale, seed, octaves)
    const b = BAYER[(py & 3) * 4 + (px & 3)]
    if (n < sunny + band) return n < sunny - band || (sunny + band - n) / (2 * band) > b ? 1 : 0
    if (n > lush - band) return n > lush + band || (n - (lush - band)) / (2 * band) > b ? 2 : 0
    return 0
  }
}

/**
 * The countryside. A patch is a few tiles across: 96 px per noise step, and a third octave so
 * edges wander and patch sizes vary instead of repeating like camouflage. Octaves of value noise
 * bunch up round 0.5, so the thresholds sit near its 22nd and 78th percentiles rather than at
 * thirds: each tone is an occasional patch in plain grass, not a third of the map.
 */
export const meadowTone = toneField({ scale: 1 / 96, octaves: 3, seed: 7, sunny: 0.375, lush: 0.61, band: 0.025 })

/**
 * A plot's lawn: smaller patches than a meadow's (64 px per step) and a quarter of the lawn in
 * each tone (thresholds at about the 25th and 75th percentiles), so even a small yard has some.
 */
export const lawnTone = toneField({ scale: 1 / 64, octaves: 2, seed: 23, sunny: 0.38, lush: 0.615, band: 0.02 })

const pack = (hex) => parseInt(hex.slice(1, 7), 16)

/**
 * Recolour the plain grass in an RGBA buffer whose top-left pixel is world pixel (ox, oy).
 * `tones` is [plain, sunny, lush], each the same list of greens; only a pixel that is exactly one
 * of the plain greens changes, so paths, flowers and hand-drawn tiles keep their colours.
 * `toneAt` is the field of patches: the meadows' unless a lawn's is given.
 */
export function tintMeadow(data, w, h, ox, oy, tones, toneAt = meadowTone) {
  const from = tones[0].map(pack)
  const to = tones.map((set) => set.map((hex) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]))
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      if (data[i + 3] === 0) continue
      const k = from.indexOf((data[i] << 16) | (data[i + 1] << 8) | data[i + 2])
      if (k < 0) continue
      const t = toneAt(ox + x, oy + y)
      if (!t) continue
      const [r, g, b] = to[t][k]
      data[i] = r
      data[i + 1] = g
      data[i + 2] = b
    }
  }
}

/** The small flowers of a lawn; each drift is one of them. See the `lawnflowers` sprite. */
export const LAWN_FLOWERS = ['daisy', 'buttercup', 'dandelion', 'speedwell', 'pinkclover']
/**
 * Scatters of each lawn flower or clover, sparse ones first: a tile picks one by its own hash.
 * With one scatter every tile of a drift was the same stamp, and a drift read as a grid.
 */
export const LAYOUTS = 4
/** Which flower a `lawnflowers` variant is. */
export const flowerOf = (variant) => Math.floor(variant / LAYOUTS)

/**
 * Drifts are where slow noise (a step every few tiles) rises into its top sixth: clover in one
 * field, flowers in another. Inside a drift only some tiles have any, so it thins out raggedly
 * instead of ending in a hard square edge.
 */
const DRIFT_SCALE = 1 / 4.5
const CLOVER_DRIFT = 0.665
const BLOOM_DRIFT = 0.665
const CLOVER_FILL = 0.55
const BLOOM_FILL = 0.45

/**
 * What grows on the lawn tile (tx, ty), if anything: `{ kind, variant }`, where kind is a
 * decoration sprite, or null for plain lawn.
 */
export function lawnCover(tx, ty) {
  const h = lattice(tx, ty, 91)
  const sparse = lattice(tx, ty, 92) < 0.5 ? 0 : 1
  if (fbm(tx * DRIFT_SCALE, ty * DRIFT_SCALE, 31) > CLOVER_DRIFT) {
    // Clover variants: four scatters of leaves, then the same four in flower.
    if (h < CLOVER_FILL) return { kind: 'clover', variant: (h < 0.08 ? LAYOUTS : 0) + Math.floor(lattice(tx, ty, 92) * LAYOUTS) }
  } else if (fbm(tx * DRIFT_SCALE, ty * DRIFT_SCALE, 37) > BLOOM_DRIFT) {
    if (h < BLOOM_FILL) {
      // A drift grows round a peak of the noise's lattice, so the nearest lattice point names its
      // flower: one kind all through a drift, each kind as likely as the next.
      const flower = Math.floor(lattice(Math.round(tx * DRIFT_SCALE), Math.round(ty * DRIFT_SCALE), 41) * LAWN_FLOWERS.length)
      return { kind: 'lawnflowers', variant: flower * LAYOUTS + (h < 0.15 ? 2 : 0) + sparse }
    }
  }
  // Now and then, anywhere: a clump of longer grass, a lone dandelion, a stone, toadstools.
  if (h > 0.97) return { kind: 'tuft', variant: Math.floor((h - 0.97) * 100) }
  if (h > 0.955) return { kind: 'lawnflowers', variant: LAWN_FLOWERS.indexOf('dandelion') * LAYOUTS + sparse }
  if (h > 0.945) return { kind: 'pebbles', variant: Math.min(2, Math.floor((h - 0.945) * 300)) }
  if (h > 0.94) return { kind: 'mushrooms', variant: 1 }
  return null
}
