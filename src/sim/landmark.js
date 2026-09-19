// One landmark per plot, standing in its field: what the work done in that repo has raised
// (see progress.js). When its tier goes up it is built again, foundation to finish, the way a new
// house goes up, and the plot celebrates.
import { BUILD_SECONDS } from './constants.js'
import { hashString } from './rng.js'
import { LANDMARK_H, LANDMARK_W } from './shape.js'

/** How long a plot celebrates a new landmark: while it goes up, and a moment after. */
export const CHEER_SECONDS = BUILD_SECONDS + 2
/** Seconds between bursts of confetti while it does: about as long as one burst lasts. */
export const CHEER_EVERY = 1.2

export class Landmark {
  constructor(plot, { tier = 0, built = true } = {}) {
    this.plot = plot
    this.id = `landmark:${plot}`
    // Its look within a tier, the way a house's variant is: fixed per repo.
    this.variant = hashString(`landmark:${plot}`) % 997
    this.tier = tier
    this.x = 0
    this.y = 0
    this.w = LANDMARK_W
    this.h = LANDMARK_H
    this.progress = built ? 1 : 0
    this.cheerUntil = -Infinity // sim time the plot stops celebrating
    this.nextCheer = -Infinity // sim time of its next burst of confetti
  }

  /** 0 foundation · 1 frame · 2 walls · 3 finished, as for a building. */
  get stage() {
    return Math.min(3, Math.floor(this.progress * 4))
  }

  place(x, y) {
    const moved = x !== this.x || y !== this.y
    this.x = x
    this.y = y
    return moved
  }

  /**
   * Set its tier. Going up rebuilds it from the ground and starts the celebration; going down (the
   * saved tier is a high-water mark, so only a reset does that) just shows the lower one.
   * @returns {boolean} whether it went up
   */
  raise(tier, time) {
    if (tier === this.tier) return false
    const up = tier > this.tier
    this.tier = tier
    if (up) {
      this.progress = 0
      this.cheerUntil = time + CHEER_SECONDS
    }
    return up
  }

  cheering(time) {
    return time < this.cheerUntil
  }

  get top() {
    return { x: this.x + this.w / 2, y: this.y }
  }

  tick(dt) {
    if (this.progress < 1) this.progress = Math.min(1, this.progress + dt / BUILD_SECONDS)
  }
}
