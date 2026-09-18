import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ROOF_FAMILIES, chimneyOf, heightOf, houseSpec } from '../src/render/sprites/buildings.js'
import { PALETTE as P } from '../src/render/sprites/palette.js'
import { WALLS } from '../src/sim/style.js'

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
