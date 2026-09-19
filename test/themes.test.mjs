import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_THEME, THEMES, THEME_ID, THEME_IDS, dress, finishedName, finishedWords, recipeOf, subthemeFor, themeOf } from '../src/sim/themes.js'
import { FLOWER_KINDS, WORK } from '../src/sim/flowers.js'
import { PLAIN_STYLE, plainStyle, plotStyle } from '../src/sim/style.js'
import { HATS, TOPS, lookFor } from '../src/sim/villager.js'
import { rngFor } from '../src/sim/rng.js'
import { PACKS } from '../src/render/themes/index.js'

const NAMES = Array.from({ length: 400 }, (_, i) => `repo-${i}`)

test('every theme and sub-theme has an id that can be saved, a label, and a pack to draw it', () => {
  for (const id of THEME_IDS) {
    const t = THEMES[id]
    assert.match(id, THEME_ID)
    assert.ok(t.label, id)
    assert.ok(PACKS[id], `${id} has no pack in src/render/themes/`)
    assert.ok(t.subthemes.length, `${id} has no sub-themes`)
    const ids = t.subthemes.map((s) => s.id)
    assert.equal(new Set(ids).size, ids.length, `${id} names a sub-theme twice`)
    for (const s of t.subthemes) {
      assert.match(s.id, THEME_ID)
      assert.ok(s.label && s.blurb, `${id}/${s.id} needs a label and a blurb`)
    }
    assert.ok(t.auto.length && t.auto.every((a) => ids.includes(a)), `${id}'s auto list names a sub-theme it doesn't have`)
  }
  assert.ok(THEMES[DEFAULT_THEME])
})

test('every theme has words for finished work, and a name for every kind of it', () => {
  for (const id of THEME_IDS) {
    const w = finishedWords(id)
    for (const k of ['one', 'many', 'place', 'glyph', 'grow']) assert.ok(typeof w[k] === 'string' && w[k], `${id}: finished.${k}`)
    assert.equal([...w.glyph].length, 1, `${id}'s glyph is one character`)
    if (w.names) for (const work of WORK) assert.ok(w.names[work.id], `${id} has no name for ${work.id}`)
    FLOWER_KINDS.forEach((_, kind) => assert.ok(finishedName(id, kind), `${id}: kind ${kind} has no name`))
  }
  // The village keeps its flowers' own names; a site names each flag by its kind of work.
  assert.equal(finishedName('village', 0), FLOWER_KINDS[0].name)
  assert.equal(finishedName('construction', FLOWER_KINDS.findIndex((k) => k.work === 'data')), 'Chequered flag')
  // Its glyph can't be mistaken for the open issues' ⚑.
  for (const id of THEME_IDS) assert.notEqual(finishedWords(id).glyph, '⚑')
})

test('every recipe only asks for what its theme has', () => {
  for (const id of THEME_IDS) {
    const { dims, subthemes } = THEMES[id]
    for (const s of subthemes) {
      for (const k of ['fence', 'yard', 'wall']) for (const n of s[k] || []) assert.ok(dims[k].includes(n), `${id}/${s.id}: no ${k} "${n}"`)
      for (const r of s.roofs || []) assert.ok(Number.isInteger(r) && r >= 0 && r < dims.roofs, `${id}/${s.id}: no paint family ${r}`)
      if (s.outfit?.vest !== undefined) assert.ok([0, 1].includes(s.outfit.vest))
    }
  }
})

test('the village looks exactly as it did before themes: patchwork is every repo\'s old style', () => {
  // The style every repo had, as it was worked out before there were themes.
  const before = (name) => {
    const r = rngFor(`style:${name}`)
    return { fence: Math.floor(r() * 4), yard: Math.floor(r() * 3), wall: Math.floor(r() * 5), roofs: Math.floor(r() * 4) }
  }
  for (const name of NAMES) {
    const s = plotStyle(name)
    assert.deepEqual({ fence: s.fence, yard: s.yard, wall: s.wall, roofs: s.roofs }, before(name), name)
    assert.equal(s.theme, 'village')
    assert.equal(s.sub, 'patchwork')
  }
})

test('a folder keeps its sub-theme and its look, and its own pick wins', () => {
  for (const id of THEME_IDS) {
    for (const name of NAMES.slice(0, 50)) {
      assert.equal(subthemeFor(name, id), subthemeFor(name, id))
      assert.deepEqual(plotStyle(name, id), plotStyle(name, id))
      for (const s of THEMES[id].subthemes) {
        assert.equal(subthemeFor(name, id, s.id), s.id)
        assert.equal(plotStyle(name, id, s.id).sub, s.id)
      }
    }
  }
  // A folder's own pick comes before the whole village's; either is ignored if the theme lacks it.
  assert.equal(subthemeFor('a', 'construction', 'roadworks', 'high-rise'), 'roadworks')
  assert.equal(subthemeFor('a', 'construction', undefined, 'high-rise'), 'high-rise')
  assert.equal(subthemeFor('a', 'construction', 'farmstead', 'nope'), subthemeFor('a', 'construction'))
})

test('a sub-theme\'s recipe is honoured by every folder that wears it', () => {
  for (const id of THEME_IDS) {
    const { dims } = THEMES[id]
    for (const sub of THEMES[id].subthemes) {
      const seen = { fence: new Set(), yard: new Set(), wall: new Set(), roofs: new Set() }
      for (const name of NAMES) {
        const s = plotStyle(name, id, sub.id)
        for (const k of ['fence', 'yard', 'wall']) {
          assert.ok(s[k] >= 0 && s[k] < dims[k].length, `${id}/${sub.id} ${k} ${s[k]}`)
          if (sub[k]) assert.ok(sub[k].includes(dims[k][s[k]]), `${id}/${sub.id} built a ${k} of ${dims[k][s[k]]}`)
          seen[k].add(s[k])
        }
        assert.ok(s.roofs >= 0 && s.roofs < dims.roofs)
        if (sub.roofs) assert.ok(sub.roofs.includes(s.roofs))
        seen.roofs.add(s.roofs)
      }
      // And everything it allows turns up somewhere.
      for (const k of ['fence', 'yard', 'wall']) assert.equal(seen[k].size, sub[k]?.length ?? dims[k].length, `${id}/${sub.id} ${k}`)
      assert.equal(seen.roofs.size, sub.roofs?.length ?? dims.roofs, `${id}/${sub.id} roofs`)
    }
  }
})

test('left to themselves, folders on a construction site spread over every sub-theme', () => {
  const count = new Map()
  for (const name of NAMES) {
    const s = subthemeFor(name, 'construction')
    count.set(s, (count.get(s) || 0) + 1)
  }
  for (const s of THEMES.construction.auto) assert.ok((count.get(s) || 0) > NAMES.length / 10, `${s}: ${count.get(s) || 0}`)
})

test('an unknown theme is the village, and plain styles belong to their theme', () => {
  assert.equal(themeOf('nope'), DEFAULT_THEME)
  assert.equal(themeOf(undefined), DEFAULT_THEME)
  assert.equal(themeOf('__proto__'), DEFAULT_THEME)
  assert.equal(plotStyle('a', 'nope').theme, DEFAULT_THEME)
  assert.equal(recipeOf('construction', 'patchwork'), null)
  assert.equal(plainStyle('village'), PLAIN_STYLE)
  assert.equal(plainStyle('construction').theme, 'construction')
})

test('on a construction site everybody wears a hard hat and hi-vis; in the village, their own clothes', () => {
  for (let i = 0; i < 60; i++) {
    const look = lookFor(`t${i}`)
    assert.equal(dress(look, 'village', 'patchwork'), look)
    const d = dress(look, 'construction', 'new-homes')
    assert.equal(HATS[d.hat], 'hardhat')
    assert.equal(TOPS[d.top], 'hivis')
    for (const k of ['skin', 'hair', 'style', 'extra', 'tall']) assert.equal(d[k], look[k], k)
    assert.equal(dress(look, 'construction', 'roadworks').vest, 1, 'roadworks is all in orange')
  }
  const vests = new Set(Array.from({ length: 60 }, (_, i) => dress(lookFor(`t${i}`), 'construction', 'high-rise').vest))
  assert.deepEqual([...vests].sort(), [0, 1])
})
