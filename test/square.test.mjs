import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ARCH_H, ARCH_W, CENTER, GARDEN, PILLAR, SIZE, SPILL, archShoulder, arrivalSparkles, blossomCrowns, buntingStrings, crystalAt, fairyLights, gemAt,
  lampTop, makePigeons, motes, pennants, petals, pigeonCanStand, portalOpening, runePixels, spillColor, squarePixel, stepPigeons, veilColor,
} from '../src/render/square.js'
import { mulberry32 } from '../src/sim/rng.js'
import { PALETTE as P } from '../src/render/sprites/palette.js'
import { generate } from '../src/render/sprites/registry.js'
import { SQUARE_TILES } from '../src/render/sprites/tiles.js'
import { GATE_TILE, SQUARE_LAMPS, SQUARE_OBELISKS } from '../src/sim/constants.js'

const PALETTE_COLOURS = new Set(Object.values(P).flat().filter((c) => typeof c === 'string'))

test('every pixel of the square\'s floor is a palette colour, and every floor tile is solid', () => {
  for (let py = 0; py < SIZE; py += 3) for (let px = 0; px < SIZE; px += 3) assert.ok(PALETTE_COLOURS.has(squarePixel(px, py)), `${px},${py}`)
  for (let i = 0; i < SQUARE_TILES; i++) {
    const pc = generate(`tile.square.${i}`, 0, {})
    let solid = 0
    for (let k = 3; k < pc.data.length; k += 4) if (pc.data[k] === 255) solid++
    assert.equal(solid, 256, `tile.square.${i} has holes`)
  }
})

test('the mosaic is centred on the foot of the portal, where villagers step out', () => {
  assert.equal(CENTER.x, GATE_TILE.x * 16)
  assert.equal(CENTER.y, (Math.floor(GATE_TILE.y) + 1) * 16)
  // The star's centre is the portal's colour; well away from the mosaic it is plain paving.
  assert.equal(squarePixel(CENTER.x, CENTER.y), P.portalDeep)
  assert.ok([P.plaza, P.plazaLight, P.plazaDark, P.stoneLight, P.moss].includes(squarePixel(20, 100)))
})

test('the runes run all the way round their ring', () => {
  const runes = runePixels()
  assert.ok(runes.length > 40)
  const octants = new Set(runes.map(([, , a]) => Math.floor(((a + Math.PI) / (Math.PI * 2)) * 8) % 8))
  assert.equal(octants.size, 8)
  for (const [px, py] of runes) assert.equal(squarePixel(px, py), P.rune, `the glow at ${px},${py} is not over a carved rune`)
})

test('the portal\'s veil fills the way through the arch and nothing else', () => {
  const arch = generate('static.arch.0', 0, {})
  const rows = portalOpening()
  assert.ok(rows.length > 40)
  for (const [y, x0, x1] of rows) {
    assert.ok(y >= 0 && y < ARCH_H && x0 >= PILLAR && x1 < ARCH_W - PILLAR && x0 <= x1)
    // Under the name board, the whole opening is clear stone-free air for the veil to show in.
    if (y > 24) for (let x = x0; x <= x1; x++) assert.ok(!arch.opaque(x, y), `the arch covers the veil at ${x},${y}`)
  }
  // The walk-through point, a villager's height up from the arch's foot, is inside it.
  const gy = ARCH_H - 1 - 8
  assert.ok(rows.some(([y, x0, x1]) => y === gy && x0 <= ARCH_W / 2 && x1 >= ARCH_W / 2))
})

test('the veil shimmers, and flares brighter when somebody steps through', () => {
  let calm = 0
  let flaring = 0
  const seen = new Set()
  for (const [y, x0, x1] of portalOpening()) {
    for (let x = x0; x <= x1; x++) {
      const a = veilColor(x, y, 3.2, 0)
      const b = veilColor(x, y, 3.2, 1)
      for (const v of [a, b]) assert.ok(v[3] > 0 && v[3] <= 1 && v.slice(0, 3).every((c) => c >= 0 && c <= 255))
      calm += a[3] + a[0] + a[1] + a[2]
      flaring += b[3] + b[0] + b[1] + b[2]
      seen.add(a.slice(0, 3).join())
    }
  }
  assert.ok(flaring > calm * 1.1)
  assert.ok(seen.size > 20, 'a veil of one flat colour')
  assert.notDeepEqual(veilColor(30, 40, 1, 0), veilColor(30, 40, 1.5, 0))
})

test('the bunting hangs between the lampposts and up to the arch, inside the square', () => {
  const strings = buntingStrings()
  const ends = strings.map((pts) => [pts[0], pts[pts.length - 1]])
  const [tl, tr, bl, br] = SQUARE_LAMPS.map(lampTop)
  assert.deepEqual(ends, [[bl, br], [tl, archShoulder(-1)], [tr, archShoulder(1)]])
  // Clear of the keystone, whose gem the crystals' beams meet at.
  const [gx, gy] = gemAt()
  for (const pts of strings) for (const [x, y] of pts) assert.ok(Math.hypot(x - gx, y - gy) > 12, `bunting over the keystone at ${x},${y}`)
  for (const pts of strings) {
    for (const [x, y] of pts) assert.ok(x >= 0 && y >= 0 && x < SIZE && y < SIZE)
    // It sags: its middle hangs below the straight line between its ends.
    const mid = pts[pts.length >> 1]
    assert.ok(mid[1] > (pts[0][1] + pts[pts.length - 1][1]) / 2)
  }
  assert.ok(pennants().length > 30)
})

test('sparkles only rise while somebody is stepping through', () => {
  assert.deepEqual(arrivalSparkles(5, 0), [])
  const busy = arrivalSparkles(5, 1)
  assert.ok(busy.length > 5)
  for (const [x, y, a] of busy) assert.ok(x > 0 && x < SIZE && y > 0 && y <= CENTER.y && a >= 0 && a <= 1)
})

test('each corner of the square is a garden bed, its kerb round it', () => {
  const inset = 12
  for (const [x, y] of [[inset, inset], [SIZE - inset, inset], [inset, SIZE - inset], [SIZE - inset, SIZE - inset]]) {
    assert.ok(![P.plaza, P.plazaDark, P.plazaLight, P.stone, P.stoneDark].includes(squarePixel(x, y)), `no garden at ${x},${y}`)
  }
  // Between the top-left bed and the dais, paving again.
  const [x, y] = [20, 60]
  assert.ok(Math.hypot(x, y) > GARDEN + 8 && Math.hypot(x - CENTER.x, y - CENTER.y) > 70)
  assert.ok([P.plaza, P.plazaDark, P.plazaLight, P.stoneLight, P.moss].includes(squarePixel(x, y)))
})

test('crystals float over their obelisks, bobbing a little, and beams reach the portal\'s gem', () => {
  SQUARE_OBELISKS.forEach(([lx, ly], i) => {
    const ys = new Set()
    for (let t = 0; t < 6; t += 0.1) {
      const [x, y] = crystalAt(i, t)
      assert.equal(x, lx * 16 + 8)
      assert.ok(y < (ly + 1) * 16 - 30, 'a crystal sunk into its obelisk')
      ys.add(y)
    }
    assert.ok(ys.size > 1, 'a crystal that never bobs')
  })
  assert.ok(gemAt()[1] < CENTER.y - ARCH_H / 2)
})

test('petals fall from the blossom trees, and fairy lights hang along the bunting', () => {
  const crowns = blossomCrowns()
  assert.equal(crowns.length, 4)
  for (const [x, y, a] of petals(12.3)) {
    assert.ok(crowns.some(([cx, cy]) => Math.abs(x - cx) < 40 && y >= cy - 2 && y < cy + 40), `a petal adrift at ${x},${y}`)
    assert.ok(a >= 0 && a <= 1)
  }
  const on = new Set(buntingStrings().flat().map(([x, y]) => `${x},${y}`))
  for (const [x, y] of fairyLights()) assert.ok(on.has(`${x},${y}`))
  assert.ok(fairyLights().length > 15)
})

test('motes drift up round the portal, more of them by night', () => {
  assert.ok(motes(20, 1).length > motes(20, 0).length)
  for (const [x, y, a] of motes(20, 1)) assert.ok(x > 0 && x < SIZE && y < CENTER.y + 50 && a > 0 && a <= 1)
})

test('pigeons keep to open paving, and take off from anybody who comes near', () => {
  const rand = mulberry32(7)
  const birds = makePigeons(8, rand)
  assert.equal(birds.length, 8)
  for (const b of birds) assert.ok(pigeonCanStand(b.x, b.y))
  // Nobody about: they peck and wander, and never step off the paving.
  for (let i = 0; i < 600; i++) stepPigeons(birds, 1 / 30, [], rand)
  for (const b of birds) assert.ok(b.mode === 'fly' || pigeonCanStand(b.x, b.y), `a pigeon wandered to ${b.x},${b.y}`)
  // Somebody walks right up to one: it flies, and comes down somewhere it can stand, farther off.
  const b = birds[0]
  const walker = [b.x + 4, b.y]
  stepPigeons(birds, 1 / 30, [walker], rand)
  assert.equal(b.mode, 'fly')
  for (let i = 0; i < 90; i++) stepPigeons(birds, 1 / 30, [], rand)
  assert.equal(b.mode, 'peck')
  assert.ok(pigeonCanStand(b.x, b.y))
  assert.ok(Math.hypot(b.x - walker[0], b.y - walker[1]) > 18)
  // Nothing stands in the portal itself.
  assert.ok(!pigeonCanStand(CENTER.x, CENTER.y - 8))
})

test('the vortex fills its doorway: a bright seam all round the stone, darker just inside it', () => {
  const rows = portalOpening()
  const inside = new Set(rows.flatMap(([y, x0, x1]) => Array.from({ length: x1 - x0 + 1 }, (_, i) => `${x0 + i},${y}`)))
  const light = ([r, g, b]) => r + g + b
  let seam = 0
  let seamLight = 0
  let innerLight = 0
  let inner = 0
  for (const [y, x0, x1] of rows) {
    if (y < 24 || y >= ARCH_H - 1) continue // under the name board, and the threshold
    // The pixel beside the stone on each side is the seam; three in from it is the dark.
    for (const [sx, ix] of [[x0, x0 + 3], [x1, x1 - 3]]) {
      seam++
      seamLight += light(veilColor(sx, y, 2, 0))
      if (inside.has(`${ix},${y}`)) {
        inner++
        innerLight += light(veilColor(ix, y, 2, 0))
      }
    }
  }
  assert.ok(seamLight / seam > innerLight / inner, 'no seam of light round the vortex')
  // Both bottom corners are seam too: the vortex runs square into them, not round like a balloon.
  const [, x0, x1] = rows.at(-2)
  for (const x of [x0, x1]) assert.ok(light(veilColor(x, ARCH_H - 2, 2, 0)) >= seamLight / seam * 0.8)
})

test('the portal spills light onto the ground in front of it, fading away from it', () => {
  const [, x0, x1] = portalOpening().at(-1)
  const mid = Math.round((x0 + x1) / 2)
  const near = spillColor(mid, 0, 1, 0)
  const far = spillColor(mid, SPILL - 2, 1, 0)
  assert.ok(near && far && near[3] > far[3])
  assert.equal(spillColor(0, 0, 1, 0), null, 'light spilling past the pillars')
  assert.equal(spillColor(mid, SPILL, 1, 0), null)
  // A pool, not a slab: it narrows as it reaches out from the threshold.
  const width = (row) => Array.from({ length: ARCH_W }, (_, x) => spillColor(x, row, 1, 0)).filter(Boolean).length
  assert.ok(width(0) > width(SPILL - 2))
  assert.ok(spillColor(mid, 0, 1, 1)[3] > near[3], 'a flare throws more light')
})
