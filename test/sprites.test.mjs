import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { generate, paramKey } from '../src/render/sprites/registry.js'
import { DECO_VARIANTS, STATIC_VARIANTS, TILE_VARIANTS } from '../src/render/sprites/tiles.js'
import { BUILDING_W, buildingFrames, heightOf } from '../src/render/sprites/buildings.js'
import { ANIM_FRAMES, VILLAGER_H, VILLAGER_W } from '../src/render/sprites/villagers.js'
import { FLOWER_H, FLOWER_W } from '../src/render/sprites/flowers.js'
import { ACCENTS, BADGE, BUTTERFLIES, PETALS } from '../src/render/sprites/palette.js'
import { KINDS } from '../src/sim/building.js'
import { FLOWER_KINDS } from '../src/sim/flowers.js'
import { lookFor } from '../src/sim/villager.js'
import { FENCES } from '../src/sim/style.js'

const SRC = fileURLToPath(new URL('../src/', import.meta.url))

const opaque = (pc) => {
  let n = 0
  for (let i = 3; i < pc.data.length; i += 4) if (pc.data[i]) n++
  return n
}
/** Opaque pixels in the bottom `rows` rows: whatever stands on the ground touches it. */
const grounded = (pc, rows = 3) => {
  for (let y = pc.h - rows; y < pc.h; y++) for (let x = 0; x < pc.w; x++) if (pc.opaque(x, y)) return true
  return false
}
const same = (a, b) => a.w === b.w && a.h === b.h && a.data.every((v, i) => v === b.data[i])

const LOOKS = ['a', 'b', 'c', 'demo:1', 'demo:7'].map(lookFor)
const VARIANTS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 500, 996]

test('every ground tile is a full, opaque 16×16 square, and each variant is its own picture', () => {
  for (const [kind, n] of Object.entries(TILE_VARIANTS)) {
    const seen = []
    for (let v = 0; v < n; v++) {
      const pc = generate(`tile.${kind}.${v}`, 0, {})
      assert.equal(pc.w, 16)
      assert.equal(pc.h, 16)
      assert.equal(opaque(pc), 256, `tile.${kind}.${v} has holes`)
      assert.ok(!seen.some((o) => same(o, pc)), `tile.${kind}.${v} repeats an earlier variant`)
      seen.push(pc)
    }
  }
})

test('every decoration draws something inside its tile', () => {
  for (const [kind, n] of Object.entries(DECO_VARIANTS)) {
    for (let v = 0; v < n; v++) {
      const pc = generate(`deco.${kind}.${v}`, 0, {})
      assert.equal(pc.w, 16)
      assert.equal(pc.h, 16)
      assert.ok(opaque(pc) > 0, `deco.${kind}.${v} is empty`)
    }
  }
})

test('every style of fence draws every join, and a straight run meets the next tile\'s edge to edge', () => {
  for (let style = 0; style < FENCES.length; style++) {
    for (let mask = 0; mask < 16; mask++) assert.ok(opaque(generate(`fence.${style}.${mask}`, 0, {})) > 10, `fence.${style}.${mask}`)
    const across = generate(`fence.${style}.10`, 0, {})
    const down = generate(`fence.${style}.5`, 0, {})
    for (let y = 0; y < 16; y++) assert.equal(across.opaque(0, y), across.opaque(15, y), `${FENCES[style]} runs across unevenly`)
    for (let x = 0; x < 16; x++) assert.equal(down.opaque(x, 0), down.opaque(x, 15), `${FENCES[style]} runs down unevenly`)
  }
})

test('every fence join has grass at its foot, and every lawn\'s cover draws in every lawn', () => {
  for (let mask = 0; mask < 16; mask++) assert.ok(opaque(generate(`deco.verge.${mask}`, 0, { tone: 1 })) > 6, `verge ${mask}`)
  for (let tone = 0; tone < 3; tone++) {
    for (const kind of ['clover', 'lawnflowers', 'tuft']) {
      for (let v = 0; v < DECO_VARIANTS[kind]; v++) assert.ok(opaque(generate(`deco.${kind}.${v}`, 0, { tone })) > 3, `${kind}.${v} on lawn ${tone}`)
    }
  }
})

test('every lawn tone is its own green', () => {
  const tones = [0, 1, 2].map((tone) => generate('tile.yard.0', 0, { tone }))
  assert.ok(!same(tones[0], tones[1]) && !same(tones[1], tones[2]) && !same(tones[0], tones[2]))
})

test('a pond\'s bank draws for every combination of dry sides', () => {
  for (let mask = 1; mask < 16; mask++) {
    const pc = generate(`deco.shore.${mask}`, 0, {})
    assert.ok(opaque(pc) >= 16, `deco.shore.${mask} is missing its edge`)
  }
})

test('every static stands on the ground, lit or not', () => {
  for (const [sprite, n] of Object.entries(STATIC_VARIANTS)) {
    for (let v = 0; v < n; v++) {
      for (const lit of [false, true]) {
        const pc = generate(`static.${sprite}.${v}`, 0, { lit })
        assert.ok(opaque(pc) > 20, `static.${sprite}.${v} is nearly empty`)
        assert.ok(grounded(pc), `static.${sprite}.${v} floats`)
      }
    }
  }
})

test('every building, at every stage, is as tall as heightOf says and stands on the ground', () => {
  for (const kind of KINDS) {
    for (let stage = 0; stage <= 3; stage++) {
      for (const variant of VARIANTS) {
        for (const lit of [false, true]) {
          for (let frame = 0; frame < buildingFrames(kind, stage); frame++) {
            const name = `building.${kind}.${stage}`
            // Every wall material and roof family comes up across the variants.
            const style = { wall: variant % 5, roofs: variant % 4 }
            const pc = generate(name, frame, { accent: ACCENTS[variant % ACCENTS.length], variant, lit, ...style })
            assert.equal(pc.w, BUILDING_W, name)
            assert.equal(pc.h, heightOf(kind, variant), name)
            assert.ok(opaque(pc) > 100, `${name} v${variant} is nearly empty`)
            assert.ok(grounded(pc), `${name} v${variant} floats`)
          }
        }
      }
    }
  }
})

test('every villager frame, in every direction, keeps its feet on the ground', () => {
  for (const [anim, frames] of Object.entries(ANIM_FRAMES)) {
    for (const facing of ['n', 'e', 's', 'w']) {
      for (let frame = 0; frame < frames; frame++) {
        for (const look of LOOKS) {
          const pc = generate(`villager.${anim}.${facing}`, frame, { look })
          assert.equal(pc.w, VILLAGER_W)
          assert.equal(pc.h, VILLAGER_H)
          assert.ok(opaque(pc) > 60, `villager.${anim}.${facing}.${frame} is nearly empty`)
          assert.ok(grounded(pc), `villager.${anim}.${facing}.${frame} floats`)
        }
      }
    }
  }
})

test('every flower grows through all three stages', () => {
  for (let kind = 0; kind < FLOWER_KINDS.length; kind++) {
    for (let stage = 0; stage <= 2; stage++) {
      const pc = generate(`flower.${kind}.${stage}`, 0, { color: PETALS[kind % PETALS.length] })
      assert.equal(pc.w, FLOWER_W)
      assert.equal(pc.h, FLOWER_H)
      assert.ok(opaque(pc) > 3, `flower.${kind}.${stage} is empty`)
    }
  }
})

test('badges, rings and shadows draw', () => {
  for (const kind of Object.keys(BADGE)) assert.ok(opaque(generate(`fx.badge.${kind}`, 0, {})) > 50)
  assert.ok(opaque(generate('fx.z', 0, {})) > 5)
  assert.ok(opaque(generate(`fx.ring.${BADGE.waiting}`, 0, {})) > 10)
  const narrow = generate('fx.shadow.10', 0, {})
  assert.deepEqual([narrow.w, narrow.h], [10, 3])
  const wide = generate('fx.shadow.36x6', 0, {})
  assert.deepEqual([wide.w, wide.h], [36, 6])
})

test('butterflies and birds beat their wings', () => {
  for (let c = 0; c < BUTTERFLIES.length; c++) {
    const [up, down] = [0, 1].map((f) => generate(`fx.butterfly.${c}`, f, {}))
    assert.ok(opaque(up) > 4 && opaque(down) > 2 && !same(up, down), `butterfly ${c}`)
  }
  const [up, down] = [0, 1].map((f) => generate('fx.bird', f, {}))
  assert.ok(opaque(up) > 4 && !same(up, down))
})

test('drawing a sprite twice gives the same pixels', () => {
  const again = (name, frame, p) => assert.ok(same(generate(name, frame, p), generate(name, frame, p)), name)
  again('tile.wild.2', 0, {})
  again('building.house.3', 0, { accent: ACCENTS[0], variant: 42, lit: false })
  again('villager.walk.e', 1, { look: LOOKS[0] })
  again('static.tree.1', 0, {})
})

test('sprite params are part of the cache key, whatever order they come in', () => {
  assert.equal(paramKey({ a: 1, b: 2 }), paramKey({ b: 2, a: 1 }))
  assert.notEqual(paramKey({ lit: true }), paramKey({ lit: false }))
  assert.notEqual(paramKey({ look: LOOKS[0] }), paramKey({ look: LOOKS[1] }))
  assert.equal(paramKey(undefined), '')
})

test('colours are only ever written down in the palette', () => {
  const files = []
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name)
      if (statSync(p).isDirectory()) walk(p)
      else if (p.endsWith('.js')) files.push(p)
    }
  }
  walk(SRC)
  for (const file of files) {
    if (file.endsWith(join('sprites', 'palette.js'))) continue
    const text = readFileSync(file, 'utf8')
    assert.doesNotMatch(text, /['"`]#[0-9a-f]{3,8}['"`]/i, `${file} spells out a hex colour`)
    assert.doesNotMatch(text, /rgba?\(\s*\d/, `${file} spells out an rgb colour`)
  }
})
