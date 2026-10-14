// The foreman: no thread's villager, but the one who walks the rounds while a check is out. In from
// the square, door to door down the list it was given, a pause at each, and back out through the
// arch when the round is in. Nobody's house is his, so nothing about him means a thread's status.
import { HATS, TOPS, Villager, lookFor, facingFrom } from './villager.js'

/** His id among the villagers: a thread's id always has a colon in it, so this can never be one. */
export const FOREMAN_ID = 'foreman'

// Long enough at a door to read as a look over the work, short enough that a round of a dozen
// houses still sees every one in a couple of minutes.
const DWELL = 2.4
// He stands beside the door, not on it: the doorstep is the villager's own.
const BESIDE = 0.8

export class Foreman extends Villager {
  constructor({ x, y }) {
    super(FOREMAN_ID, { x, y, status: 'idle', loco: 'entering' })
    this.name = 'Foreman'
    // Always himself: a hard hat and a high-vis top, in any theme, so he's never taken for a villager.
    this.look = { ...lookFor(FOREMAN_ID), hat: HATS.indexOf('hardhat'), top: TOPS.indexOf('hivis'), hatColor: 0 }
    this.stops = []
    this.at = 0
    this.dwell = DWELL
  }

  /** The houses to call at, in order: thread ids. Kept where he is in the list if it still has him. */
  setStops(ids) {
    const here = this.stops[this.at]
    this.stops = [...ids]
    const i = this.stops.indexOf(here)
    this.at = i >= 0 ? i : 0
  }

  get badge() {
    return null
  }

  _door(world) {
    const live = this.stops.filter((id) => {
      const b = world.buildings.get(id)
      return b && !b.removing
    })
    if (!live.length) return null
    this.at %= live.length
    const b = world.buildings.get(live[this.at])
    const p = { x: b.front.x + BESIDE, y: b.front.y }
    return { b, p: world.nav.standable(p.x, p.y) ? p : b.front }
  }

  _chooseSpot(world, dt) {
    const door = this._door(world)
    if (!door) {
      // Nobody to call on (yet): wait in the square.
      if (!this.goal) this.setGoal(world.gate.x, world.gate.y + 1.5)
      return
    }
    this.setGoal(door.p.x, door.p.y)
    const there = Math.hypot(door.p.x - this.x, door.p.y - this.y) < 0.6
    if (!there || this.moving) return
    this.dwell -= dt
    if (this.dwell > 0) return
    this.dwell = DWELL
    this.at++
  }

  _animate(dt, world) {
    if (this.moving) {
      this.anim = 'walk'
      return
    }
    this.anim = 'idle'
    const door = this.loco === 'site' && this._door(world)
    // Looking the house over while he's at it.
    if (door) this.facing = facingFrom(door.b.center.x - this.x, door.b.center.y - this.y, this.facing)
  }
}
