// Villagers: 16×24, feet on the bottom row. Every frame is drawn from a pose — where the body,
// legs and arms are — so a new animation is a new list of poses, not new art.
import { PALETTE as P, shade } from './palette.js'
import { PixelCanvas } from './pixel.js'
import { EXTRAS, HATS, TOPS } from '../../sim/villager.js'

export const VILLAGER_W = 16
export const VILLAGER_H = 24
export const ANIM_FRAMES = { walk: 4, idle: 2, hammer: 2, sit: 1, jump: 2, slump: 1, wave: 2 }

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
  wave: [
    { up: 0, head: 0, legs: 'stand', armL: 'down', armR: 'up', eyes: 'happy' },
    { up: 0, head: 0, legs: 'stand', armL: 'down', armR: 'upOut', eyes: 'happy' },
  ],
}

/**
 * A hard hat's colour by the villager's hat-colour draw (0–9): yellow for half the crew, then white,
 * orange, blue and green, as a site's colour-coding runs. See `hardHat` in the palette.
 */
const HARD_HATS = [0, 0, 0, 0, 0, 1, 1, 2, 3, 4]

function colours(look) {
  const skin = P.skin[look.skin % P.skin.length]
  const hair = P.hair[look.hair % P.hair.length]
  const shirt = P.cloth[look.shirt % P.cloth.length]
  const pants = P.pants[look.pants % P.pants.length]
  const kind = HATS[look.hat]
  const hat = kind === 'hardhat' ? P.hardHat[HARD_HATS[(look.hatColor || 0) % HARD_HATS.length]]
    // A circlet is mithril whoever wears it: an elf's own hat colour on it read as a headband.
    : kind === 'circlet' ? P.mithril
      : look.hat === 1 ? P.hat : P.cloth[(look.hatColor || 0) % P.cloth.length]
  const vest = P.hiVis[(look.vest || 0) % P.hiVis.length]
  // A theme's second uniform colour, on the same draw as the vest's: greenleaf or twilight.
  const cloak = P.elfCloak[(look.vest || 0) % P.elfCloak.length]
  // Vests and scarves: a colour well away from the shirt's in the list.
  const second = P.cloth[(look.shirt + 5) % P.cloth.length]
  return {
    skin, skinS: shade(skin, -0.14),
    hair, hairS: shade(hair, -0.25), hairL: shade(hair, 0.18),
    shirt, shirtS: shade(shirt, -0.2), shirtL: shade(shirt, 0.18),
    pants, pantsS: shade(pants, -0.25),
    shoe: P.shoes[(look.shoe || 0) % P.shoes.length],
    hat, hatS: shade(hat, -0.2), hatL: shade(hat, 0.2),
    stripe: shade(shirt, 0.45),
    second, secondS: shade(second, -0.2),
    vest, vestS: shade(vest, -0.18),
    cloak, cloakS: shade(cloak, -0.22), cloakL: shade(cloak, 0.2),
  }
}

/** Poses whose legs are straight, so a tall villager's show it. */
const STANDING = new Set(['stand', 'stepL', 'stepR'])

// ---------- front / back (s, n) ----------

function legsFront(pc, c, legs) {
  const leg = (x0, top, shoeY, dark) => {
    pc.rect(x0, top, 3, shoeY - top, dark ? c.pantsS : c.pants)
    pc.rect(x0, shoeY, 3, 2, c.shoe)
  }
  if (legs === 'sit') {
    pc.rect(5, 19, 6, 2, c.pants)
    pc.rect(5, 21, 2, 1, c.shoe)
    pc.rect(9, 21, 2, 1, c.shoe)
    return
  }
  if (legs === 'crouch') {
    pc.rect(4, 19, 8, 3, c.pants)
    pc.px(7, 21, c.pantsS)
    pc.px(8, 21, c.pantsS)
    pc.rect(4, 22, 3, 2, c.shoe)
    pc.rect(9, 22, 3, 2, c.shoe)
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
    case 'upOut':
      break // drawn after the head by raisedArm, or long hair would hide it
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

/** A raised arm, clear of the head and hair: shoulder, elbow out, forearm up, hand. */
function raisedArm(pc, c, side, mode, dy) {
  if (mode !== 'up' && mode !== 'upOut') return
  const x = side === 'L' ? 4 : 11
  const o = side === 'L' ? -1 : 1
  pc.px(x, 12 + dy, c.shirt)
  pc.px(x + o, 11 + dy, c.shirt)
  if (mode === 'up') {
    pc.vline(x + 2 * o, 6 + dy, 10 + dy, c.shirt)
    pc.px(x + 2 * o, 5 + dy, c.skin)
  } else {
    pc.px(x + 2 * o, 10 + dy, c.shirt)
    pc.vline(x + 3 * o, 7 + dy, 9 + dy, c.shirt)
    pc.px(x + 3 * o, 6 + dy, c.skin)
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
}

// ---------- side (drawn facing west; east is the mirror) ----------

function legsSide(pc, c, legs) {
  if (legs === 'sit') {
    pc.rect(3, 19, 6, 2, c.pants)
    pc.rect(2, 18, 2, 3, c.shoe)
    return
  }
  if (legs === 'crouch') {
    pc.rect(5, 19, 5, 3, c.pants)
    pc.rect(4, 22, 5, 2, c.shoe)
    return
  }
  if (legs === 'stand') {
    pc.rect(6, 18, 4, 4, c.pants)
    pc.vline(9, 18, 21, c.pantsS)
    pc.rect(5, 22, 4, 2, c.shoe)
    return
  }
  // Stride: one leg forward (left, the way we face), one back.
  const front = legs === 'stepL' ? c.pants : c.pantsS
  const rear = legs === 'stepL' ? c.pantsS : c.pants
  pc.rect(8, 18, 2, 2, rear)
  pc.rect(9, 20, 2, 2, rear)
  pc.rect(9, 22, 3, 1, c.shoe)
  pc.rect(6, 18, 2, 2, front)
  pc.rect(5, 20, 2, 2, front)
  pc.rect(3, 22, 4, 2, c.shoe)
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
    case 'upOut':
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
}

function torsoSide(pc, c, dy) {
  pc.rect(6, 12 + dy, 4, 5, c.shirt)
  pc.vline(9, 12 + dy, 16 + dy, c.shirtS)
  pc.hline(6, 9, 17 + dy, c.pantsS)
}

// ---------- what they wear ----------

/** The hat, if any, over the head just drawn. `view` is 'front', 'back' or 'side' (facing west). */
function hat(pc, c, look, dy, view) {
  const kind = HATS[look.hat] || 'none'
  const side = view === 'side'
  if (kind === 'straw') {
    if (side) {
      pc.hline(1, 12, 5 + dy, c.hat)
      pc.hline(2, 12, 6 + dy, c.hatS)
      pc.rect(4, 1 + dy, 7, 4, c.hat)
      pc.hline(4, 10, 4 + dy, P.hatBand)
    } else {
      pc.hline(2, 13, 5 + dy, c.hat)
      pc.hline(3, 12, 6 + dy, c.hatS)
      pc.rect(5, 1 + dy, 6, 4, c.hat)
      pc.hline(5, 10, 4 + dy, P.hatBand)
      pc.px(6, 1 + dy, c.hatL)
    }
  } else if (kind === 'cap') {
    if (side) {
      pc.rect(5, 2 + dy, 7, 3, c.hat)
      pc.hline(1, 5, 5 + dy, c.hatS) // the peak, out front
      pc.px(8, 2 + dy, c.hatL)
    } else {
      pc.rect(5, 2 + dy, 6, 3, c.hat)
      pc.hline(4, 11, 4 + dy, c.hat)
      pc.px(7, 2 + dy, c.hatL)
      if (view === 'front') pc.hline(4, 11, 5 + dy, c.hatS)
      else pc.hline(6, 9, 5 + dy, c.hatS)
    }
  } else if (kind === 'beanie') {
    const cx = side ? 7.5 : 8
    pc.ellipse(cx, 3.5 + dy, 4.3, 2.6, c.hat)
    pc.hline(4, 11, 5 + dy, c.hatS)
    for (let x = 5; x <= 10; x += 2) pc.px(x, 3 + dy, c.hatS)
    pc.hline(7, 8, 0 + dy, c.hatL)
  } else if (kind === 'hardhat') {
    // A dome with a ridge down the middle and a brim all round, a peak out over the eyes.
    pc.hline(6, 9, 1 + dy, c.hat)
    pc.hline(5, 10, 2 + dy, c.hat)
    pc.rect(4, 3 + dy, 8, 2, c.hat)
    pc.vline(11, 3 + dy, 4 + dy, c.hatS)
    pc.px(10, 2 + dy, c.hatS)
    pc.vline(7, 1 + dy, 4 + dy, c.hatL)
    if (side) {
      pc.hline(1, 11, 5 + dy, c.hatS)
      pc.hline(1, 3, 5 + dy, c.hat)
    } else {
      pc.vline(8, 1 + dy, 2 + dy, c.hatL)
      pc.hline(3, 12, 5 + dy, c.hatS)
      if (view === 'front') pc.hline(5, 10, 5 + dy, c.hat)
    }
  } else if (kind === 'circlet') {
    // A fillet of mithril across the brow, rising to a single leaf over the forehead. It sits on
    // the hair rather than covering it: an elf's hair is half of what says elf.
    // Row 6 is the brow: under the hair's fringe and above the eyes. Higher up, the band sat on
    // top of the head and read as a white cap.
    pc.hline(4, 11, 6 + dy, c.hat)
    pc.px(4, 6 + dy, c.hatL)
    pc.px(11, 6 + dy, c.hatS)
    // A leaf swept back from the temple, on the side you can see.
    const x = view === 'back' || side ? 4 : 11
    const o = x === 4 ? -1 : 1
    pc.px(x, 5 + dy, c.hatL)
    pc.px(x + o, 5 + dy, c.hat)
    pc.px(x + o, 4 + dy, c.hatL)
  } else if (kind === 'bow') {
    // A bow in the hair, on the side you can see.
    const x = view === 'back' ? 5 : 10
    for (const [dx, ddy] of [[-1, -1], [-1, 0], [-1, 1], [1, -1], [1, 0], [1, 1]]) pc.px(x + dx, 3 + ddy + dy, c.hat)
    pc.px(x, 3 + dy, c.hatS)
  }
}

/** A top over the shirt: stripes, overalls, an apron or a vest. */
function topFront(pc, c, look, dy, back) {
  const t = TOPS[look.top] || 'plain'
  if (t === 'stripes') for (const y of [13, 15]) pc.hline(5, 10, y + dy, c.stripe)
  if (t === 'overalls') {
    if (back) {
      pc.line(6, 12 + dy, 9, 16 + dy, c.pants)
      pc.line(9, 12 + dy, 6, 16 + dy, c.pants)
    } else {
      pc.rect(6, 14 + dy, 4, 3, c.pants)
      for (const x of [6, 9]) pc.vline(x, 12 + dy, 13 + dy, c.pants)
      pc.px(7, 15 + dy, c.pantsS)
    }
  }
  if (t === 'apron') {
    if (back) pc.hline(5, 10, 15 + dy, P.plaster)
    else {
      pc.rect(6, 14 + dy, 4, 6, P.plaster)
      pc.vline(9, 14 + dy, 19 + dy, P.plasterShade)
      for (const x of [6, 9]) pc.px(x, 13 + dy, P.plaster)
    }
  }
  if (t === 'vest') {
    if (back) pc.rect(5, 13 + dy, 6, 4, c.second)
    else {
      for (const x of [5, 6]) pc.vline(x, 13 + dy, 16 + dy, c.second)
      pc.vline(9, 13 + dy, 16 + dy, c.second)
      pc.vline(10, 13 + dy, 16 + dy, c.secondS)
    }
  }
  if (t === 'cloak') {
    // A travelling cloak: the hood folded back over the shoulders, and the cloth hanging past the
    // waist. Worn open down the front, so the shirt still shows between its edges and the villager
    // doesn't lose the colour that tells it from the next one.
    if (back) {
      pc.rect(4, 12 + dy, 8, 7, c.cloak)
      pc.hline(4, 11, 11 + dy, c.cloakL) // the hood, lying across the shoulders
      pc.hline(4, 11, 12 + dy, c.cloakL)
      pc.vline(11, 13 + dy, 18 + dy, c.cloakS)
      pc.hline(4, 11, 18 + dy, c.cloakS)
    } else {
      for (const [x, k] of [[3, c.cloakS], [4, c.cloak], [5, c.cloakL], [10, c.cloakL], [11, c.cloak], [12, c.cloakS]]) pc.vline(x, 12 + dy, 18 + dy, k)
      for (const x of [3, 12]) pc.px(x, 18 + dy, c.cloakS)
      pc.hline(4, 11, 11 + dy, c.cloakL)
      pc.hline(6, 9, 12 + dy, c.cloak)
      pc.px(7, 12 + dy, P.mithril) // the leaf brooch at the throat
      pc.px(8, 12 + dy, P.mithrilDark)
    }
  }
  if (t === 'hivis') {
    // A hi-vis vest: silver bands over the shoulders and one round the middle.
    pc.rect(5, 12 + dy, 6, 5, c.vest)
    pc.vline(10, 12 + dy, 16 + dy, c.vestS)
    pc.hline(5, 10, 15 + dy, P.reflective)
    for (const x of [6, 9]) pc.vline(x, 12 + dy, 14 + dy, P.reflective)
    if (!back) {
      // Open at the neck, over the shirt.
      pc.px(7, 12 + dy, c.shirt)
      pc.px(8, 12 + dy, c.shirtS)
    }
  }
}

function topSide(pc, c, look, dy) {
  const t = TOPS[look.top] || 'plain'
  if (t === 'stripes') for (const y of [13, 15]) pc.hline(6, 9, y + dy, c.stripe)
  if (t === 'overalls') {
    pc.rect(6, 14 + dy, 2, 3, c.pants)
    pc.vline(7, 12 + dy, 13 + dy, c.pants)
  }
  if (t === 'apron') pc.rect(5, 14 + dy, 2, 6, P.plaster)
  if (t === 'vest') {
    pc.vline(6, 13 + dy, 16 + dy, c.second)
    pc.vline(9, 13 + dy, 16 + dy, c.secondS)
  }
  if (t === 'cloak') {
    // Side on, the cloak is a panel down the back with the hood bunched at the shoulder.
    pc.vline(10, 12 + dy, 18 + dy, c.cloak)
    pc.vline(11, 13 + dy, 18 + dy, c.cloakS)
    pc.hline(6, 10, 12 + dy, c.cloakL)
    pc.px(5, 13 + dy, P.mithril)
  }
  if (t === 'hivis') {
    pc.rect(6, 12 + dy, 4, 5, c.vest)
    pc.vline(9, 12 + dy, 16 + dy, c.vestS)
    pc.hline(6, 9, 15 + dy, P.reflective)
    pc.vline(7, 12 + dy, 14 + dy, P.reflective)
  }
}

/** Worn round the body, under the arms: a scarf or a satchel. */
function wrapFront(pc, c, look, dy, back) {
  const e = EXTRAS[look.extra]
  if (e === 'scarf') {
    pc.hline(4, 11, 12 + dy, c.second)
    const tail = back ? 6 : 9
    pc.vline(tail, 13 + dy, 14 + dy, c.secondS)
  }
  if (e === 'satchel') {
    pc.line(back ? 10 : 5, 12 + dy, back ? 6 : 9, 16 + dy, P.woodDark)
    pc.rect(back ? 3 : 10, 15 + dy, 3, 3, P.wood)
    pc.hline(back ? 3 : 10, back ? 5 : 12, 15 + dy, P.woodLight)
  }
}

function wrapSide(pc, c, look, dy) {
  const e = EXTRAS[look.extra]
  if (e === 'scarf') {
    pc.hline(5, 10, 12 + dy, c.second)
    pc.px(10, 13 + dy, c.secondS)
    pc.px(11, 14 + dy, c.secondS)
  }
  if (e === 'satchel') {
    pc.line(7, 12 + dy, 9, 15 + dy, P.woodDark)
    pc.rect(9, 15 + dy, 3, 3, P.wood)
    pc.hline(9, 11, 15 + dy, P.woodLight)
  }
}

/** On the face, drawn over it: glasses or a beard. */
function faceFront(pc, c, look, dy) {
  const e = EXTRAS[look.extra]
  if (e === 'glasses') for (const x of [5, 7, 8, 10]) pc.vline(x, 8 + dy, 9 + dy, P.metalDark)
  if (e === 'beard') {
    pc.rect(5, 10 + dy, 6, 2, c.hair)
    pc.vline(4, 7 + dy, 10 + dy, c.hair)
    pc.vline(11, 7 + dy, 10 + dy, c.hair)
    pc.hline(7, 8, 10 + dy, c.hairS)
  }
}

function faceSide(pc, c, look, dy) {
  const e = EXTRAS[look.extra]
  if (e === 'glasses') {
    pc.vline(4, 8 + dy, 9 + dy, P.metalDark)
    pc.vline(6, 8 + dy, 9 + dy, P.metalDark)
    pc.hline(7, 9, 8 + dy, P.metalDark)
  }
  if (e === 'beard') {
    pc.rect(4, 10 + dy, 5, 2, c.hair)
    pc.px(3, 10 + dy, c.hair)
    pc.vline(8, 8 + dy, 9 + dy, c.hair)
  }
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
  // A tall villager stands a pixel higher on longer legs; sitting or crouching, it doesn't show.
  const lift = look.tall && STANDING.has(pose.legs) ? 1 : 0
  const dy = pose.up - lift
  const hy = dy + pose.head
  if (facing === 'w' || facing === 'e') {
    legsSide(pc, c, pose.legs)
    if (lift) pc.hline(6, 9, 17, c.pants)
    torsoSide(pc, c, dy)
    topSide(pc, c, look, dy)
    wrapSide(pc, c, look, dy)
    armSide(pc, c, pose.armR, dy)
    headSide(pc, c, look, hy, pose.eyes)
    faceSide(pc, c, look, hy)
    hat(pc, c, look, hy, 'side')
    pc.outline(P.outline)
    return facing === 'e' ? pc.flipX() : pc
  }
  const back = facing === 'n'
  legsFront(pc, c, pose.legs)
  if (lift) pc.hline(5, 10, 17, c.pants)
  if (back) {
    armFront(pc, c, 'L', pose.armR, dy)
    armFront(pc, c, 'R', pose.armL, dy)
  }
  torsoFront(pc, c, dy, back)
  topFront(pc, c, look, dy, back)
  wrapFront(pc, c, look, dy, back)
  if (!back) {
    armFront(pc, c, 'L', pose.armL, dy)
    armFront(pc, c, 'R', pose.armR, dy)
  }
  headFront(pc, c, look, hy, pose.eyes, back)
  if (!back) faceFront(pc, c, look, hy)
  hat(pc, c, look, hy, back ? 'back' : 'front')
  raisedArm(pc, c, back ? 'R' : 'L', pose.armL, dy)
  raisedArm(pc, c, back ? 'L' : 'R', pose.armR, dy)
  pc.outline(P.outline)
  return pc
}
