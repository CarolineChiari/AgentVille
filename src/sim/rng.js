// Seeded randomness: the same thread id always gets the same villager, building and yard.

/** FNV-1a, 32-bit. */
export function hashString(str) {
  let h = 0x811c9dc5
  const s = String(str)
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** mulberry32: small, fast, good enough for cosmetics. Returns floats in [0, 1). */
export function mulberry32(seed) {
  let a = seed >>> 0
  return function rand() {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const rngFor = (key) => mulberry32(hashString(key))
export const pick = (rand, list) => list[Math.floor(rand() * list.length)]
export const range = (rand, lo, hi) => lo + rand() * (hi - lo)
