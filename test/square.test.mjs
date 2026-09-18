import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ARCH_H, ARCH_W, CENTER, PILLAR, SIZE, archTop, arrivalSparkles, buntingStrings, lampTop, pennants, portalOpening, runePixels, squarePixel, veilColor } from '../src/render/square.js'
import { PALETTE as P } from '../src/render/sprites/palette.js'
import { generate } from '../src/render/sprites/registry.js'
import { SQUARE_TILES } from '../src/render/sprites/tiles.js'
import { GATE_TILE, SQUARE_LAMPS } from '../src/sim/constants.js'

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
  assert.deepEqual(ends, [[tl, tr], [bl, br], [tl, archTop()], [tr, archTop()]])
  for (const pts of strings) {
    for (const [x, y] of pts) assert.ok(x >= 0 && y >= 0 && x < SIZE && y < SIZE)
    // It sags: its middle hangs below the straight line between its ends.
    const mid = pts[pts.length >> 1]
    assert.ok(mid[1] > (pts[0][1] + pts[pts.length - 1][1]) / 2)
  }
  assert.ok(pennants().length > 40)
})

test('sparkles only rise while somebody is stepping through', () => {
  assert.deepEqual(arrivalSparkles(5, 0), [])
  const busy = arrivalSparkles(5, 1)
  assert.ok(busy.length > 5)
  for (const [x, y, a] of busy) assert.ok(x > 0 && x < SIZE && y > 0 && y <= CENTER.y && a >= 0 && a <= 1)
})
