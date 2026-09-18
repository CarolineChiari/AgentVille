import { test } from 'node:test'
import assert from 'node:assert/strict'
import { World } from '../src/sim/world.js'
import { TILE } from '../src/sim/plot.js'

const T = (id, project, status = 'idle', extra = {}) => ({ id, project, createdAt: Number(id.replace(/\D/g, '')) || 0, status, known: true, ...extra })

function run(world, seconds, dt = 1 / 30) {
  for (let t = 0; t < seconds; t += dt) world.tick(dt)
}

/** Distance from a villager to the nearest place its building lets it stand. */
const fromStand = (v, b) => Math.min(...b.standSpots().map((p) => Math.hypot(v.x - p.x, v.y - p.y)))

test('the first roster trickles everybody out of the gate, then they reach their plots', () => {
  const w = new World()
  w.setRoster([T('t1', 'a', 'waiting'), T('t2', 'a'), T('t3', 'b', 'working')])
  assert.equal(w.snapshot().villagers.length, 0, 'everyone starts queued')
  run(w, 25)
  const snap = w.snapshot()
  assert.equal(snap.villagers.length, 3)
  for (const v of snap.villagers) assert.notEqual(w.villager(v.id).loco, 'entering', `${v.id} never arrived`)
  const waiting = w.villager('t1')
  assert.ok(fromStand(waiting, w.buildings.get('t1')) < 0.7, 'waiting villager stands by its door')
})

test('a known newcomer appears in place; an unknown one walks in from the gate', () => {
  const w = new World()
  w.setRoster([T('t1', 'a')])
  run(w, 10)
  w.setRoster([T('t1', 'a'), T('t2', 'a', 'idle', { known: true }), T('t3', 'a', 'idle', { known: false })])
  assert.equal(w.villager('t2').loco, 'site')
  assert.equal(w.villager('t3').loco, 'entering')
  assert.ok(Math.hypot(w.villager('t3').x - w.gate.x, w.villager('t3').y - w.gate.y) < 0.01)
  assert.equal(w.buildings.get('t3').progress, 0, 'a brand-new thread starts from its foundations')
})

test('an archived villager walks back to the gate and is gone; its building fades out', () => {
  const w = new World()
  w.setRoster([T('t1', 'a'), T('t2', 'a')])
  run(w, 12)
  w.setRoster([T('t1', 'a')])
  assert.equal(w.villager('t2').loco, 'leaving')
  run(w, 25)
  assert.equal(w.villager('t2'), null)
  assert.equal(w.buildings.has('t2'), false)
})

test('slots are stable: archiving one thread does not move its siblings', () => {
  const w = new World()
  w.setRoster([T('t1', 'a'), T('t2', 'a'), T('t3', 'a')])
  const before = { x: w.buildings.get('t3').x, y: w.buildings.get('t3').y }
  w.setRoster([T('t1', 'a'), T('t3', 'a')])
  assert.deepEqual({ x: w.buildings.get('t3').x, y: w.buildings.get('t3').y }, before)
})

test('locomotion wins over status: a working villager on the move walks', () => {
  const w = new World()
  w.setRoster([T('t1', 'a', 'working')])
  run(w, 1.5)
  const v = w.villager('t1')
  if (v.moving) assert.equal(v.anim, 'walk')
  run(w, 20)
  assert.ok(['hammer', 'walk'].includes(w.villager('t1').anim))
})

test('a status change at site re-targets', () => {
  const w = new World()
  w.setRoster([T('t1', 'a', 'working')])
  run(w, 15)
  w.setRoster([T('t1', 'a', 'waiting')])
  run(w, 6)
  const v = w.villager('t1')
  assert.ok(fromStand(v, w.buildings.get('t1')) < 0.7)
  assert.ok(['idle', 'wave', 'jump'].includes(v.anim))
  assert.equal(v.badge, 'waiting')
})

test('nobody ever stands inside a wall over a long busy run', () => {
  const w = new World()
  const threads = []
  for (let i = 0; i < 40; i++) threads.push(T(`t${i}`, `p${i % 5}`, ['idle', 'working', 'waiting', 'sleeping'][i % 4]))
  w.setRoster(threads)
  for (let s = 0; s < 60 * 30; s++) {
    w.tick(1 / 30)
    if (s % 15) continue
    for (const v of w.villagers.values()) {
      if (v.loco === 'queued') continue
      assert.ok(!w.nav.isBlocked(Math.floor(v.x), Math.floor(v.y)), `${v.id} inside a wall at ${v.x.toFixed(2)},${v.y.toFixed(2)}`)
    }
  }
})

test('a waiting villager waves and hops every few seconds', () => {
  const w = new World()
  w.setRoster([T('t1', 'a', 'waiting')])
  run(w, 12)
  const seen = new Set()
  for (let i = 0; i < 8 * 30; i++) {
    w.tick(1 / 30)
    seen.add(w.villager('t1').anim)
  }
  assert.ok(seen.has('wave') && seen.has('jump') && seen.has('idle'), [...seen].join(','))
})

const F = (id, kind = 0) => ({ id, kind, color: 1 })

test('flowers fill the field a row at a time, on ploughed ground', () => {
  const w = new World()
  const flowers = Array.from({ length: 9 }, (_, i) => F(`f${i}`))
  w.setRoster([T('t1', 'a')], undefined, new Map([['a', flowers]]))
  const p = (id) => w.flower(id)
  assert.ok(p('f1').x > p('f0').x && p('f1').y === p('f0').y, 'second flower is right of the first')
  assert.ok(p('f8').x === p('f0').x && p('f8').y > p('f0').y, 'ninth flower starts the next row')
  for (const f of flowers) {
    const tx = Math.floor(p(f.id).x)
    const ty = Math.floor(p(f.id).y - 0.2)
    assert.ok(!w.nav.isBlocked(tx, ty), 'the field is walkable')
    assert.equal(w.map.tileAt(tx, ty), TILE.BED, `${f.id} stands on soil`)
  }
})

test('the field is ploughed deeper as flowers arrive', () => {
  const w = new World()
  const soil = () => w.map.tiles.filter((t) => t === TILE.BED).length
  w.setRoster([T('t1', 'a')], undefined, new Map([['a', []]]))
  const bare = soil()
  assert.ok(bare > 0, 'an empty field still has a strip of soil')
  w.setRoster([T('t1', 'a')], undefined, new Map([['a', Array.from({ length: 30 }, (_, i) => F(`f${i}`))]]))
  assert.ok(soil() > bare, 'more flowers, more soil')
})

test('the first few houses stand round the field, not in a row', () => {
  const w = new World()
  w.setRoster([T('t1', 'a'), T('t2', 'a'), T('t3', 'a')])
  const ys = new Set([...w.buildings.values()].map((b) => b.y))
  const xs = new Set([...w.buildings.values()].map((b) => b.x))
  assert.equal(xs.size, 3, 'three columns')
  assert.equal(ys.size, 2, 'on two sides of the field')
})

test('a repo with only finished threads keeps its plot and garden', () => {
  const w = new World()
  w.setRoster([T('t1', 'a')], undefined, new Map([['b', [F('x')]]]))
  assert.ok(w.plots.has('b'))
  assert.equal(w.flower('x').plot, 'b')
})

test('flowers present at load are in bloom; one finished later grows in', () => {
  const w = new World()
  w.setRoster([T('t1', 'a'), T('t2', 'a')], undefined, new Map([['a', [F('old')]]]))
  assert.equal(w.flower('old').born, null)
  run(w, 2)
  w.setRoster([T('t1', 'a')], undefined, new Map([['a', [F('old'), F('t2')]]]))
  assert.equal(typeof w.flower('t2').born, 'number')
  assert.equal(w.snapshot().flowers.length, 2)
})

test('a done villager stands at its door with a checkmark and does not wave', () => {
  const w = new World()
  w.setRoster([T('t1', 'a', 'done')])
  run(w, 12)
  const seen = new Set()
  for (let i = 0; i < 8 * 30; i++) {
    w.tick(1 / 30)
    seen.add(w.villager('t1').anim)
  }
  const v = w.villager('t1')
  assert.ok(fromStand(v, w.buildings.get('t1')) < 0.7)
  assert.equal(v.badge, 'done')
  assert.deepEqual([...seen], ['idle'])
})

test('neighbouring buildings never offer the same spot to work or stand on', () => {
  const w = new World()
  w.setRoster([T('t1', 'a', 'working'), T('t2', 'a', 'working'), T('t3', 'a', 'working')])
  const seen = new Map()
  for (const [id, b] of w.buildings) {
    for (const p of [...b.workSpots(), ...b.standSpots()]) {
      const k = `${p.x},${p.y}`
      if (seen.has(k) && seen.get(k) !== id) assert.fail(`${id} and ${seen.get(k)} share ${k}`)
      seen.set(k, id)
    }
  }
})

test('idle villagers spread over the whole yard, garden included', () => {
  const w = new World()
  w.setRoster([T('t1', 'a'), T('t2', 'a'), T('t3', 'a')])
  const rows = new Set()
  for (let s = 0; s < 90 * 30; s++) {
    w.tick(1 / 30)
    if (s % 30) continue
    for (const v of w.villagers.values()) if (v.loco === 'site' && !v.moving) rows.add(((Math.floor(v.y) % 12) + 12) % 12)
  }
  assert.ok([...rows].some((r) => r >= 5), `only ever stood on rows ${[...rows].sort().join(',')}`)
})

const notes = (n, repo = 'a') => Array.from({ length: n }, (_, i) => ({ id: `issue:me/${repo}#${i + 1}` }))

test('a plot with open issues gets one notice board; one without gets none', () => {
  const w = new World()
  w.setRoster([T('t1', 'a'), T('t2', 'b')], undefined, new Map(), new Map([['a', notes(3)], ['b', []], ['nowhere', notes(2)]]))
  const snap = w.snapshot({ selected: 'board:a' })
  assert.deepEqual(snap.boards.map((b) => b.id), ['board:a'], 'no board for an empty list, and none for a repo without a plot')
  assert.equal(snap.boards[0].count, 3)
  assert.equal(snap.boards[0].selected, true)
  assert.equal(w.board('board:a').plot, 'a')
  assert.equal(w.board('board:b'), null)
})

test('a board stands on the walkway, blocks its tile, and never moves as the plot grows', () => {
  const w = new World()
  w.setRoster([T('t1', 'a')], undefined, new Map(), new Map([['a', notes(1)]]))
  const b = w.board('board:a')
  assert.ok(w.nav.isBlocked(b.tx, b.ty), 'nobody walks through the board')
  const ly = ((b.ty % 12) + 12) % 12
  assert.notEqual(ly, 4, 'not on the row in front of the doors')
  for (const bd of w.buildings.values()) {
    assert.ok(!(b.tx >= bd.x && b.tx < bd.x + bd.w && b.ty >= bd.y && b.ty < bd.y + bd.h), 'not inside a building')
  }
  // Every fence gap still opens onto a walkable tile.
  const [cx, cy] = w.plots.get('a').cells[0]
  for (const [gx, gy, ix, iy] of [[1, 4, 2, 4], [1, 9, 2, 9], [10, 4, 9, 4], [10, 9, 9, 9], [4, 10, 4, 9], [7, 10, 7, 9]]) {
    assert.ok(!w.nav.isBlocked(cx * 12 + ix, cy * 12 + iy), `the gap at ${gx},${gy} is not plugged`)
  }
  const at = `${b.tx},${b.ty}`
  w.setRoster(Array.from({ length: 7 }, (_, i) => T(`t${i + 1}`, 'a')), undefined, new Map(), new Map([['a', notes(9)]]))
  assert.ok(w.plots.get('a').cells.length > 1, 'the plot grew')
  assert.equal(`${w.board('board:a').tx},${w.board('board:a').ty}`, at)
  assert.equal(w.board('board:a').count, 9)
})

test('closing the last issue takes the board down and frees its tile', () => {
  const w = new World()
  w.setRoster([T('t1', 'a')], undefined, new Map(), new Map([['a', notes(2)]]))
  const { tx, ty } = w.board('board:a')
  w.setRoster([T('t1', 'a')], undefined, new Map(), new Map([['a', []]]))
  assert.equal(w.board('board:a'), null)
  assert.ok(!w.nav.isBlocked(tx, ty))
})

test('a villager standing where a board goes up walks off it', () => {
  const w = new World()
  w.setRoster([T('t1', 'a')])
  run(w, 12)
  const tile = w.plots.get('a').boardTile
  const v = w.villager('t1')
  v.x = tile.x + 0.5
  v.y = tile.y + 0.5
  v.goal = { x: v.x, y: v.y }
  w.setRoster([T('t1', 'a')], undefined, new Map(), new Map([['a', notes(1)]]))
  run(w, 3)
  assert.ok(w.nav.standable(v.x, v.y), `still inside the board at ${v.x.toFixed(2)},${v.y.toFixed(2)}`)
})

test('in a full plot, the thread you are working in still has a villager', () => {
  const w = new World()
  // More threads than the largest plot has slots; the newest is the one working.
  const threads = Array.from({ length: 40 }, (_, i) => T(`t${i + 1}`, 'a', 'sleeping'))
  threads.push(T('t99', 'a', 'working'))
  w.setRoster(threads)
  assert.ok(w.buildings.has('t99'), 'it has a building')
  assert.ok(w.villager('t99'), 'and a villager')
  run(w, 30)
  assert.equal(w.villager('t99').badge, 'working')
})
