// The countryside's sunny and lush patches: which tone of grass each ground pixel wears. Pure,
// so it is tested under Node; the renderer applies it to a chunk's pixels as it bakes them.
//
// Tiles are drawn in plain grass and then recoloured pixel by pixel, rather than drawn in one
// tone per tile, because a tone per tile makes every patch a staircase of 16-pixel squares.
import { fbm } from '../sim/noise.js'

/**
 * A patch is a few tiles across: 96 px per noise step, and a third octave so edges wander and
 * patch sizes vary instead of repeating like camouflage.
 */
const SCALE = 1 / 96
const OCTAVES = 3
const SEED = 7
/**
 * Below SUNNY the grass is sunny, above LUSH it is lush. Octaves of value noise bunch up round
 * 0.5, so these sit near its 22nd and 78th percentiles rather than at thirds: each tone is an
 * occasional patch in plain grass, not a third of the map.
 */
const SUNNY = 0.375
const LUSH = 0.61
/** Half-width of the dithered edge between tones: about three pixels of checkerboard. */
const BAND = 0.025
/** 4×4 ordered dither thresholds, so an edge is a tidy pixel-art checker rather than noise. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16)

/** 0 plain, 1 sunny, 2 lush, for the world pixel (px, py). */
export function meadowTone(px, py) {
  const n = fbm(px * SCALE, py * SCALE, SEED, OCTAVES)
  const b = BAYER[(py & 3) * 4 + (px & 3)]
  if (n < SUNNY + BAND) return n < SUNNY - BAND || (SUNNY + BAND - n) / (2 * BAND) > b ? 1 : 0
  if (n > LUSH - BAND) return n > LUSH + BAND || (n - (LUSH - BAND)) / (2 * BAND) > b ? 2 : 0
  return 0
}

const pack = (hex) => parseInt(hex.slice(1, 7), 16)

/**
 * Recolour the plain grass in an RGBA buffer whose top-left pixel is world pixel (ox, oy).
 * `tones` is [plain, sunny, lush], each the same list of greens; only a pixel that is exactly one
 * of the plain greens changes, so paths, flowers and hand-drawn tiles keep their colours.
 */
export function tintMeadow(data, w, h, ox, oy, tones) {
  const from = tones[0].map(pack)
  const to = tones.map((set) => set.map((hex) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]))
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      if (data[i + 3] === 0) continue
      const k = from.indexOf((data[i] << 16) | (data[i + 1] << 8) | data[i + 2])
      if (k < 0) continue
      const t = meadowTone(ox + x, oy + y)
      if (!t) continue
      const [r, g, b] = to[t][k]
      data[i] = r
      data[i + 1] = g
      data[i + 2] = b
    }
  }
}
