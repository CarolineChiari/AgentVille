import { test } from 'node:test'
import assert from 'node:assert/strict'
import { World } from '../src/sim/world.js'

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

test('flowers fill each garden column top to bottom, then move right', () => {
  const w = new World()
  const flowers = Array.from({ length: 9 }, (_, i) => F(`f${i}`))
  w.setRoster([T('t1', 'a')], undefined, new Map([['a', flowers]]))
  const p = (id) => w.flower(id)
  assert.ok(p('f1').y > p('f0').y && p('f1').x === p('f0').x, 'second flower is below the first')
  assert.ok(p('f7').x > p('f0').x && p('f7').y === p('f0').y, 'eighth flower starts the next column')
  for (const f of flowers) assert.ok(!w.nav.isBlocked(Math.floor(p(f.id).x), Math.floor(p(f.id).y - 0.2)), 'the garden is walkable')
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
