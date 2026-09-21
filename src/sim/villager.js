// A villager: where it is, where it is going, and what it is doing when it gets there.
// Locomotion wins over status: anybody moving plays the walk, whatever their thread is doing.
import { ARRIVE, STROLL_SPEED, WALK_SPEED } from './constants.js'
import { BADGE_FOR } from './status.js'
import { hashString, mulberry32, range, rngFor } from './rng.js'

/** How often a villager waiting on you waves and hops, in seconds. */
export const ATTENTION_EVERY = 6
const STUCK_REPATH = 1.2
const STUCK_GHOST = 3
const STUCK_TELEPORT = 6

/** Hats, by `look.hat`: 0 is none. Those after EVERYDAY_HATS are work gear a theme hands out. */
export const HATS = ['none', 'straw', 'cap', 'beanie', 'bow', 'hardhat', 'circlet', 'witchhat', 'souwester']
/**
 * The hats a villager might pick for itself. Not HATS.length: the pick below is scaled by it, and
 * letting the list grow would have changed the hat on every villager who wears one.
 */
const EVERYDAY_HATS = 5
/** What a villager wears over its shirt, by `look.top`. After 'vest', a theme's work gear. */
export const TOPS = ['plain', 'stripes', 'overalls', 'apron', 'vest', 'hivis', 'cloak', 'cape', 'oilskin']
/** One more thing about a villager, by `look.extra`. */
export const EXTRAS = ['none', 'glasses', 'beard', 'scarf', 'satchel']

/** Picks `options[i]` with weight `weights[i]`, from one draw `u` in [0, 1). */
function weighted(u, weights) {
  const total = weights.reduce((a, b) => a + b, 0)
  let t = u * total
  for (let i = 0; i < weights.length; i++) {
    if (t < weights[i]) return i
    t -= weights[i]
  }
  return weights.length - 1
}

/**
 * A villager's look, from its thread id alone. Indices, not colours: the renderer picks those.
 *
 * The first six draws are the original look and must stay first and in this order, so every
 * villager kept its face, hair, clothes and hat when the rest came along. Everything after is
 * drawn whether it is used or not, so one choice never shifts the next.
 */
export function lookFor(id) {
  const r = rngFor(`look:${id}`)
  const look = {
    skin: Math.floor(r() * 4),
    hair: Math.floor(r() * 5),
    shirt: Math.floor(r() * 6),
    pants: Math.floor(r() * 3),
    style: Math.floor(r() * 3),
    hat: r() < 0.22 ? 1 : 0,
  }
  const [hatKind, bareHead, hatColor, shoe, top, extra, tall, hair, shirt, pants] = Array.from({ length: 10 }, r)
  // Whoever wore the straw hat wears a hat still, of any kind; a few more put one on.
  if (look.hat) look.hat = 1 + Math.floor(hatKind * (EVERYDAY_HATS - 1))
  else if (bareHead < 0.15) look.hat = 2 + Math.floor(hatKind * (EVERYDAY_HATS - 2))
  look.hatColor = Math.floor(hatColor * 10)
  look.shoe = Math.floor(shoe * 3)
  look.top = weighted(top, [8, 3, 3, 2, 4])
  look.extra = weighted(extra, [11, 3, 2, 2, 2])
  look.tall = tall < 0.3 ? 1 : 0
  // Some villagers take the colours that came later: a single draw both decides and picks.
  if (hair < 0.3) look.hair = 5 + Math.floor((hair / 0.3) * 3)
  if (shirt < 0.35) look.shirt = 6 + Math.floor((shirt / 0.35) * 4)
  if (pants < 0.3) look.pants = 3 + Math.floor((pants / 0.3) * 2)
  return look
}

export function facingFrom(dx, dy, fallback = 's') {
  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) return fallback
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'e' : 'w'
  return dy > 0 ? 's' : 'n'
}

export class Villager {
  constructor(id, { x, y, status, loco = 'site' }) {
    this.id = id
    this.look = lookFor(id)
    this.rand = mulberry32(hashString(`walk:${id}`))
    this.x = x
    this.y = y
    this.facing = 's'
    this.anim = 'idle'
    this.animTime = (hashString(id) % 1000) / 1000 // nobody moves in unison
    this.phase = (hashString(`phase:${id}`) % 6000) / 1000
    this.status = status
    this.loco = loco // queued | entering | site | leaving | gone
    this.building = null
    this.goal = null
    this.path = []
    this.pathVersion = -1
    this.speed = WALK_SPEED
    this.wait = range(this.rand, 0.5, 3)
    this.alpha = loco === 'entering' || loco === 'queued' ? 0 : 1
    this.moving = false
    this.stuck = 0
    this.ghost = 0
    this.fxTimer = range(this.rand, 0, 1.2)
    this.lastX = x
    this.lastY = y
  }

  setGoal(x, y, speed = WALK_SPEED) {
    if (this.goal && Math.abs(this.goal.x - x) < 1e-6 && Math.abs(this.goal.y - y) < 1e-6) return
    this.goal = { x, y }
    this.path = []
    this.pathVersion = -1
    this.speed = speed
  }

  get badge() {
    return this.loco === 'site' || this.loco === 'entering' ? BADGE_FOR[this.status] ?? null : null
  }

  /** Where this villager should be standing right now, given its status. */
  _chooseSpot(world, dt) {
    const b = this.building
    if (!b) return
    const s = this.status
    if (s === 'working') {
      this.wait -= dt
      if (!this.goal || this.wait <= 0) {
        const spots = b.workSpots().filter((p) => world.nav.standable(p.x, p.y))
        const pool = spots.length ? spots : [b.front]
        const next = pool[Math.floor(this.rand() * pool.length)]
        this.setGoal(next.x, next.y, WALK_SPEED)
        this.wait = range(this.rand, 6, 10)
      }
    } else if (s === 'idle') {
      this.wait -= dt
      if ((!this.goal || this.wait <= 0) && !this.moving) {
        const p = world.wanderSpot(this, b)
        this.setGoal(p.x, p.y, STROLL_SPEED)
        this.wait = range(this.rand, 4, 9)
      }
    } else {
      // Always the same spot for the same villager, so it doesn't pace between them.
      const spots = b.standSpots().filter((p) => world.nav.standable(p.x, p.y))
      const f = spots.length ? spots[hashString(`stand:${this.id}`) % spots.length] : b.front
      this.setGoal(f.x, f.y, WALK_SPEED)
    }
  }

  tick(dt, world) {
    if (this.loco === 'queued' || this.loco === 'gone') return
    this.animTime += dt
    this.ghost = Math.max(0, this.ghost - dt)

    if (this.loco === 'leaving') {
      this.setGoal(world.gate.x, world.gate.y, WALK_SPEED)
    } else if (this.loco === 'entering') {
      this.alpha = Math.min(1, this.alpha + dt * 2.5)
      if (this.building) {
        const f = this.building.front
        if (!this.goal) this.setGoal(f.x, f.y, WALK_SPEED)
      }
    } else {
      this.alpha = Math.min(1, this.alpha + dt * 2.5)
      this._chooseSpot(world, dt)
    }

    const arrived = this.goal ? this._move(dt, world) : true
    // With no goal nothing moves this tick. Left set, `moving` froze an idle villager where it
    // first arrived, since it only picks somewhere new to stroll once it has stopped.
    if (!this.goal) this.moving = false
    if (arrived) {
      if (this.loco === 'leaving') {
        this.alpha = Math.max(0, this.alpha - dt * 2)
        if (this.alpha <= 0) this.loco = 'gone'
      } else if (this.loco === 'entering') {
        this.loco = 'site'
        this.goal = null
      }
    }
    this._animate(dt, world)
  }

  /** Follow the route one step. Returns true once at the goal. */
  _move(dt, world) {
    const nav = world.nav
    const gx = this.goal.x
    const gy = this.goal.y
    if (Math.hypot(gx - this.x, gy - this.y) < ARRIVE) {
      this.moving = false
      this.stuck = 0
      return true
    }
    if (this.pathVersion !== nav.version || !this.path.length) {
      this.path = nav.findPath(this.x, this.y, gx, gy)
      this.pathVersion = nav.version
      if (!this.path.length) this.path = [{ x: gx, y: gy }]
    }
    let budget = this.speed * dt
    const sx = this.x
    const sy = this.y
    // Headway over the last tick, the crowd's shoves included: where this villager is now against
    // where it set off from last tick. A step the crowd shoves straight back looks like walking but
    // gets nowhere; two villagers squeezing into one gap side by side did that to each other for good.
    const headway = Math.hypot(sx - this.lastX, sy - this.lastY)
    this.lastX = sx
    this.lastY = sy
    while (budget > 1e-6 && this.path.length) {
      const wp = this.path[0]
      const dx = wp.x - this.x
      const dy = wp.y - this.y
      const d = Math.hypot(dx, dy)
      if (d < 1e-4) {
        this.path.shift()
        continue
      }
      const step = Math.min(d, budget)
      nav.slide(this, (dx / d) * step, (dy / d) * step)
      budget -= step
      if (Math.hypot(wp.x - this.x, wp.y - this.y) < 0.05) this.path.shift()
      else break
    }
    const moved = Math.hypot(this.x - sx, this.y - sy)
    this.moving = moved > 1e-4
    if (this.moving) this.facing = facingFrom(this.x - sx, this.y - sy, this.facing)

    // Getting nowhere: re-route, then walk through the crowd, then give up and hop clear.
    if (Math.min(moved, headway) < this.speed * dt * 0.2) this.stuck += dt
    else this.stuck = Math.max(0, this.stuck - dt * 2)
    if (this.stuck > STUCK_TELEPORT) {
      const next = this.path[0] || this.goal
      const p = nav.nearestFree(next.x, next.y)
      this.x = p.x
      this.y = p.y
      this.stuck = 0
      this.path = []
    } else if (this.stuck > STUCK_GHOST && !this.ghost) {
      this.ghost = 2
      this.path = []
    } else if (this.stuck > STUCK_REPATH && this.path.length) {
      if (this.status === 'idle' && this.loco === 'site') this.wait = 0 // just pick somewhere else
      this.path = []
      this.pathVersion = -1
    }
    return Math.hypot(gx - this.x, gy - this.y) < ARRIVE || (this.path.length === 0 && Math.hypot(gx - this.x, gy - this.y) < 0.6)
  }

  _animate(dt, world) {
    if (this.moving) {
      this.anim = 'walk'
      return
    }
    const b = this.building
    const s = this.loco === 'leaving' ? 'idle' : this.status
    switch (s) {
      case 'working':
        this.anim = 'hammer'
        if (b) this.facing = facingFrom(b.center.x - this.x, b.center.y - this.y, this.facing)
        this._every(dt, 0.5, () => world.emit('spark', this.x + ({ e: 0.5, w: -0.5 }[this.facing] ?? 0), this.y - 0.6))
        break
      case 'blocked':
        this.anim = 'slump'
        this.facing = 's'
        break
      case 'celebrating':
        this.anim = 'jump'
        this.facing = 's'
        this._every(dt, 1.2, () => world.emit('confetti', this.x, this.y - 1.4, 6))
        break
      case 'sleeping':
        this.anim = 'sit'
        this.facing = 's'
        this._every(dt, 2.5, () => world.emit('z', this.x + 0.3, this.y - 1.4))
        break
      case 'done':
        // Finished and pleased about it: stands at the door, no fuss, until you've had a look.
        this.anim = 'idle'
        this.facing = 's'
        break
      case 'waiting': {
        // Every few seconds: wave, then hop, then wait politely again. Each villager on its own clock.
        this.facing = 's'
        const t = (this.animTime + this.phase) % ATTENTION_EVERY
        this.anim = t < 1.4 ? 'wave' : t < 2.1 ? 'jump' : 'idle'
        break
      }
      default:
        this.anim = 'idle'
    }
  }

  _every(dt, period, fn) {
    this.fxTimer -= dt
    if (this.fxTimer <= 0) {
      this.fxTimer += period
      if (this.fxTimer < 0) this.fxTimer = period
      fn()
    }
  }
}
