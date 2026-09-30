// Pure: where the marker for a spotlit villager goes. Over its head while it is on screen; pinned to
// the edge of the view and pointing at it while it is off, so it can always be found. No canvas.

/**
 * World pixels per marker pixel (see src/render/sprites/spotlights.js): at one a marker was no
 * taller than a badge, and got lost among them.
 */
export const MARKER_SCALE = 2

/**
 * Where to pin the pointer for something at (sx, sy) on screen, or null while it is in view.
 * `box` is the visible part of the canvas, `{ left, top, right, bottom }`; the pointer keeps
 * `margin` in from its edge. `angle` is the direction to the target in radians (0 points right).
 */
export function edgePointer(sx, sy, box, margin) {
  if (sx >= box.left && sx <= box.right && sy >= box.top && sy <= box.bottom) return null
  const cx = (box.left + box.right) / 2
  const cy = (box.top + box.bottom) / 2
  const dx = sx - cx
  const dy = sy - cy
  const hw = Math.max(1, (box.right - box.left) / 2 - margin)
  const hh = Math.max(1, (box.bottom - box.top) / 2 - margin)
  // Along the line from the centre to the target, as far as the inset box goes.
  const k = Math.min(dx ? hw / Math.abs(dx) : Infinity, dy ? hh / Math.abs(dy) : Infinity)
  return { x: cx + dx * k, y: cy + dy * k, angle: Math.atan2(dy, dx) }
}
