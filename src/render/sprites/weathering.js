// Wear and tear on a finished building (see src/sim/wear.js for the grades), painted over its
// pixels once it is drawn, so every kind ages the same way without knowing about it.
//
// The pass tells a building's parts apart by comparing it with the same building drawn without
// its roof: whatever the roof pass changed is roof (or awning, chimney, porch), glass-coloured
// pixels are windows, and the rest is wall. Anything that differs between a building's animation
// frames (a windmill's sails) is left alone but for fading, and every other choice is made from
// the roofless drawing or per pixel from its position, never from a random stream run over the
// finished pixels. So the frames still match, and a windmill doesn't flicker as its sails turn.
import { PALETTE as P, hexToRgb } from './palette.js'
import { lattice, noise2 } from '../../sim/noise.js'
import { mulberry32 } from '../../sim/rng.js'
import { WEAR } from '../../sim/wear.js'

const EMPTY = 0
const WALL = 1
const GLASS = 2
const ROOF = 3
const MOVING = 4

/**
 * How each grade of wear looks. `fade` blends every pixel towards dust; `stain` is the share of
 * the wall that is blotched with grime; `streaks` the share of columns a rain stain runs down from
 * the eaves; `cracks` in the walls; `holes` the share of the roof with shingles missing; `moss` on
 * the roof and along the foot of the walls; `panes`, the share of windows that are cracked,
 * broken and boarded up; `weeds` along the foot; `ivy`, how many vines and how far up they climb.
 * Gleaming is fresh paint, clean glass and sun on the roofline; the renderer adds the shine that
 * sweeps across it and the sparkles.
 */
export const LOOKS = {
  gleaming: { glint: true },
  kept: null,
  weathered: { fade: 0.1, stain: 0.1, streaks: 0.15, moss: 0.05, weeds: 3 },
  shabby: { fade: 0.18, stain: 0.2, streaks: 0.3, cracks: 1, holes: 0.08, moss: 0.12, panes: [0.5, 0.15, 0], weeds: 5, ivy: [1, 0.3] },
  rundown: { fade: 0.28, stain: 0.3, streaks: 0.4, cracks: 2, holes: 0.16, moss: 0.2, panes: [0.35, 0.4, 0.15], weeds: 7, ivy: [2, 0.55] },
  derelict: { fade: 0.4, stain: 0.4, streaks: 0.5, cracks: 3, holes: 0.24, moss: 0.22, panes: [0.1, 0.3, 0.6], weeds: 9, ivy: [3, 0.8] },
}

/** The look for a grade of wear (an index into WEAR), or null for a building drawn as it is. */
export const lookFor = (wear) => LOOKS[WEAR[wear]] ?? null

/** A window with more glass than this is a glasshouse's wall: its panes break, it isn't boarded. */
const BIG_WINDOW = 80

const rgb = (hex) => {
  const { r, g, b } = hexToRgb(hex)
  return [r, g, b]
}
const pack = (d, j) => (d[j] << 16) | (d[j + 1] << 8) | d[j + 2]
const GLASS_COLORS = new Set([P.window, P.windowShine, P.windowLit, P.windowLitCore, P.glass, P.glassLight].map((c) => pack(rgb(c), 0)))
const DUST = rgb(P.dust)
const GRIME = rgb(P.grime)
const MOSS = rgb(P.moss)
const WHITE = rgb(P.white)
const SHINE = rgb(P.windowShine)
const CRACK = rgb(P.outline)
const HOLE = rgb(P.interior)
const PLANK = [rgb(P.woodLight), rgb(P.wood), rgb(P.woodDark)]
const LEAVES = [rgb(P.leafDark), rgb(P.leaf), rgb(P.leafLight)]

function blend(d, j, c, t) {
  d[j] += (c[0] - d[j]) * t
  d[j + 1] += (c[1] - d[j + 1]) * t
  d[j + 2] += (c[2] - d[j + 2]) * t
}
function paint(d, j, c) {
  d[j] = c[0]
  d[j + 1] = c[1]
  d[j + 2] = c[2]
  d[j + 3] = 255
}

/**
 * Weather `pc` in place. `body` is the same building drawn without its roof; `others` are its
 * other animation frames, if it has any, so whatever moves between them can be left alone.
 * `look` comes from `lookFor`; `seed` is the building's variant.
 */
export function weather(pc, body, look, seed, others = []) {
  if (!look) return pc
  const { w, h } = pc
  const d = pc.data
  const bd = body.data
  const at = (x, y) => (x >= 0 && y >= 0 && x < w && y < h ? y * w + x : -1)

  // What each pixel is. Glass is found in either drawing, so a window keeps its shape under a sail.
  const parts = new Uint8Array(w * h)
  const glass = new Uint8Array(w * h)
  for (let i = 0; i < w * h; i++) {
    const j = i * 4
    const inBody = bd[j + 3] > 0
    glass[i] = inBody && GLASS_COLORS.has(pack(bd, j)) ? 1 : 0
    if (others.some((o) => o.data[j + 3] !== d[j + 3] || pack(o.data, j) !== pack(d, j))) {
      parts[i] = MOVING
      continue
    }
    if (!d[j + 3]) continue
    const isGlass = GLASS_COLORS.has(pack(d, j))
    if (isGlass) glass[i] = 1
    parts[i] = isGlass ? GLASS : inBody && pack(bd, j) === pack(d, j) ? WALL : ROOF
  }
  const solid = (x, y) => {
    const i = at(x, y)
    return i >= 0 && parts[i] !== EMPTY && parts[i] !== MOVING
  }
  const inner = (x, y) => solid(x - 1, y) && solid(x + 1, y) && solid(x, y - 1) && solid(x, y + 1)
  const isWall = (x, y) => parts[at(x, y)] === WALL

  // The roofless drawing's shape: its extent, and where each column meets the ground and the eaves.
  let x0 = w
  let x1 = -1
  let y0 = h
  let y1 = -1
  const foot = new Int16Array(w).fill(-1)
  const eave = new Int16Array(w).fill(-1)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      if (!bd[i * 4 + 3]) continue
      x0 = Math.min(x0, x)
      x1 = Math.max(x1, x)
      y0 = Math.min(y0, y)
      y1 = Math.max(y1, y)
      foot[x] = y
      if (eave[x] < 0 && !glass[i]) eave[x] = y
    }
  }
  if (x1 < 0) return pc

  const windows = windowsOf(glass, w, h)
  if (look.glint) {
    shine(pc, parts, windows)
    return pc
  }

  const rand = mulberry32(seed * 2654435761 + 97)

  // Windows: cracked, then broken, then boarded up.
  const [cracked = 0, broken = 0, boarded = 0] = look.panes || []
  for (const b of windows) {
    const roll = lattice(b.x0, b.y0, seed + 5)
    if (b.n > BIG_WINDOW) {
      // A glasshouse loses a pane here and there instead.
      for (let y = b.y0; y <= b.y1; y++) {
        for (let x = b.x0; x <= b.x1; x++) {
          const i = at(x, y)
          if (parts[i] !== GLASS) continue
          const pane = lattice(Math.floor(x / 4), Math.floor(y / 4), seed + 6)
          if (pane < (broken + boarded) * 0.5 && lattice(x, y, seed + 7) > 0.2) paint(d, i * 4, HOLE)
          else if (pane < (broken + boarded + cracked) * 0.5 && lattice(x, y, seed + 8) < 0.2) blend(d, i * 4, WHITE, 0.5)
        }
      }
    } else if (roll < boarded) board(b)
    else if (roll < boarded + broken) smash(b)
    else if (roll < boarded + broken + cracked) crack(b)
  }

  function crack(b) {
    // A star of short cracks from a point somewhere on the glass.
    const cx = b.x0 + Math.floor(lattice(b.x0, b.y0, seed + 21) * (b.x1 - b.x0 + 1))
    const cy = b.y0 + Math.floor(lattice(b.y0, b.x0, seed + 22) * (b.y1 - b.y0 + 1))
    const mark = (x, y, t) => {
      const i = at(x, y)
      if (i >= 0 && parts[i] === GLASS) blend(d, i * 4, WHITE, t)
    }
    mark(cx, cy, 0.65)
    ;[[1, 1], [-1, 1], [1, -1], [-1, -1], [0, 1], [1, 0]].forEach(([dx, dy], k) => {
      if (lattice(cx + k, cy, seed + 23) < 0.5) return
      for (let s = 1; s <= 2; s++) mark(cx + dx * s, cy + dy * s, 0.45)
    })
  }

  function smash(b, shards = 0.35) {
    // A dark hole with a few shards left round its edges.
    for (let y = b.y0; y <= b.y1; y++) {
      for (let x = b.x0; x <= b.x1; x++) {
        const i = at(x, y)
        if (parts[i] !== GLASS) continue
        const edge = parts[at(x - 1, y)] !== GLASS || parts[at(x + 1, y)] !== GLASS || parts[at(x, y - 1)] !== GLASS || parts[at(x, y + 1)] !== GLASS
        if (!(edge && lattice(x, y, seed + 24) < shards)) paint(d, i * 4, HOLE)
      }
    }
  }

  function board(b) {
    // Dark inside, and two planks nailed across the frame in an X, each with a shadow under it.
    smash(b, 0)
    const fx0 = b.x0 - 1
    const fx1 = b.x1 + 1
    const fy0 = b.y0 - 1
    const fy1 = b.y1 + 1
    const planks = []
    const n = fx1 - fx0
    for (let k = 0; k <= n; k++) {
      const t = n ? k / n : 0
      planks.push([fx0 + k, Math.round(fy0 + 1 + t * (fy1 - fy0 - 2))])
      planks.push([fx0 + k, Math.round(fy1 - 1 - t * (fy1 - fy0 - 2))])
    }
    const on = new Set(planks.map(([x, y]) => at(x, y)))
    const nail = (x, y, c) => {
      const i = at(x, y)
      if (i >= 0 && (parts[i] === WALL || parts[i] === GLASS)) paint(d, i * 4, c)
    }
    for (const [x, y] of planks) if (!on.has(at(x, y + 1))) nail(x, y + 1, PLANK[2])
    planks.forEach(([x, y], k) => nail(x, y, PLANK[k % 4 < 2 ? 0 : 1]))
  }

  // Cracks in the walls, wandering down from somewhere on them.
  for (let c = 0; c < (look.cracks || 0); c++) {
    let x = -1
    let y = -1
    for (let tries = 0; tries < 30; tries++) {
      const tx = x0 + Math.floor(rand() * (x1 - x0 + 1))
      const ty = y0 + Math.floor(rand() * (y1 - y0 + 1))
      const i = ty * w + tx
      if (bd[i * 4 + 3] && !glass[i]) {
        x = tx
        y = ty
        break
      }
    }
    const steps = 3 + Math.floor(rand() * 4)
    for (let s = 0; s < steps; s++) {
      const dx = Math.floor(rand() * 3) - 1
      if (x < 0) continue
      if (isWall(x, y)) blend(d, at(x, y) * 4, CRACK, 0.55)
      x += dx
      y++
    }
  }

  // Shingles gone from the roof, in small ragged patches, showing the dark loft underneath.
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      if (parts[i] !== ROOF || !inner(x, y)) continue
      const course = y >> 1
      const tile = Math.floor((x + (course & 1) * 2) / 3)
      if (lattice(tile, course, seed + 31) < (look.holes || 0) && lattice(x, y, seed + 32) > 0.2) paint(d, i * 4, HOLE)
    }
  }

  // Everything fades towards dust.
  for (let i = 0; i < w * h; i++) if (d[i * 4 + 3]) blend(d, i * 4, DUST, look.fade || 0)

  // Grime: blotches over the dirtiest share of the wall, and rain stains down from the eaves.
  if (look.stain) {
    const dirt = []
    for (let i = 0; i < w * h; i++) if (bd[i * 4 + 3] && !glass[i]) dirt.push(noise2((i % w) / 5, Math.floor(i / w) / 4, seed + 41))
    dirt.sort((a, b) => a - b)
    const cut = dirt[Math.floor(dirt.length * (1 - look.stain))] ?? 1
    for (let i = 0; i < w * h; i++) {
      if (parts[i] !== WALL) continue
      const n = noise2((i % w) / 5, Math.floor(i / w) / 4, seed + 41)
      if (n >= cut) blend(d, i * 4, GRIME, 0.3)
    }
  }
  for (let x = x0; x <= x1; x++) {
    if (eave[x] < 0 || lattice(x, 0, seed + 43) >= (look.streaks || 0)) continue
    const len = 3 + Math.floor(lattice(x, 1, seed + 43) * 10)
    for (let k = 0; k < len; k++) {
      const y = eave[x] + k
      if (isWall(x, y) && lattice(x, y, seed + 44) < 0.85) blend(d, at(x, y) * 4, GRIME, 0.35 * (1 - k / len))
    }
  }

  // Moss on the roof, and along the foot of the walls.
  const moss = look.moss || 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      if (parts[i] === ROOF && inner(x, y)) {
        if (lattice(x >> 1, y >> 1, seed + 51) < moss) blend(d, i * 4, MOSS, 0.6)
      } else if (parts[i] === WALL && foot[x] >= 0 && y >= foot[x] - 1 && lattice(x, y, seed + 53) < moss * 2) blend(d, i * 4, MOSS, 0.7)
    }
  }

  // Living things go on last, so they are as green as ever on a faded wall.
  const grow = (x, y, c) => {
    const i = at(x, y)
    if (i >= 0 && bd[i * 4 + 3] && parts[i] !== MOVING && parts[i] !== EMPTY) paint(d, i * 4, c)
  }
  // Weeds in tufts along the foot of the walls.
  for (let k = 0; k < (look.weeds || 0); k++) {
    const x = x0 + Math.floor(rand() * (x1 - x0 + 1))
    const tall = 1 + Math.floor(rand() * 3)
    const lean = Math.floor(rand() * 3) - 1
    if (foot[x] < 0) continue
    for (let s = 0; s < tall; s++) grow(x + (s === tall - 1 ? lean : 0), foot[x] - s, LEAVES[(s + k) % 2])
    grow(x - 1, foot[x], LEAVES[1])
    grow(x + 1, foot[x], LEAVES[2])
  }
  // Ivy, climbing from the ground up the walls and over whatever is on them.
  const [vines = 0, climb = 0] = look.ivy || []
  for (let v = 0; v < vines; v++) {
    let x = x0 + 1 + Math.floor(rand() * Math.max(1, x1 - x0 - 1))
    const height = Math.round((y1 - y0 + 1) * climb * (0.6 + 0.4 * rand()))
    let y = foot[x] >= 0 ? foot[x] : y1
    for (let s = 0; s < height; s++) {
      const r = rand()
      const r2 = rand()
      grow(x, y, LEAVES[0])
      if (r < 0.6) grow(x + (r2 < 0.5 ? -1 : 1), y, LEAVES[r2 < 0.25 || r2 > 0.75 ? 2 : 1])
      if (r > 0.8) {
        grow(x - 1, y - 1, LEAVES[1])
        grow(x + 1, y - 1, LEAVES[1])
      }
      y--
      if (r2 < 0.2) x--
      else if (r2 > 0.8) x++
      x = Math.max(x0, Math.min(x1, x))
    }
  }
  return pc
}

/**
 * A building fresh from the painters: a little more colour everywhere, clean glass with a bright
 * diagonal across the top of each window, and the sun catching the top edge of the roof.
 */
function shine(pc, parts, windows) {
  const { w, h, data: d } = pc
  for (let i = 0; i < w * h; i++) {
    const j = i * 4
    if (!d[j + 3]) continue
    const l = (d[j] * 0.3 + d[j + 1] * 0.59 + d[j + 2] * 0.11)
    for (let k = 0; k < 3; k++) d[j + k] = l + (d[j + k] - l) * 1.15
  }
  for (const b of windows) {
    for (let y = b.y0; y <= b.y1; y++) {
      for (let x = b.x0; x <= b.x1; x++) {
        const i = y * w + x
        if (parts[i] !== GLASS) continue
        const k = (x - b.x0 + y - b.y0) % 9
        blend(d, i * 4, k === 1 || k === 2 ? WHITE : SHINE, k === 1 || k === 2 ? 0.75 : 0.2)
      }
    }
  }
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      const i = y * w + x
      if (!d[i * 4 + 3]) continue
      if (parts[i] === ROOF || parts[i] === WALL) blend(d, i * 4, WHITE, 0.35)
      break
    }
  }
}

/**
 * Each window's glass as a box: pixels of glass within two of each other are one window, so the
 * one-pixel mullions between its panes don't split it up. `n` is how much glass it has.
 */
export function windowsOf(glass, w, h) {
  const seen = new Uint8Array(w * h)
  const out = []
  for (let s = 0; s < w * h; s++) {
    if (!glass[s] || seen[s]) continue
    const b = { x0: w, y0: h, x1: -1, y1: -1, n: 0 }
    const stack = [s]
    seen[s] = 1
    while (stack.length) {
      const i = stack.pop()
      const x = i % w
      const y = (i - x) / w
      b.x0 = Math.min(b.x0, x)
      b.y0 = Math.min(b.y0, y)
      b.x1 = Math.max(b.x1, x)
      b.y1 = Math.max(b.y1, y)
      b.n++
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
          const k = ny * w + nx
          if (glass[k] && !seen[k]) {
            seen[k] = 1
            stack.push(k)
          }
        }
      }
    }
    out.push(b)
  }
  return out
}
