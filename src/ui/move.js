// WASD and the arrows move the view the way a game does: for as long as a key is held, not once
// per key repeat, so the map glides instead of stuttering, and two keys together go diagonally.

// Physical keys (`code`, not `key`), so WASD sits under the left hand on any layout: ZQSD on AZERTY.
const DIRS = {
  KeyW: [0, -1],
  ArrowUp: [0, -1],
  KeyS: [0, 1],
  ArrowDown: [0, 1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
}

export function isMoveKey(code) {
  return typeof code === 'string' && Object.hasOwn(DIRS, code)
}

/** The unit direction the held keys point in, or { 0, 0 }. Opposite keys cancel; W and ↑ together are just up. */
export function heading(held) {
  let x = 0
  let y = 0
  for (const code of held) {
    if (!isMoveKey(code)) continue
    x += DIRS[code][0]
    y += DIRS[code][1]
  }
  x = Math.sign(x)
  y = Math.sign(y)
  // A diagonal goes no faster than a straight line.
  if (x && y) return { x: x * Math.SQRT1_2, y: y * Math.SQRT1_2 }
  return { x, y }
}

// ---------- press, drag, click ----------

/** How far a press may wander before it counts as a drag rather than a click, in CSS pixels. */
export const DRAG_THRESHOLD = 5

/**
 * Has this press become a drag? Once it has it stays one, so a hand that wobbles back to where it
 * started doesn't finish as a click.
 */
export const isDrag = (press, x, y, threshold = DRAG_THRESHOLD) =>
  Boolean(press) && (press.dragging || Math.hypot(x - press.x, y - press.y) > threshold)

/**
 * Should this drag move the camera? Not while a room fills the canvas: there is nothing behind it
 * to drag into view. The press is still recorded in there, though — it is what tells a click from
 * a drag, and without one nothing in a room could ever be clicked.
 */
export const pansCamera = (press, inRoom) => Boolean(press?.dragging) && !inRoom

/** Did this press end as a click on whatever is under it? */
export const isClick = (press) => Boolean(press) && !press.dragging
