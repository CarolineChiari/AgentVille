// Where the village's ambient life is at a given moment: butterflies over the flowers, smoke from
// busy chimneys, cloud shadows drifting over, and now and then a few birds crossing. Pure maths on
// time and seeds, in world pixels, so it is tested under Node; the renderer only draws it.
import { lattice } from '../sim/noise.js'
import { mulberry32 } from '../sim/rng.js'

/** More than this on screen reads as a swarm rather than a summer's day. */
export const MAX_BUTTERFLIES = 14

/** A butterfly flitting round the flower at (ax, ay): a loop that never quite repeats. */
export function butterflyAt(ax, ay, seed, time) {
  const p = (seed % 1000) / 159
  return {
    x: ax + Math.sin(time * 0.7 + p) * 12 + Math.sin(time * 2.1 + p * 3) * 3,
    y: ay - 9 + Math.sin(time * 1.1 + p * 2) * 5 + Math.cos(time * 3.3 + p) * 2,
    // Wings beat about nine times a second, each butterfly out of step with the rest.
    frame: Math.floor(time * 9 + p) % 2,
  }
}

/** How many puffs of smoke are in the air above a chimney at once. */
const PUFFS = 3

/** Puffs rising from a chimney top at (x, y): each drifts east, grows, and thins out. */
export function smokePuffs(x, y, seed, time) {
  const phase = (seed % 1000) / 1000
  const out = []
  for (let k = 0; k < PUFFS; k++) {
    const t = (time * 0.45 + phase + k / PUFFS) % 1
    out.push({
      x: x + t * 5 + Math.sin((t + phase) * 6) * 1.5,
      y: y - 2 - t * 16,
      size: t < 0.25 ? 2 : t < 0.6 ? 3 : 4,
      alpha: 0.9 * (1 - t) ** 0.7,
    })
  }
  return out
}

/** Clouds sit one to a cell of this lattice (in world px), where they sit at all. */
const CLOUD_GRID = 520
/** A cloud's shadow is three soft puffs about this big. */
export const CLOUD_R = 70
/** The wind, in world px a second: mostly east, a little south. */
const WIND = { x: 5, y: 1.5 }
/** Share of lattice cells with no cloud in them, so the sky is not a pattern. */
const CLEAR = 0.35

/**
 * The cloud shadows over the world rectangle `view` ({ x0, y0, x1, y1 }, world px) at `time`:
 * soft circles { x, y, r }. The clouds are fixed to a drifting lattice, so they move together
 * with the wind whichever way the camera goes.
 */
export function cloudsIn(view, time) {
  const dx = time * WIND.x
  const dy = time * WIND.y
  const out = []
  const margin = CLOUD_R * 2
  const cx0 = Math.floor((view.x0 - dx - margin) / CLOUD_GRID)
  const cx1 = Math.floor((view.x1 - dx + margin) / CLOUD_GRID)
  const cy0 = Math.floor((view.y0 - dy - margin) / CLOUD_GRID)
  const cy1 = Math.floor((view.y1 - dy + margin) / CLOUD_GRID)
  for (let cy = cy0; cy <= cy1; cy++) {
    for (let cx = cx0; cx <= cx1; cx++) {
      if (lattice(cx, cy, 11) < CLEAR) continue
      const x = cx * CLOUD_GRID + lattice(cx, cy, 12) * CLOUD_GRID * 0.6 + dx
      const y = cy * CLOUD_GRID + lattice(cx, cy, 13) * CLOUD_GRID * 0.6 + dy
      const big = 0.8 + lattice(cx, cy, 14) * 0.5
      for (const [ox, oy, k] of [[0, 0, 1], [-0.55, 0.2, 0.7], [0.6, 0.15, 0.75]]) {
        out.push({ x: x + ox * CLOUD_R * big, y: y + oy * CLOUD_R * big, r: CLOUD_R * big * k })
      }
    }
  }
  return out.filter((c) => c.x + c.r > view.x0 && c.x - c.r < view.x1 && c.y + c.r > view.y0 && c.y - c.r < view.y1)
}

/** A flock sets off about this often, in seconds. */
export const FLOCK_EVERY = 45
/** How fast birds fly, in world px a second. */
const BIRD_SPEED = 45
/** Where each bird flies in the V, behind the leader: back and out to either side. */
const FORMATION = [[0, 0], [-9, -6], [-9, 6], [-18, -11]]

/**
 * The flock that sets off in cycle `cycle`, from just outside one side of `view` across to the
 * other. The view is the one on screen when it sets off; after that it keeps to its own course.
 */
export function flockFor(cycle, view) {
  const r = mulberry32(cycle * 7919 + 13)
  const east = r() < 0.5
  const pad = 30
  const width = view.x1 - view.x0 + pad * 2
  // Across a very wide view they fly faster, so they are gone before the next flock sets off.
  const speed = Math.max(BIRD_SPEED, width / (FLOCK_EVERY - 5))
  return {
    cycle,
    x0: east ? view.x0 - pad : view.x1 + pad,
    y0: view.y0 + (view.y1 - view.y0) * (0.2 + r() * 0.5),
    vx: (east ? 1 : -1) * speed,
    vy: (r() - 0.5) * 12,
    birds: 3 + (r() < 0.5 ? 1 : 0),
    flight: width / speed,
  }
}

/** Where the flock's birds are `elapsed` seconds after setting off, or [] once it has gone. */
export function birdsAt(flock, elapsed) {
  if (elapsed < 0 || elapsed > flock.flight) return []
  const dir = Math.sign(flock.vx)
  return FORMATION.slice(0, flock.birds).map(([ox, oy], i) => ({
    x: flock.x0 + flock.vx * elapsed + ox * dir,
    y: flock.y0 + flock.vy * elapsed + oy + Math.sin(elapsed * 3 + i) * 1.5,
    frame: Math.floor(elapsed * 6 + i * 0.7) % 2,
  }))
}
