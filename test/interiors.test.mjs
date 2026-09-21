// The rooms themselves: every theme's, held to what the renderer and the sim both rely on — that
// everything in a room stands inside it, that nothing stands where something else already is, and
// that whichever room a thread gets, it is the same one every time.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ALL_INTERIORS, BOARD_H, BOARD_W, FOOTPRINT, INTERIORS, REQUIRED, interiorById, interiorFor, interiorsOf } from '../src/sim/interiors.js'
import { INTERIOR_SIZE } from '../src/render/sprites/interiors.js'
import { THEMES, THEME_IDS, recipeOf } from '../src/sim/themes.js'
import { plotStyle } from '../src/sim/style.js'

/** Everything in a room, as the sim hands it to a renderer: the fixed pieces, the windows, the rest. */
const piecesOf = (r) => [
  ...REQUIRED.map((kind) => ({ kind, ...r[kind] })),
  ...r.windows.map((w) => ({ kind: 'window', ...w })),
  ...r.extra,
]
/** What a piece covers, in tiles: it stands on row y and rises through the rows above it. */
const boxOf = (p) => {
  const f = FOOTPRINT[p.kind]
  return { x0: p.x, x1: p.x + f.w, y0: p.y - f.h + 1, y1: p.y + 1 }
}
const overlap = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1

test('every theme has rooms of its own, and enough of them to tell one session from another', () => {
  for (const id of THEME_IDS) {
    const rooms = interiorsOf(id)
    assert.ok(rooms.length >= 3, `${id} has ${rooms.length} room(s)`)
    assert.equal(new Set(rooms.map((r) => r.id)).size, rooms.length, `${id} has two rooms by one name`)
    for (const r of rooms) {
      assert.ok(r.label && r.blurb, `${id}/${r.id} has no name`)
      for (const sub of r.subs || []) assert.ok(recipeOf(id, sub), `${id}/${r.id} keeps a sub-theme "${sub}" its theme hasn't got`)
    }
  }
  // Every room, of every theme, is its own room: no two share an id, so one can be saved or asked for.
  assert.equal(new Set(ALL_INTERIORS.map((r) => r.id)).size, ALL_INTERIORS.length)
  assert.equal(interiorById('study')?.label, 'Study')
  assert.equal(interiorById('nowhere'), null)
})

test('a room has everything a room has to have, and it all stands inside it', () => {
  for (const r of ALL_INTERIORS) {
    for (const kind of REQUIRED) assert.ok(r[kind], `${r.id} has no ${kind}`)
    for (const p of piecesOf(r)) {
      const f = FOOTPRINT[p.kind]
      assert.ok(f, `${r.id}: nothing is known about a ${p.kind}`)
      assert.ok(p.x >= 0 && p.x + f.w <= r.w, `${r.id}: its ${p.kind} runs off the side`)
      assert.ok(p.y >= -r.wallH && p.y < r.h, `${r.id}: its ${p.kind} is through the wall`)
    }
    // Wherever the villager can be, it is on the floor of the room and not inside the wall.
    for (const spot of ['rug', 'stand', 'chair', 'bed']) {
      const s = r[spot]
      assert.ok(s.x >= 0 && s.x < r.w && s.y >= 0 && s.y < r.h, `${r.id}: its ${spot} is not on the floor`)
    }
  }
})

test('nothing in a room stands where something else already is', () => {
  for (const r of ALL_INTERIORS) {
    // The board is part of the furniture as far as the wall is concerned, and it is always the
    // same size: one sprite, hung wherever the room wants it.
    const boxes = [{ kind: 'board', x0: r.board.x, x1: r.board.x + BOARD_W, y0: r.board.y, y1: r.board.y + BOARD_H }]
    assert.ok(r.board.x >= 0 && r.board.x + BOARD_W <= r.w, `${r.id}: its board hangs off the side`)
    assert.ok(r.board.y >= -r.wallH && r.board.y + BOARD_H <= 0, `${r.id}: its board hangs off the wall`)
    // The rug is underfoot: things stand on it, which is the point of it.
    for (const p of piecesOf(r).filter((p) => p.kind !== 'rug')) boxes.push({ kind: p.kind, ...boxOf(p) })
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        assert.ok(!overlap(boxes[i], boxes[j]), `${r.id}: its ${boxes[i].kind} and its ${boxes[j].kind} stand in the same place`)
      }
    }
  }
})

test('a room is as wide as the pieces in it are drawn', () => {
  // The sim lays a room out in tiles and the renderer draws it in pixels: a piece that is wider
  // than the room thinks would stand in its neighbour.
  for (const [kind, f] of Object.entries(FOOTPRINT)) {
    const size = INTERIOR_SIZE[kind]
    assert.ok(size, `nothing draws a ${kind}`)
    assert.ok(size[0] <= f.w * 16, `a ${kind} is ${size[0]}px wide where a room keeps ${f.w * 16}px for it`)
  }
})

test('a thread works in the same room every time, and in one its plot keeps if it has one', () => {
  const style = plotStyle('orchard', 'seaside', 'lighthouse-point')
  const first = interiorFor(style, 'claude-code:7')
  assert.equal(first.id, interiorFor(style, 'claude-code:7').id)
  assert.ok(first.subs.includes('lighthouse-point'), 'a lighthouse plot works under its own light')
  // Two sessions on the same plot can be in different rooms: the room is the thread's, not the plot's.
  const ids = new Set(Array.from({ length: 40 }, (_, i) => interiorFor(plotStyle('orchard', 'village'), `t:${i}`).id))
  assert.ok(ids.size > 1, 'every session in the village gets the same room')
  for (const id of ids) assert.ok(INTERIORS.village.some((r) => r.id === id), `a village session is in ${id}`)
})

test('a plot whose sub-theme has no room of its own still gets one of its theme’s', () => {
  for (const id of THEME_IDS) {
    for (const sub of THEMES[id].subthemes) {
      const room = interiorFor({ theme: id, sub: sub.id }, 'claude-code:1')
      assert.ok(interiorsOf(id).includes(room), `${id}/${sub.id} works somewhere else's room`)
      if (room.subs) assert.ok(room.subs.includes(sub.id) || !interiorsOf(id).some((r) => r.subs?.includes(sub.id)), `${id}/${sub.id} passed over a room kept for it`)
    }
  }
  // A style naming a theme that went away, or no style at all, is still put somewhere.
  assert.ok(interiorFor(null, 'x'))
  assert.ok(INTERIORS.village.includes(interiorFor({ theme: 'nowhere', sub: 'nothing' }, 'x')))
})
