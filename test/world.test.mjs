import { test } from 'node:test'
import assert from 'node:assert/strict'
import { World } from '../src/sim/world.js'

const T = (id, project, status = 'idle', extra = {}) => ({ id, project, createdAt: Number(id.replace(/\D/g, '')) || 0, status, known: true, ...extra })

function run(world, seconds, dt = 1 / 30) {
  for (let t = 0; t < seconds; t += dt) world.tick(dt)
}

test('the first roster trickles everybody out of the gate, then they reach their plots', () => {
  const w = new World()
  w.setRoster([T('t1', 'a', 'waiting'), T('t2', 'a'), T('t3', 'b', 'working')])
  assert.equal(w.snapshot().villagers.length, 0, 'everyone starts queued')
  run(w, 25)
  const snap = w.snapshot()
  assert.equal(snap.villagers.length, 3)
  for (const v of snap.villagers) assert.notEqual(w.villager(v.id).loco, 'entering', `${v.id} never arrived`)
  const waiting = w.villager('t1')
  const b = w.buildings.get('t1')
  assert.ok(Math.hypot(waiting.x - b.front.x, waiting.y - b.front.y) < 0.7, 'waiting villager stands at its door')
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
  const f = w.buildings.get('t1').front
  assert.ok(Math.hypot(v.x - f.x, v.y - f.y) < 0.7)
  assert.equal(v.anim, 'idle')
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
