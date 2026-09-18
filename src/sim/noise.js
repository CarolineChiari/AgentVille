// Smooth value noise over the plane, for things that should vary gently from place to place
// (a meadow's tone, how thick a wood is) rather than jump tile by tile. Pure and seeded: the same
// (x, y, seed) is the same value on every machine, so the countryside never reshuffles.

/** A value in [0, 1) for an integer lattice point. Integer mixing only: this runs per pixel. */
export function lattice(ix, iy, seed = 0) {
  let h = Math.imul(ix | 0, 0x27d4eb2d) ^ Math.imul(iy | 0, 0x165667b1) ^ Math.imul(seed | 0, 0x9e3779b1)
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

const smooth = (t) => t * t * (3 - 2 * t)

/** Lattice values blended smoothly in between: 1 unit is one lattice step. In [0, 1). */
export function noise2(x, y, seed = 0) {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const fx = smooth(x - ix)
  const fy = smooth(y - iy)
  const a = lattice(ix, iy, seed)
  const b = lattice(ix + 1, iy, seed)
  const c = lattice(ix, iy + 1, seed)
  const d = lattice(ix + 1, iy + 1, seed)
  const top = a + (b - a) * fx
  return top + (c + (d - c) * fx - top) * fy
}

/** Octaves of noise, each twice as fine and half as strong, so edges wander. In [0, 1). */
export function fbm(x, y, seed = 0, octaves = 2) {
  let sum = 0
  let norm = 0
  let amp = 1
  let f = 1
  for (let o = 0; o < octaves; o++) {
    sum += noise2(x * f, y * f, seed + o * 1013) * amp
    norm += amp
    amp /= 2
    f *= 2
  }
  return sum / norm
}
