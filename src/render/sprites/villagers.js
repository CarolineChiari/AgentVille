// Villagers: 16×24, feet on the bottom row. Every frame is drawn from a pose — where the body,
// legs and arms are — so a new animation is a new list of poses, not new art.
import { PALETTE as P, shade } from './palette.js'
import { PixelCanvas } from './pixel.js'

export const VILLAGER_W = 16
export const VILLAGER_H = 24
export const ANIM_FRAMES = { walk: 4, idle: 2, hammer: 2, sit: 1, jump: 2, slump: 1 }

/** Poses per animation frame. `up` moves the whole upper body; `head` moves only the head. */
const POSES = {
  idle: [
    { up: 0, head: 0, legs: 'stand', armL: 'down', armR: 'down', eyes: 'open' },
    { up: 1, head: 0, legs: 'stand', armL: 'down', armR: 'down', eyes: 'open' },
  ],
  walk: [
    { up: 0, head: 0, legs: 'stand', armL: 'down', armR: 'down', eyes: 'open' },
    { up: -1, head: 0, legs: 'stepL', armL: 'back', armR: 'fwd', eyes: 'open' },
    { up: 0, head: 0, legs: 'stand', armL: 'down', armR: 'down', eyes: 'open' },
    { up: -1, head: 0, legs: 'stepR', armL: 'fwd', armR: 'back', eyes: 'open' },
  ],
  hammer: [
    { up: 0, head: 0, legs: 'stand', armL: 'down', armR: 'hammerUp', eyes: 'open' },
    { up: 1, head: 0, legs: 'stand', armL: 'down', armR: 'hammerDown', eyes: 'closed' },
  ],
  sit: [{ up: 3, head: 0, legs: 'sit', armL: 'down', armR: 'down', eyes: 'closed' }],
  jump: [
    { up: 1, head: 0, legs: 'crouch', armL: 'down', armR: 'down', eyes: 'happy' },
    { up: 0, head: 0, legs: 'stand', armL: 'up', armR: 'up', eyes: 'happy' },
  ],
  slump: [{ up: 1, head: 2, legs: 'stand', armL: 'down', armR: 'down', eyes: 'sad' }],
}

function colours(look) {
  const skin = P.skin[look.skin % P.skin.length]
  const hair = P.hair[look.hair % P.hair.length]
  const shirt = P.cloth[look.shirt % P.cloth.length]
  const pants = P.pants[look.pants % P.pants.length]
  return {
    skin, skinS: shade(skin, -0.14),
    hair, hairS: shade(hair, -0.25), hairL: shade(hair, 0.18),
    shirt, shirtS: shade(shirt, -0.2), shirtL: shade(shirt, 0.18),
    pants, pantsS: shade(pants, -0.25),
  }
}

// ---------- front / back (s, n) ----------

function legsFront(pc, c, legs) {
  const leg = (x0, top, shoeY, dark) => {
    pc.rect(x0, top, 3, shoeY - top, dark ? c.pantsS : c.pants)
    pc.rect(x0, shoeY, 3, 2, P.shoe)
  }
  if (legs === 'sit') {
    pc.rect(5, 19, 6, 2, c.pants)
    pc.rect(5, 21, 2, 1, P.shoe)
    pc.rect(9, 21, 2, 1, P.shoe)
    return
  }
  if (legs === 'crouch') {
    pc.rect(4, 19, 8, 3, c.pants)
    pc.px(7, 21, c.pantsS)
    pc.px(8, 21, c.pantsS)
    pc.rect(4, 22, 3, 2, P.shoe)
    pc.rect(9, 22, 3, 2, P.shoe)
    return
  }
  const liftL = legs === 'stepL' ? 1 : 0
  const liftR = legs === 'stepR' ? 1 : 0
  leg(5, 18, 22 - liftL, false)
  leg(8, 18, 22 - liftR, true)
}

function torsoFront(pc, c, dy, back) {
  pc.rect(5, 12 + dy, 6, 5, c.shirt)
  pc.vline(10, 12 + dy, 16 + dy, c.shirtS)
  pc.hline(5, 10, 17 + dy, c.pantsS) // belt
  if (!back) {
    pc.px(7, 12 + dy, c.skinS)
    pc.px(8, 12 + dy, c.skinS)
    pc.px(7, 14 + dy, c.shirtS)
    pc.px(7, 16 + dy, c.shirtS)
  } else {
    pc.vline(5, 12 + dy, 16 + dy, c.shirtS)
  }
}

function armFront(pc, c, side, mode, dy) {
  const x = side === 'L' ? 4 : 11
  const o = side === 'L' ? -1 : 1
  switch (mode) {
    case 'fwd':
      pc.vline(x, 12 + dy, 15 + dy, c.shirt)
      pc.px(x, 16 + dy, c.skin)
      break
    case 'back':
      pc.vline(x, 13 + dy, 17 + dy, c.shirtS)
      pc.px(x, 18 + dy, c.skinS)
      break
    case 'up':
      pc.vline(x + o, 8 + dy, 12 + dy, c.shirt)
      pc.px(x, 12 + dy, c.shirt)
      pc.px(x + o, 7 + dy, c.skin)
      break
    case 'hammerUp':
      pc.vline(x, 9 + dy, 13 + dy, c.shirt)
      pc.px(x, 8 + dy, c.skin)
      pc.px(x + o, 8 + dy, c.skin)
      pc.vline(x + o, 4 + dy, 7 + dy, P.woodDark)
      pc.rect(x - 1 + (o > 0 ? 0 : -1), 2 + dy, 4, 2, P.metal)
      pc.hline(x - 1 + (o > 0 ? 0 : -1), x + 2 + (o > 0 ? 0 : -1), 3 + dy, P.metalDark)
      break
    case 'hammerDown':
      pc.vline(x, 12 + dy, 16 + dy, c.shirt)
      pc.px(x, 17 + dy, c.skin)
      pc.px(x + o, 17 + dy, P.woodDark)
      pc.px(x + 2 * o, 17 + dy, P.woodDark)
      pc.rect(x + 2 * o + (o > 0 ? 0 : -1), 15 + dy, 2, 4, P.metal)
      break
    default:
      pc.vline(x, 12 + dy, 16 + dy, c.shirt)
      pc.px(x, 17 + dy, c.skin)
  }
}

function headFront(pc, c, look, dy, eyes, back) {
  pc.rect(4, 4 + dy, 8, 8, c.skin)
  for (const [x, y] of [[4, 4], [11, 4], [4, 11], [11, 11]]) pc.clearPx(x, y + dy)
  pc.hline(5, 10, 11 + dy, c.skinS)
  if (back) {
    // The back of the head is all hair.
    pc.rect(4, 3 + dy, 8, 8, c.hair)
    pc.hline(5, 10, 2 + dy, c.hair)
    pc.hline(4, 11, 10 + dy, c.hairS)
    pc.px(6, 4 + dy, c.hairL)
    if (look.style === 1) pc.rect(4, 11 + dy, 8, 3, c.hair)
    if (look.style === 2) pc.rect(6, 0 + dy, 4, 2, c.hairS)
  } else {
    const y = 8 + dy
    if (eyes === 'open') {
      pc.vline(6, y, y + 1, P.eye)
      pc.vline(9, y, y + 1, P.eye)
    } else if (eyes === 'happy') {
      pc.px(5, y + 1, P.eye)
      pc.px(6, y, P.eye)
      pc.px(7, y + 1, P.eye)
      pc.px(8, y + 1, P.eye)
      pc.px(9, y, P.eye)
      pc.px(10, y + 1, P.eye)
    } else if (eyes === 'sad') {
      pc.px(6, y + 1, P.eye)
      pc.px(9, y + 1, P.eye)
      pc.px(5, y, P.eye)
      pc.px(10, y, P.eye)
    } else {
      pc.hline(5, 6, y + 1, P.eye)
      pc.hline(9, 10, y + 1, P.eye)
    }
    pc.px(5, 10 + dy, P.blush)
    pc.px(10, 10 + dy, P.blush)
    // Hair: a cap over the top with a fringe.
    pc.hline(5, 10, 3 + dy, c.hair)
    pc.rect(4, 4 + dy, 8, 2, c.hair)
    pc.px(4, 6 + dy, c.hair)
    pc.px(11, 6 + dy, c.hair)
    pc.px(4, 7 + dy, c.hairS)
    pc.px(11, 7 + dy, c.hairS)
    pc.px(5, 6 + dy, c.hair)
    pc.px(8, 6 + dy, c.hairS)
    pc.px(9, 6 + dy, c.hair)
    pc.hline(6, 7, 4 + dy, c.hairL)
    if (look.style === 1) {
      pc.vline(3, 5 + dy, 13 + dy, c.hair)
      pc.vline(12, 5 + dy, 13 + dy, c.hair)
      pc.vline(4, 8 + dy, 12 + dy, c.hairS)
      pc.vline(11, 8 + dy, 12 + dy, c.hairS)
    }
    if (look.style === 2) pc.ellipse(8, 1.5 + dy, 2.2, 1.6, c.hair)
  }
  if (look.hat) {
    pc.hline(2, 13, 5 + dy, P.hat)
    pc.hline(3, 12, 6 + dy, shade(P.hat, -0.2))
    pc.rect(5, 1 + dy, 6, 4, P.hat)
    pc.hline(5, 10, 4 + dy, P.hatBand)
    pc.px(6, 1 + dy, shade(P.hat, 0.2))
  }
}

// ---------- side (drawn facing west; east is the mirror) ----------

function legsSide(pc, c, legs) {
  if (legs === 'sit') {
    pc.rect(3, 19, 6, 2, c.pants)
    pc.rect(2, 18, 2, 3, P.shoe)
    return
  }
  if (legs === 'crouch') {
    pc.rect(5, 19, 5, 3, c.pants)
    pc.rect(4, 22, 5, 2, P.shoe)
    return
  }
  if (legs === 'stand') {
    pc.rect(6, 18, 4, 4, c.pants)
    pc.vline(9, 18, 21, c.pantsS)
    pc.rect(5, 22, 4, 2, P.shoe)
    return
  }
  // Stride: one leg forward (left, the way we face), one back.
  const front = legs === 'stepL' ? c.pants : c.pantsS
  const rear = legs === 'stepL' ? c.pantsS : c.pants
  pc.rect(8, 18, 2, 2, rear)
  pc.rect(9, 20, 2, 2, rear)
  pc.rect(9, 22, 3, 1, P.shoe)
  pc.rect(6, 18, 2, 2, front)
  pc.rect(5, 20, 2, 2, front)
  pc.rect(3, 22, 4, 2, P.shoe)
}

function armSide(pc, c, mode, dy) {
  switch (mode) {
    case 'fwd':
      pc.rect(6, 13 + dy, 2, 2, c.shirtS)
      pc.rect(5, 15 + dy, 2, 1, c.shirtS)
      pc.px(4, 16 + dy, c.skin)
      break
    case 'back':
      pc.rect(8, 13 + dy, 2, 2, c.shirtS)
      pc.rect(9, 15 + dy, 2, 1, c.shirtS)
      pc.px(10, 16 + dy, c.skin)
      break
    case 'up':
      pc.rect(6, 8 + dy, 2, 5, c.shirtS)
      pc.px(6, 7 + dy, c.skin)
      break
    case 'hammerUp':
      pc.rect(5, 9 + dy, 2, 5, c.shirtS)
      pc.px(5, 8 + dy, c.skin)
      pc.vline(5, 4 + dy, 7 + dy, P.woodDark)
      pc.rect(3, 2 + dy, 5, 2, P.metal)
      pc.hline(3, 7, 3 + dy, P.metalDark)
      break
    case 'hammerDown':
      pc.rect(6, 13 + dy, 2, 2, c.shirtS)
      pc.rect(3, 15 + dy, 4, 1, c.shirtS)
      pc.px(2, 15 + dy, c.skin)
      pc.hline(0, 1, 15 + dy, P.woodDark)
      pc.rect(0, 16 + dy, 2, 3, P.metal)
      break
    default:
      pc.rect(7, 13 + dy, 2, 4, c.shirtS)
      pc.rect(7, 17 + dy, 2, 1, c.skin)
  }
}

function headSide(pc, c, look, dy, eyes) {
  pc.rect(4, 4 + dy, 8, 8, c.skin)
  for (const [x, y] of [[4, 4], [11, 4], [4, 11], [11, 11]]) pc.clearPx(x, y + dy)
  pc.px(3, 9 + dy, c.skin) // nose
  pc.hline(5, 10, 11 + dy, c.skinS)
  const y = 8 + dy
  if (eyes === 'open') pc.vline(5, y, y + 1, P.eye)
  else if (eyes === 'happy') {
    pc.px(4, y + 1, P.eye)
    pc.px(5, y, P.eye)
    pc.px(6, y + 1, P.eye)
  } else if (eyes === 'sad') {
    pc.px(5, y + 1, P.eye)
    pc.px(6, y, P.eye)
  } else pc.hline(5, 6, y + 1, P.eye)
  pc.px(6, 10 + dy, P.blush)
  pc.hline(5, 10, 3 + dy, c.hair)
  pc.rect(4, 4 + dy, 8, 2, c.hair)
  pc.rect(8, 6 + dy, 4, 4, c.hair)
  pc.hline(9, 11, 10 + dy, c.hairS)
  pc.px(4, 6 + dy, c.hair)
  pc.hline(6, 7, 4 + dy, c.hairL)
  if (look.style === 1) pc.rect(10, 6 + dy, 3, 8, c.hairS)
  if (look.style === 2) pc.ellipse(11.5, 3, 1.8, 1.8, c.hair)
  if (look.hat) {
    pc.hline(1, 12, 5 + dy, P.hat)
    pc.hline(2, 12, 6 + dy, shade(P.hat, -0.2))
    pc.rect(4, 1 + dy, 7, 4, P.hat)
    pc.hline(4, 10, 4 + dy, P.hatBand)
  }
}

function torsoSide(pc, c, dy) {
  pc.rect(6, 12 + dy, 4, 5, c.shirt)
  pc.vline(9, 12 + dy, 16 + dy, c.shirtS)
  pc.hline(6, 9, 17 + dy, c.pantsS)
}

/**
 * @param {object} look  from `lookFor(id)`
 * @param {string} anim  one of ANIM_FRAMES
 * @param {'n'|'e'|'s'|'w'} facing
 * @param {number} frame
 */
export function drawVillager(look, anim, facing, frame) {
  const poses = POSES[anim] || POSES.idle
  const pose = poses[((frame % poses.length) + poses.length) % poses.length]
  const c = colours(look)
  const pc = new PixelCanvas(VILLAGER_W, VILLAGER_H)
  const dy = pose.up
  if (facing === 'w' || facing === 'e') {
    legsSide(pc, c, pose.legs)
    torsoSide(pc, c, dy)
    armSide(pc, c, pose.armR, dy)
    headSide(pc, c, look, dy + pose.head, pose.eyes)
    pc.outline(P.outline)
    return facing === 'e' ? pc.flipX() : pc
  }
  const back = facing === 'n'
  legsFront(pc, c, pose.legs)
  if (back) {
    armFront(pc, c, 'L', pose.armR, dy)
    armFront(pc, c, 'R', pose.armL, dy)
  }
  torsoFront(pc, c, dy, back)
  if (!back) {
    armFront(pc, c, 'L', pose.armL, dy)
    armFront(pc, c, 'R', pose.armR, dy)
  }
  headFront(pc, c, look, dy + pose.head, pose.eyes, back)
  pc.outline(P.outline)
  return pc
}
