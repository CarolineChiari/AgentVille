// One building per thread. What it is and how it looks is decided by the thread id alone, so a
// session always builds the same thing; where it stands is decided by the plot's slot map.
import { BUILDING_H, BUILDING_W, BUILD_SECONDS } from './constants.js'
import { hashString, pick, rngFor } from './rng.js'

export const KINDS = ['house', 'cottage', 'shop', 'barn', 'windmill', 'workshop', 'well', 'farm']
// Weighted: homes are the common case, oddities are a pleasant surprise.
const KIND_BAG = ['house', 'house', 'house', 'cottage', 'cottage', 'shop', 'shop', 'barn', 'windmill', 'workshop', 'workshop', 'well', 'farm']

export class Building {
  constructor(id, { built = true } = {}) {
    const rand = rngFor(`building:${id}`)
    this.id = id
    this.kind = pick(rand, KIND_BAG)
    this.variant = hashString(`variant:${id}`) % 997
    this.x = 0
    this.y = 0
    this.w = BUILDING_W
    this.h = BUILDING_H
    this.progress = built ? 1 : 0
    this.alpha = 1
    this.removing = false
    this.plot = ''
    this.lit = false
  }

  /** 0 foundation · 1 frame · 2 walls · 3 finished. */
  get stage() {
    return Math.min(3, Math.floor(this.progress * 4))
  }

  place(x, y, plot) {
    const moved = x !== this.x || y !== this.y
    this.x = x
    this.y = y
    this.plot = plot
    return moved
  }

  /** Where the occupant stands to wait, sleep or cheer: on the walkway in front of the door. */
  get front() {
    return { x: this.x + this.w / 2, y: this.y + this.h + 0.5 }
  }
  get center() {
    return { x: this.x + this.w / 2, y: this.y + this.h / 2 }
  }

  /** Candidate spots to hammer from, before filtering by what is walkable. */
  workSpots() {
    const { x, y, w, h } = this
    return [
      { x: x + 0.5, y: y + h + 0.5 },
      { x: x + w - 0.5, y: y + h + 0.5 },
      { x: x - 0.5, y: y + h - 0.5 },
      { x: x + w + 0.5, y: y + h - 0.5 },
      { x: x - 0.5, y: y + 0.5 },
      { x: x + w + 0.5, y: y + 0.5 },
    ]
  }

  tick(dt) {
    if (this.removing) {
      this.alpha = Math.max(0, this.alpha - dt)
      return
    }
    if (this.progress < 1) this.progress = Math.min(1, this.progress + dt / BUILD_SECONDS)
  }
}
