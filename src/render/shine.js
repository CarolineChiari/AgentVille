// The shine on a gleaming building (see src/sim/wear.js): every few seconds a band of light
// sweeps across it, and sparkles twinkle on it. Pure maths on time and seeds, in the building
// sprite's own pixels, so it is tested under Node; the renderer only draws it.
import { mulberry32 } from '../sim/rng.js'

/** A sweep crosses each gleaming building this often, in seconds, each on its own beat. */
export const SWEEP_EVERY = 4.5
/** How long a sweep takes to cross: quick, like the sun catching a window as you walk past. */
export const SWEEP_TIME = 0.8
/** The band leans this many px to the right for every px up the sprite. */
export const SWEEP_SLANT = 0.5
/** The band's stripes, trailing back from its leading edge: [offset, width, strength]. A broad one, a thin one. */
export const SWEEP_STRIPES = [[0, 4, 0.55], [6, 1, 0.4]]
const SWEEP_SPAN = Math.max(...SWEEP_STRIPES.map(([off, width]) => off + width))

/**
 * Where the band is on a sprite `w` × `h` px at `time`: the x its leading edge crosses the
 * bottom row at, or null between sweeps. It sets off wholly left of the sprite and finishes wholly
 * right of it, so it never pops in or out.
 */
export function sweepAt(seed, time, w, h) {
  const t = (time + ((seed % 1000) / 1000) * SWEEP_EVERY) % SWEEP_EVERY
  if (t >= SWEEP_TIME) return null
  const from = -(h - 1) * SWEEP_SLANT - 1
  const to = w + SWEEP_SPAN + 1
  return from + (t / SWEEP_TIME) * (to - from)
}

/** Row `y`'s pixels of each stripe of a band whose leading edge is at `lead`: [x, width, strength]. */
export function sweepRow(lead, y, h) {
  const edge = lead + (h - 1 - y) * SWEEP_SLANT
  return SWEEP_STRIPES.map(([off, width, strength]) => [Math.round(edge - off - width), width, strength])
}

/** How many sparkles twinkle on one gleaming building at once. */
const TWINKLES = 3
/** Twinkles a second, each sparkle: often enough to catch the eye, slow enough not to fizz. */
const TWINKLE_RATE = 0.8
/** Tries at finding a spot on the building itself before a sparkle sits this one out. */
const TRIES = 4

/**
 * The sparkles on a sprite `w` × `h` px at `time`: { x, y, a } in sprite px, `a` how bright,
 * 0 to 1. Each moves to a new spot every time it twinkles. `solid(x, y)`, if given, says whether
 * the sprite has a pixel there, so a sparkle lands on the building rather than the sky beside it.
 */
export function twinklesAt(seed, time, w, h, solid = () => true) {
  const out = []
  for (let k = 0; k < TWINKLES; k++) {
    const phase = ((seed >>> (k * 7)) % 100) / 100
    const u = time * TWINKLE_RATE + phase + k / TWINKLES
    const a = Math.sin((u % 1) * Math.PI) // fade in, then out
    if (a < 0.15) continue
    const r = mulberry32(seed + k * 131 + Math.floor(u) * 977)
    for (let i = 0; i < TRIES; i++) {
      // The upper part of the building, where the roof and the windows catch the light.
      const x = 2 + Math.floor(r() * (w - 4))
      const y = Math.floor(h * 0.1 + r() * h * 0.65)
      if (!solid(x, y)) continue
      out.push({ x, y, a })
      break
    }
  }
  return out
}
