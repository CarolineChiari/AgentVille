import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DOORSTEP_CLEAR, ROOF_FAMILIES, chimneyOf, fitted, heightOf, houseSpec } from '../src/render/sprites/buildings.js'
import { ACCENTS, PALETTE as P } from '../src/render/sprites/palette.js'
import { generate } from '../src/render/sprites/registry.js'
import { KINDS } from '../src/sim/building.js'
import { WALLS } from '../src/sim/style.js'
import { World } from '../src/sim/world.js'

/** The highest row of a sprite with anything drawn in it. */
const topRow = (pc) => {
  for (let y = 0; y < pc.h; y++) for (let x = 0; x < pc.w; x++) if (pc.opaque(x, y)) return y
  return pc.h
}
/** A building as the renderer draws it: fitted to its slot, in its plot's style. */
const drawn = (kind, variant, roomy, stage = 3, style = { wall: variant % 5, roofs: variant % 4 }) => {
  const f = fitted(kind, variant, roomy)
  const pc = generate(`building.${f.kind}.${stage}`, 0, { accent: ACCENTS[variant % ACCENTS.length], variant, lit: false, ...style, low: f.low })
  return { ...f, pc, H: heightOf(f.kind, variant, f.low) }
}

const VARIANTS = Array.from({ length: 997 }, (_, i) => i)

test('a house is always built the same way on the same plot', () => {
  assert.deepEqual(houseSpec(123, 2, 1), houseSpec(123, 2, 1))
})

test('most of a plot\'s houses are built of its material, and every material turns up somewhere', () => {
  for (let wall = 0; wall < WALLS.length; wall++) {
    const own = VARIANTS.filter((v) => houseSpec(v, wall, 0).material === WALLS[wall]).length / VARIANTS.length
    assert.ok(own > 0.6 && own < 0.85, `${WALLS[wall]}: ${(own * 100).toFixed(0)}% of its plot's houses`)
  }
  const all = new Set(VARIANTS.map((v) => houseSpec(v, 0, 0).material))
  assert.equal(all.size, WALLS.length)
})

test('a plot\'s roofs all come from its family of colours', () => {
  ROOF_FAMILIES.forEach((family, roofs) => {
    const allowed = new Set(family.map((i) => P.roof[i]))
    const used = new Set(VARIANTS.map((v) => houseSpec(v, 0, roofs).roofColor))
    for (const c of used) assert.ok(allowed.has(c), `${c} is not in family ${roofs}`)
    assert.equal(used.size, family.length)
  })
})

test('houses differ: every roof shape, door layout and both heights turn up', () => {
  const specs = VARIANTS.map((v) => houseSpec(v, 0, 0))
  const seen = (f) => new Set(specs.map(f))
  assert.deepEqual([...seen((s) => s.roof.shape)].sort(), ['gable', 'hip', 'steep'])
  assert.deepEqual([...seen((s) => s.layout)].sort(), ['left', 'pair', 'right'])
  assert.deepEqual([...seen((s) => s.storeys)].sort(), [1, 2])
  for (const k of ['shutters', 'boxes', 'porch', 'dormer', 'woodDoor']) assert.equal(seen((s) => s[k]).size, 2, k)
})

test('a house is as tall as its storeys, and its chimney pokes out above its roof', () => {
  for (const v of VARIANTS) {
    const s = houseSpec(v, 0, 0)
    assert.equal(heightOf('house', v), s.H)
    const c = chimneyOf('house', v)
    if (!s.chimney) {
      assert.equal(c, null)
      continue
    }
    assert.ok(c.x > 0 && c.x < 32 && c.y >= 1 && c.y < s.wallTop, `house ${v}'s chimney is at ${c.x},${c.y}`)
  }
  assert.equal(chimneyOf('barn'), null)
})

test('down the sides of a courtyard, nothing a building draws reaches the doorstep of the house above', () => {
  for (const kind of KINDS) {
    for (let variant = 0; variant < 120; variant++) {
      for (let stage = 0; stage <= 3; stage++) {
        const { pc, H } = drawn(kind, variant, false, stage)
        assert.equal(H, 48, `a ${kind} down the side is ${H} px tall`)
        assert.equal(pc.h, 48)
        // Row 0 is the top of the walkway above; the villager at the door there stands on row 8.
        assert.ok(topRow(pc) >= DOORSTEP_CLEAR, `a ${kind} (v${variant}, stage ${stage}) reaches row ${topRow(pc)} of the walkway above`)
      }
    }
  }
})

test('in a real village, no building runs into the one above it or over its doorstep', () => {
  for (let n = 0; n < 12; n++) {
    const w = new World()
    w.setRoster(Array.from({ length: 17 }, (_, i) => ({ id: `cc:${n}-${i}`, project: `r${n}`, createdAt: i, status: 'idle', known: true })))
    const all = w.snapshot().buildings
    for (const b of all) {
      const above = all.find((a) => a !== b && a.x === b.x && a.y + a.h + 1 === b.y)
      if (!above) continue
      assert.equal(b.roomy, false, 'a building with another just above it thinks it has room')
      const { pc, H, kind } = drawn(b.kind, b.variant, b.roomy, 3, b.style)
      // Sprite row `r` sits `H - r` px above the building's base; the doorstep is the row above its footprint.
      const reach = H - topRow(pc) - b.h * 16
      assert.ok(reach <= 16 - DOORSTEP_CLEAR, `a ${kind} under a ${above.kind} reaches ${reach} px up the walkway`)
    }
  }
})

test('on the top row a windmill or a tower stands tall; down the sides it is something shorter', () => {
  for (const kind of ['windmill', 'tower']) {
    for (let v = 0; v < 20; v++) {
      assert.deepEqual(fitted(kind, v, true), { kind, low: false })
      const side = fitted(kind, v, false)
      assert.ok(heightOf(side.kind, v, side.low) === 48 && side.kind !== kind)
    }
  }
})

test('a house down the side keeps its looks and loses only its upstairs and a steep roof', () => {
  for (const v of VARIANTS) {
    const tall = houseSpec(v, 1, 2)
    const low = houseSpec(v, 1, 2, true)
    assert.equal(low.storeys, 1)
    assert.notEqual(low.roof.shape, 'steep')
    for (const k of ['material', 'roofColor', 'layout', 'shutters', 'boxes', 'porch', 'woodDoor']) assert.deepEqual(low[k], tall[k], `house ${v}'s ${k} changed`)
  }
})
