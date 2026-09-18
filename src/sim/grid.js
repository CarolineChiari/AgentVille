// Integer cell-grid helpers.

export const key = (x, y) => `${x},${y}`
export const unkey = (k) => k.split(',').map(Number)
export const chebyshev = (ax, ay, bx, by) => Math.max(Math.abs(ax - bx), Math.abs(ay - by))
export const ringOf = (x, y) => Math.max(Math.abs(x), Math.abs(y))

export const N4 = [[0, -1], [1, 0], [0, 1], [-1, 0]]
export const N8 = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]]

/**
 * Cells ring by ring outward from the origin. Within a ring the order starts due north and runs
 * clockwise, so "the innermost free cell" is well defined and deterministic.
 */
export function spiralCells(maxRing) {
  const out = [[0, 0]]
  for (let r = 1; r <= maxRing; r++) {
    for (let x = 0; x <= r; x++) out.push([x, -r])
    for (let y = -r + 1; y <= r; y++) out.push([r, y])
    for (let x = r - 1; x >= -r; x--) out.push([x, r])
    for (let y = r - 1; y >= -r; y--) out.push([-r, y])
    for (let x = -r + 1; x < 0; x++) out.push([x, -r])
  }
  return out
}
