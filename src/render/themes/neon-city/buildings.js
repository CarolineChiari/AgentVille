// The Neon city's buildings: the village's, seen after dark, with a neon sign on the front. A
// building is drawn as the village draws it (so every kind, size, stage and weathering stays what
// the renderer and the tests expect), then its colours are pulled toward a cold blue and its
// windows and lights are left to glow; a finished one carries a blade sign hung off its side in
// its plot's paint, lit when somebody is in. Its sprite is exactly the village's size.
import { PALETTE as P, hexToRgb, shade } from '../../sprites/palette.js'
import { PixelCanvas } from '../../sprites/pixel.js'
import { DOORSTEP_CLEAR, buildingFrames, chimneyOf, drawBuilding, fitted, heightOf, shadowOf } from '../../sprites/buildings.js'

export { buildingFrames, chimneyOf, fitted, heightOf, shadowOf }

/**
 * What each channel is multiplied by. Blue is kept most, so the walls go indigo rather than just
 * dark; the village's own outline and its lit windows are left as they are.
 */
const DUSK = [0.62, 0.64, 0.86]
/**
 * What stays as it is: the outline, and the lights themselves, named rather than guessed from
 * brightness (pale plaster and thatch are bright too, and they should go to dusk).
 */
const SPARED = new Set([P.outline, P.windowLit, P.windowLitCore, P.lampGlow, P.lanternGlow, P.flame, P.flameTip, P.flameCore, P.ember].map(rgbOf))
function rgbOf(hex) {
  const { r, g, b } = hexToRgb(hex)
  return (r << 16) | (g << 8) | b
}

/** The tubes a plot's paint family picks from: pink, cyan, violet, amber (dims.roofs). */
const TUBES = [
  [P.neonPink, P.neonPinkDim],
  [P.neonCyan, P.neonCyanDim],
  [P.neonViolet, P.neonVioletDim],
  [P.neonAmber, P.neonAmberDim],
]

/** Pull a finished building toward dusk, in place, sparing the lights. */
function dusk(pc) {
  const d = pc.data
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue
    if (SPARED.has((d[i] << 16) | (d[i + 1] << 8) | d[i + 2])) continue
    for (let k = 0; k < 3; k++) d[i + k] = Math.round(d[i + k] * DUSK[k])
  }
}

/**
 * A blade sign hung from the side of the building: a bracket, and a vertical plate of tube. It
 * sits a little way in from the edge on the wall rows, below the roofline and above the doorstep
 * so it never reaches the walkway above a building down a courtyard's side.
 */
function blade(pc, { lit, variant, roofs }) {
  const [on, off] = TUBES[(roofs + (variant % 3 === 0 ? 1 : 0)) % TUBES.length]
  const tube = lit ? on : off
  const y1 = pc.h - 8
  const y0 = Math.max(DOORSTEP_CLEAR + 1, y1 - 9)
  // The left or the right edge of the front, by variant: the first opaque column on the middle row.
  const mid = Math.round((y0 + y1) / 2)
  const right = variant % 2 === 1
  let x = right ? pc.w - 1 : 0
  while (x >= 0 && x < pc.w && !pc.opaque(x, mid)) x += right ? -1 : 1
  // Nothing on that row to hang it from: no sign.
  if (x < 0 || x >= pc.w) return
  const x0 = right ? x - 3 : x + 1
  pc.rect(x0, y0, 3, y1 - y0 + 1, P.neonGlass)
  pc.vline(x0 + 1, y0 + 1, y1 - 1, tube)
  if (lit) {
    pc.px(x0, mid, shade(on, -0.35))
    pc.px(x0 + 2, mid, shade(on, -0.35))
  }
  pc.vline(x0, y0, y0, P.neonSteelDark)
  pc.px(x0 + 1, y0 - 1, P.neonSteelDark)
}

/** The building, in the Neon city. Params as the village's `building.<kind>.<stage>`. */
export function drawNeonBuilding(o) {
  const base = drawBuilding(o)
  if (o.stage < 3) return base
  const pc = new PixelCanvas(base.w, base.h)
  pc.data.set(base.data)
  dusk(pc)
  // The sign goes on a copy, and only where the session's own grade trim isn't: a building's
  // grade is what its work has earned, and a sign hung over it would hide it.
  const sign = new PixelCanvas(base.w, base.h)
  sign.data.set(pc.data)
  blade(sign, { lit: Boolean(o.lit), variant: o.variant || 0, roofs: o.roofs || 0 })
  const plain = o.grade ? drawBuilding({ ...o, grade: 0 }) : base
  for (let i = 0; i < pc.data.length; i += 4) {
    if (plain.data[i + 3] === base.data[i + 3] && plain.data[i] === base.data[i] && plain.data[i + 1] === base.data[i + 1] && plain.data[i + 2] === base.data[i + 2]) {
      for (let k = 0; k < 4; k++) pc.data[i + k] = sign.data[i + k]
    }
  }
  return pc
}
