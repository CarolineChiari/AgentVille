// Every theme's pack, held to the rules the renderer relies on. A new theme is covered here the
// moment it is registered in src/sim/themes.js and src/render/themes/index.js.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generate } from '../src/render/sprites/registry.js'
import { ACCENTS, PALETTE as P } from '../src/render/sprites/palette.js'
import { BUILDING_W, DOORSTEP_CLEAR } from '../src/render/sprites/buildings.js'
import { VILLAGER_H, VILLAGER_W } from '../src/render/sprites/villagers.js'
import { FLOWER_H, FLOWER_W } from '../src/render/sprites/flowers.js'
import { PETALS } from '../src/render/sprites/palette.js'
import { FLOWER_KINDS, WORK } from '../src/sim/flowers.js'
import { PACKS, landmarkShapes, packFor } from '../src/render/themes/index.js'
import { STATIC_VARIANTS } from '../src/render/sprites/tiles.js'
import { MAX_TIER } from '../src/sim/progress.js'
import { THEMES, THEME_IDS, dress } from '../src/sim/themes.js'
import { KINDS } from '../src/sim/building.js'
import { lookFor } from '../src/sim/villager.js'
import { KEPT, WEAR } from '../src/sim/wear.js'

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
const topRow = (pc) => {
  for (let y = 0; y < pc.h; y++) for (let x = 0; x < pc.w; x++) if (pc.opaque(x, y)) return y
  return pc.h
}
const same = (a, b) => a.w === b.w && a.h === b.h && a.data.every((v, i) => v === b.data[i])
const colours = (pc) => {
  const out = new Set()
  for (let i = 0; i < pc.data.length; i += 4) {
    if (!pc.data[i + 3]) continue
    out.add(`#${[0, 1, 2].map((k) => pc.data[i + k].toString(16).padStart(2, '0')).join('')}`)
  }
  return out
}
const PALETTE_COLOURS = new Set(Object.values(P).flat().filter((c) => typeof c === 'string').map((c) => c.toLowerCase()))
const VARIANTS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 500, 996]

for (const id of THEME_IDS) {
  const pack = packFor(id)
  const { dims, subthemes } = THEMES[id]
  const B = pack.buildings
  const at = (name, frame = 0, p = {}) => generate(name, frame, { ...p, theme: id })
  /** A building's params as a plot in this theme would give them. */
  const look = (variant, f, extra = {}) => ({
    accent: ACCENTS[variant % ACCENTS.length], variant, lit: variant % 2 === 1, wall: variant % dims.wall.length, roofs: variant % dims.roofs, low: f.low,
    wear: variant % WEAR.length, ...extra,
  })

  test(`${id}: has a pack of its own`, () => {
    assert.equal(PACKS[id]?.id, id)
    for (const k of ['fitted', 'heightOf', 'shadowOf', 'frames', 'chimneyOf']) assert.equal(typeof B[k], 'function', k)
    assert.ok(PALETTE_COLOURS.has(pack.edges.road.toLowerCase()), 'its road edge is not a palette colour')
  })

  test(`${id}: every building, at every stage and in every look, is as tall as heightOf says and stands on the ground`, () => {
    for (const kind of KINDS) {
      for (const roomy of [true, false]) {
        for (const variant of VARIANTS) {
          const f = B.fitted(kind, variant, roomy)
          const H = B.heightOf(f.kind, variant, f.low)
          for (let stage = 0; stage <= 3; stage++) {
            for (let frame = 0; frame < B.frames(f.kind, stage); frame++) {
              const name = `building.${f.kind}.${stage}`
              const pc = at(name, frame, look(variant, f))
              assert.equal(pc.w, BUILDING_W, name)
              assert.equal(pc.h, H, `${name} v${variant}`)
              assert.ok(opaque(pc) > 100, `${name} v${variant} is nearly empty`)
              assert.ok(grounded(pc), `${name} v${variant} floats`)
            }
          }
        }
      }
    }
  })

  test(`${id}: down the sides of a courtyard, nothing a building draws reaches the doorstep of the one above`, () => {
    for (const kind of KINDS) {
      for (let variant = 0; variant < 60; variant++) {
        const f = B.fitted(kind, variant, false)
        assert.equal(B.heightOf(f.kind, variant, f.low), 48, `a ${kind} (${f.kind}) down the side`)
        for (let stage = 0; stage <= 3; stage++) {
          for (const wear of [KEPT, WEAR.length - 1]) {
            const pc = at(`building.${f.kind}.${stage}`, 0, look(variant, f, { wear }))
            assert.ok(topRow(pc) >= DOORSTEP_CLEAR, `a ${f.kind} (v${variant}, stage ${stage}) reaches row ${topRow(pc)} of the walkway above`)
          }
        }
      }
    }
  })

  test(`${id}: smoke comes out of the building, and an animated one moves between its frames`, () => {
    for (const kind of KINDS) {
      for (const roomy of [true, false]) {
        for (let variant = 0; variant < 40; variant++) {
          const f = B.fitted(kind, variant, roomy)
          const p = look(variant, f, { wear: KEPT, lit: false })
          const c = B.chimneyOf(f.kind, variant, p.wall, p.roofs, f.low)
          if (c) {
            const pc = at(`building.${f.kind}.3`, 0, p)
            let near = false
            for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) near ||= pc.opaque(c.x + dx, c.y + dy)
            assert.ok(near, `a ${f.kind}'s smoke starts at ${c.x},${c.y}, in thin air`)
          }
          const n = B.frames(f.kind, 3)
          if (n > 1) assert.ok(!same(at(`building.${f.kind}.3`, 0, p), at(`building.${f.kind}.3`, 1, p)), `a ${f.kind}'s frames are the same`)
        }
      }
    }
  })

  test(`${id}: every landmark is a building's width, as tall as its tier says, stands on the ground, and each tier stands taller`, () => {
    const L = landmarkShapes(id)
    for (const k of ['heightOf', 'shadowOf', 'frames']) assert.equal(typeof L[k], 'function', k)
    // Its footprint is two rows down the field: any taller would reach the top houses' doorsteps.
    assert.ok(L.heightOf(MAX_TIER) <= 72, `the top tier is ${L.heightOf(MAX_TIER)} px tall`)
    for (let tier = 0; tier <= MAX_TIER; tier++) {
      if (tier > 0) assert.ok(L.heightOf(tier) > L.heightOf(tier - 1), `tier ${tier} is no taller than tier ${tier - 1}`)
      for (const variant of VARIANTS) {
        const p = { accent: ACCENTS[variant % ACCENTS.length], variant, wall: variant % dims.wall.length, roofs: variant % dims.roofs, lit: variant % 2 === 1, busy: variant % 3 === 0 }
        for (let stage = 0; stage <= 3; stage++) {
          for (let frame = 0; frame < L.frames(tier, stage); frame++) {
            const name = `landmark.${tier}.${stage}`
            const pc = at(name, frame, p)
            assert.equal(pc.w, BUILDING_W, name)
            assert.equal(pc.h, L.heightOf(tier), `${name} v${variant}`)
            assert.ok(opaque(pc) > 40, `${name} v${variant} is nearly empty`)
            assert.ok(grounded(pc), `${name} v${variant} floats`)
          }
        }
        assert.ok(!same(at(`landmark.${tier}.2`, 0, p), at(`landmark.${tier}.3`, 0, p)), `tier ${tier} v${variant} is finished while it is still going up`)
      }
      // Somebody in, after dark: whatever animates moves between its frames.
      const busy = { accent: ACCENTS[0], variant: 0, wall: 0, roofs: 0, lit: true, busy: true }
      if (L.frames(tier, 3) > 1) assert.ok(!same(at(`landmark.${tier}.3`, 0, busy), at(`landmark.${tier}.3`, 1, busy)), `tier ${tier}'s frames are the same`)
    }
  })

  test(`${id}: what a landmark brings to its plot stands on the ground, lit or not`, () => {
    for (const sprite of ['yardlamp', 'yardbench', 'yardplanter', 'gateway']) {
      for (let v = 0; v < STATIC_VARIANTS[sprite]; v++) {
        for (const lit of [false, true]) {
          const pc = at(`static.${sprite}.${v}`, 0, { lit })
          assert.ok(opaque(pc) > 20, `${sprite} ${v} is nearly empty`)
          assert.ok(grounded(pc), `${sprite} ${v} floats`)
        }
      }
    }
  })

  test(`${id}: every fence draws every join, and a straight run meets the next tile edge to edge`, () => {
    dims.fence.forEach((name, style) => {
      for (let mask = 0; mask < 16; mask++) assert.ok(opaque(at(`fence.${style}.${mask}`)) > 10, `${name} ${mask}`)
      const across = at(`fence.${style}.10`)
      const down = at(`fence.${style}.5`)
      for (let y = 0; y < 16; y++) assert.equal(across.opaque(0, y), across.opaque(15, y), `${name} runs across unevenly`)
      for (let x = 0; x < 16; x++) assert.equal(down.opaque(x, 0), down.opaque(x, 15), `${name} runs down unevenly`)
    })
  })

  test(`${id}: plot ground, footpaths and roads are full 16×16 tiles, and each variant is its own`, () => {
    const full = (pc, name) => {
      assert.equal(pc.w, 16, name)
      assert.equal(pc.h, 16, name)
      assert.equal(opaque(pc), 256, `${name} has holes`)
    }
    const firsts = []
    dims.yard.forEach((ground, tone) => {
      const seen = []
      for (let v = 0; v < 6; v++) {
        const pc = at(`tile.yard.${v}`, 0, { tone })
        full(pc, `${ground} ${v}`)
        assert.ok(!seen.some((o) => same(o, pc)), `${ground} ${v} repeats an earlier variant`)
        seen.push(pc)
      }
      firsts.push(seen[0])
      for (let v = 0; v < 4; v++) for (let links = 0; links < 16; links++) full(at(`tile.trail.${v}`, 0, { links, tone }), `${ground} footpath ${v}/${links}`)
      // The tint pass repaints the plain colours in patches: they have to be in the ground to find.
      const [plain, sunny, lush] = pack.patches(tone)
      assert.ok(plain.length && plain.length === sunny.length && plain.length === lush.length, `${ground}'s patches don't pair up`)
      const drawn = new Set([...seen.flatMap((pc) => [...colours(pc)])])
      assert.ok(plain.some((c) => drawn.has(c.toLowerCase())), `none of ${ground}'s plain colours are in its tiles`)
    })
    firsts.forEach((a, i) => firsts.forEach((b, j) => i < j && assert.ok(!same(a, b), `${dims.yard[i]} and ${dims.yard[j]} look alike`)))
    const roads = []
    for (let v = 0; v < 6; v++) {
      const pc = at(`tile.road.${v}`)
      full(pc, `road ${v}`)
      assert.ok(!roads.some((o) => same(o, pc)), `road ${v} repeats an earlier variant`)
      roads.push(pc)
    }
  })

  test(`${id}: fences have something at their foot, and a road's edge leaves a footpath's mouth open`, () => {
    dims.yard.forEach((ground, tone) => {
      for (let mask = 0; mask < 16; mask++) assert.ok(opaque(at(`deco.verge.${mask}`, 0, { tone })) > 3, `${ground} verge ${mask}`)
      for (let v = 0; v < 16; v++) {
        const pc = at(`deco.fringe.${v}`, 0, { ground: 'yard', tone })
        assert.ok(opaque(pc) > 0, `${ground} fringe ${v} is empty`)
        if (v < 8) continue
        const side = (v & 7) >> 1
        for (let i = 4; i <= 11; i++) {
          for (let d = 0; d < 2; d++) {
            const [x, y] = [[i, d], [15 - d, i], [i, 15 - d], [d, i]][side]
            assert.ok(!pc.opaque(x, y), `${ground} fringe ${v} closes the footpath's mouth at ${x},${y}`)
          }
        }
      }
    })
  })

  test(`${id}: things lie about on the ground now and then, never everywhere`, () => {
    dims.yard.forEach((ground, tone) => {
      let n = 0
      const kinds = new Map()
      for (let y = 0; y < 80; y++) {
        for (let x = 0; x < 80; x++) {
          const c = pack.cover(x, y, tone)
          assert.deepEqual(c, pack.cover(x, y, tone), 'the same tile has something else on it the second time')
          if (!c) continue
          n++
          kinds.set(`${c.kind}.${c.variant}`, c)
        }
      }
      const share = n / 6400
      assert.ok(share > 0.005 && share < 0.4, `${ground}: ${(share * 100).toFixed(1)}% of tiles have something on them`)
      for (const [k] of kinds) assert.ok(opaque(at(`deco.${k}`, 0, { tone })) > 3, `${ground}: ${k} draws nothing`)
    })
  })

  test(`${id}: finished work is the size of a flower, stands on its spot at every stage, and says what kind of work it was`, () => {
    FLOWER_KINDS.forEach((k, kind) => {
      for (let stage = 0; stage <= 2; stage++) {
        for (const color of [PETALS[kind % PETALS.length], P.petalWhite]) {
          const pc = at(`flower.${kind}.${stage}`, 0, { color })
          assert.equal(pc.w, FLOWER_W, k.name)
          assert.equal(pc.h, FLOWER_H, k.name)
          assert.ok(opaque(pc) > 3, `${k.name} ${stage} is empty`)
          // The renderer puts pixel (4, 11) on the spot, and picks it by the box round it.
          assert.ok([3, 4, 5].some((x) => pc.opaque(x, 11)), `${k.name} ${stage} doesn't stand on its spot`)
        }
      }
      assert.ok(!same(at(`flower.${kind}.1`, 0, { color: PETALS[0] }), at(`flower.${kind}.2`, 0, { color: PETALS[0] })), `${k.name}: an open PR looks finished`)
    })
    // One of each kind of work, in one colour: no two alike.
    const firsts = WORK.map((w) => at(`flower.${FLOWER_KINDS.findIndex((k) => k.work === w.id)}.2`, 0, { color: PETALS[1] }))
    firsts.forEach((a, i) => firsts.forEach((b, j) => i < j && assert.ok(!same(a, b), `${WORK[i].id} and ${WORK[j].id} look alike`)))
  })

  test(`${id}: the field finished work stands in is full tiles in every ground`, () => {
    dims.yard.forEach((ground, tone) => {
      for (const v of [0, 1]) {
        const pc = at(`tile.bed.${v}`, 0, { tone })
        assert.equal(opaque(pc), 256, `${ground} field ${v} has holes`)
      }
      assert.ok(!same(at('tile.bed.0', 0, { tone }), at('tile.bed.1', 0, { tone })), `${ground}: a field's top row and the rows below are the same`)
    })
  })

  test(`${id}: villagers in every sub-theme stand on the ground in the theme's work clothes`, () => {
    for (const s of subthemes) {
      for (let i = 0; i < 12; i++) {
        const plain = lookFor(`t${i}`)
        const dressed = dress(plain, id, s.id)
        for (const [anim, facing] of [['idle', 's'], ['walk', 'e'], ['walk', 'n'], ['hammer', 's'], ['sit', 's']]) {
          const pc = at(`villager.${anim}.${facing}`, 0, { look: dressed })
          assert.equal(pc.w, VILLAGER_W)
          assert.equal(pc.h, VILLAGER_H)
          assert.ok(opaque(pc) > 60 && grounded(pc), `${s.id} villager ${i} ${anim}.${facing}`)
          if (THEMES[id].outfit) assert.ok(!same(pc, at(`villager.${anim}.${facing}`, 0, { look: plain })), `${s.id} villager ${i} came to work in its own clothes`)
        }
      }
    }
  })
}
