import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DECO, Plot, TILE } from '../src/sim/plot.js'
import { TileMap } from '../src/sim/world.js'
import { BUILDING_H, BUILDING_W, CELL_TILES, SLOT_PITCH } from '../src/sim/constants.js'
import { isFenceGap } from '../src/sim/shape.js'
import { STATUS_RANK } from '../src/sim/status.js'
import { mulberry32 } from '../src/sim/rng.js'

test('the notice board stands on the bottom walkway, clear of the field, the houses and the fence gaps', () => {
  const p = new Plot('a', 0)
  p.setCells([[2, -1], [3, -1]])
  const s = p.shape
  const { x, y } = p.boardTile
  assert.deepEqual({ x, y }, { x: 2 * CELL_TILES + 3, y: -CELL_TILES + 9 })
  assert.equal(y, s.walkBottom)
  assert.ok(!(x >= s.bed.x && x < s.bed.x + s.bed.w && y >= s.bed.y && y < s.bed.y + s.bed.h), 'not in the field')
  for (const h of s.slots) assert.ok(!(x >= h.x && x < h.x + BUILDING_W && y >= h.y && y < h.y + BUILDING_H), 'not in a house')
  // Not plugging a gap: the tiles below it and either side of it are not openings in the fence.
  const [lx, ly] = [x - s.x0, y - s.y0]
  assert.ok(!isFenceGap(s, lx, ly + 1), 'not in front of a gap in the bottom fence')
  assert.ok(!isFenceGap(s, lx - 1, ly) && !isFenceGap(s, lx + 1, ly), 'not just inside a gap in the side fence')
})

const T = (id, status, createdAt) => ({ id, status, createdAt })
/** One more thread than a 1×1 plot has houses for, the quiet ones oldest. */
function crowd(p, status, last) {
  const list = Array.from({ length: p.capacity }, (_, i) => T(`q${i}`, status, i + 1))
  return [...list, T('new', last, 99)]
}

test('a full plot houses the threads that want something before the quiet ones', () => {
  const p = new Plot('a', 0)
  p.setCells([[1, 0]])
  p.assignSlots(crowd(p, 'sleeping', 'working'))
  assert.ok(p.slotOf.has('new'), 'the newest thread is the one working, and it gets a house')
  assert.equal(p.slotOf.size, p.capacity)
})

test('a thread that starts working takes the slot of the sleepiest, oldest holder', () => {
  const p = new Plot('a', 0)
  p.setCells([[1, 0]])
  const roster = crowd(p, 'sleeping', 'sleeping')
  roster[1].status = 'idle'
  p.assignSlots(roster)
  assert.equal(p.slotOf.has('new'), false, 'at first the oldest of equals keep their slots')
  const slotOfOldest = p.slotOf.get('q0')
  const before = new Map([...p.slotOf].filter(([id]) => id !== 'q0'))
  roster[roster.length - 1].status = 'waiting'
  p.assignSlots(roster)
  assert.equal(p.slotOf.get('new'), slotOfOldest, 'the waiting one moves into the oldest sleeper\'s slot')
  assert.equal(p.slotOf.has('q0'), false)
  for (const [id, slot] of before) assert.equal(p.slotOf.get(id), slot, `${id} moved`)
})

test('equals never displace each other, so a full plot settles', () => {
  const p = new Plot('a', 0)
  p.setCells([[1, 0]])
  const roster = crowd(p, 'working', 'sleeping')
  p.assignSlots(roster)
  const first = [...p.slotOf].sort().join()
  p.assignSlots(roster)
  assert.equal([...p.slotOf].sort().join(), first)
  assert.equal(p.slotOf.has('new'), false, 'a sleeper never pushes out a worker')
  roster[roster.length - 1].status = 'working'
  roster[0].status = 'idle'
  p.assignSlots(roster)
  assert.ok(p.slotOf.has('new'), 'a worker without a house moves in once a holder goes quiet')
  assert.equal(p.slotOf.has('q0'), false)
})

test('a plot growing down keeps every house where it stood', () => {
  const p = new Plot('a', 0)
  p.setCells([[1, 0]])
  const roster = Array.from({ length: p.capacity }, (_, i) => T(`t${i}`, 'idle', i))
  p.assignSlots(roster)
  const before = new Map(p.slotOf)
  p.setCells([[1, 0], [1, 1]])
  p.assignSlots([...roster, T('more', 'idle', 99)])
  for (const [id, slot] of before) assert.equal(p.slotOf.get(id), slot, `${id} moved`)
  assert.ok(p.slotOf.has('more'))
})

test('the field is ploughed as flowers arrive, one row ahead, and no further than it goes', () => {
  const p = new Plot('a', 0)
  p.setCells([[1, 0]])
  assert.equal(p.tilled, 1, 'a new plot is laid out with its first strip of soil')
  assert.equal(p.setPlanted(0), false, 'no flowers, no more soil')
  assert.equal(p.setPlanted(3), true)
  assert.equal(p.tilled, 2)
  assert.equal(p.setPlanted(4), false, 'another flower in the same row changes nothing')
  p.setPlanted(10_000)
  assert.equal(p.tilled, p.shape.bed.h)
})

test('standing its landmark somewhere else lays the field out round it again', () => {
  const p = new Plot('a', 0)
  p.setCells([[1, 0], [1, 1]])
  p.setPlanted(20)
  const head = p.landmarkRect
  const tilled = p.tilled
  assert.equal(p.setSpot('bottom'), true)
  assert.ok(p.landmarkRect.y > head.y, 'the landmark stayed at the head of the field')
  assert.equal(p.setSpot('bottom'), false, 'the spot it already stands at changes nothing')
  // The field is ploughed for the flowers where they now stand.
  for (let i = 0; i < 20; i++) {
    const { y } = p.flowerSpot(i)
    assert.ok(Math.floor(y - 0.01) < p.shape.bed.y + p.tilled, `flower ${i} is on grass`)
  }
  assert.equal(p.setSpot('nowhere'), true, 'a spot we don’t know is the default one')
  assert.deepEqual(p.landmarkRect, head)
  assert.equal(p.tilled, tilled)
})

test('painting a plot wears trails along its walkways and leaves the fence and its gaps as they were', () => {
  const p = new Plot('a', 0)
  p.setCells([[1, 1], [2, 1]])
  const map = new TileMap(0, 0, 48, 36)
  p.paint(map)
  const s = p.shape
  for (let x = s.yard.x; x < s.yard.x + s.yard.w; x++) {
    assert.equal(map.tileAt(x, s.walkTop), TILE.TRAIL)
    assert.equal(map.tileAt(x, s.walkBottom), TILE.TRAIL)
  }
  const FENCES = [DECO.FENCE_H, DECO.FENCE_V, DECO.POST]
  for (let ly = 0; ly < s.h; ly++) {
    for (let lx = 0; lx < s.w; lx++) {
      if (Math.min(lx, ly, s.w - 1 - lx, s.h - 1 - ly) !== 1) continue
      const d = map.decoAt(s.x0 + lx, s.y0 + ly)
      if (isFenceGap(s, lx, ly)) {
        assert.equal(d, DECO.NONE, `the gap at ${lx},${ly} is fenced`)
        assert.equal(map.tileAt(s.x0 + lx, s.y0 + ly), TILE.TRAIL, `the gap at ${lx},${ly} has no trail`)
      } else assert.ok(FENCES.includes(d), `the fence is missing at ${lx},${ly}`)
    }
  }
})

/** The slots as assignSlots handed them out before there were groups, to hold the new one to. */
function legacyAssign(plot, threads) {
  const ids = new Set(threads.map((t) => t.id))
  const exists = new Set(plot.slotKeys)
  for (const id of [...plot.slotOf.keys()]) if (!ids.has(id)) plot.slotOf.delete(id)
  const used = new Set()
  for (const [id, s] of plot.slotOf) {
    if (exists.has(s) && !used.has(s)) used.add(s)
    else plot.slotOf.delete(id)
  }
  const free = plot.slotKeys.filter((s) => !used.has(s))
  const byId = new Map(threads.map((t) => [t.id, t]))
  const rank = (t) => STATUS_RANK[t.status] ?? STATUS_RANK.idle
  const older = (a, b) => (a.createdAt || 0) - (b.createdAt || 0) || (a.id < b.id ? -1 : 1)
  const sorted = [...threads].sort((a, b) => rank(a) - rank(b) || older(a, b))
  let next = 0
  for (const t of sorted) {
    if (plot.slotOf.has(t.id)) continue
    if (next < free.length) {
      plot.slotOf.set(t.id, free[next++])
      continue
    }
    let victim = null
    for (const id of plot.slotOf.keys()) {
      const h = byId.get(id)
      if (rank(h) <= rank(t)) continue
      if (!victim || rank(h) > rank(victim) || (rank(h) === rank(victim) && older(h, victim) < 0)) victim = h
    }
    if (!victim) break
    plot.slotOf.set(t.id, plot.slotOf.get(victim.id))
    plot.slotOf.delete(victim.id)
  }
}

const STATUSES = Object.keys(STATUS_RANK)
const houses = (p) => [...p.slotOf].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([id, s]) => `${id}@${s}`).join(' ')

test('a plot with no groups is laid out exactly as it always was', () => {
  const rand = mulberry32(20260929)
  const SHAPES = [[[1, 0]], [[1, 0], [2, 0]], [[1, 0], [1, 1]], [[1, 0], [2, 0], [1, 1], [2, 1]]]
  for (let run = 0; run < 20; run++) {
    const now = new Plot('a', 0)
    const was = new Plot('a', 0)
    let shape = SHAPES[0]
    now.setCells(shape)
    was.setCells(shape)
    let roster = []
    let n = 0
    for (let step = 0; step < 120; step++) {
      const r = rand()
      if (r < 0.3 || !roster.length) roster.push(T(`t${n++}`, STATUSES[Math.floor(rand() * STATUSES.length)], Math.floor(rand() * 50)))
      else if (r < 0.45) roster.splice(Math.floor(rand() * roster.length), 1)
      else if (r < 0.9) roster[Math.floor(rand() * roster.length)].status = STATUSES[Math.floor(rand() * STATUSES.length)]
      else {
        shape = SHAPES[Math.floor(rand() * SHAPES.length)]
        now.setCells(shape)
        was.setCells(shape)
      }
      roster = roster.map((t) => ({ ...t }))
      now.assignSlots(roster)
      legacyAssign(was, roster)
      assert.equal(houses(now), houses(was), `run ${run}, step ${step}`)
    }
  }
})

/** How far apart two threads' houses stand, in tiles; neighbours along a row or down a side are 3. */
function apart(p, a, b) {
  const [ax, ay] = p.slotOf.get(a).split(',').map(Number)
  const [bx, by] = p.slotOf.get(b).split(',').map(Number)
  return Math.hypot(ax - bx, ay - by)
}
const G = (id, group, status = 'idle', createdAt = 0) => ({ id, status, createdAt, group })

/** Whether a group's houses stand in one run, each next to another of them. */
function together(p, ids) {
  const seen = new Set([ids[0]])
  for (let grew = true; grew;) {
    grew = false
    for (const id of ids) {
      if (seen.has(id) || ![...seen].some((s) => apart(p, s, id) <= SLOT_PITCH)) continue
      seen.add(id)
      grew = true
    }
  }
  return seen.size === ids.length
}

test('a group moves in side by side, and the groups before anybody in none', () => {
  const p = new Plot('a', 0)
  p.setCells([[1, 0], [2, 0]])
  const roster = [
    G('u1', '', 'waiting', 1), G('a1', 'g-a', 'working', 2), G('u2', '', 'idle', 3), G('b1', 'g-b', 'sleeping', 4),
    G('a2', 'g-a', 'sleeping', 5), G('u3', '', 'done', 6), G('b2', 'g-b', 'idle', 7), G('a3', 'g-a', 'idle', 8),
  ]
  p.assignSlots(roster)
  assert.equal(p.slotOf.size, roster.length)
  assert.equal(p.slotOf.get('a1'), p.slotKeys[0], 'the first group in takes the most central house, as anybody would')
  assert.ok(together(p, ['a1', 'a2', 'a3']), houses(p))
  assert.ok(together(p, ['b1', 'b2']), houses(p))
})

test('a newcomer in a group moves in beside it', () => {
  const p = new Plot('a', 0)
  p.setCells([[1, 0], [2, 0]])
  const roster = [G('a1', 'g-a'), G('u1', ''), G('u2', '')]
  p.assignSlots(roster)
  const before = new Map(p.slotOf)
  p.assignSlots([...roster, G('a2', 'g-a', 'idle', 9)])
  assert.equal(apart(p, 'a1', 'a2'), SLOT_PITCH)
  for (const [id, s] of before) assert.equal(p.slotOf.get(id), s, `${id} moved for a newcomer`)
})

test('a thread put in a group moves beside it: to a free house, or in place of one in no group', () => {
  const p = new Plot('a', 0)
  p.setCells([[1, 0]])
  // A 1×1 plot has five houses: the top row's middle, both sides, then the top row's ends.
  const roster = [G('a1', 'g-a', 'idle', 1), G('u1', '', 'idle', 2), G('u2', '', 'idle', 3), G('u3', '', 'idle', 4)]
  p.assignSlots(roster)
  assert.equal(p.capacity, 5)
  const far = roster.map((t) => t.id).filter((id) => id !== 'a1').sort((x, y) => apart(p, 'a1', y) - apart(p, 'a1', x))[0]
  const before = new Map(p.slotOf)
  const joined = roster.map((t) => (t.id === far ? { ...t, group: 'g-a' } : t))
  p.assignSlots(joined)
  assert.equal(apart(p, 'a1', far), SLOT_PITCH, houses(p))
  const moved = [...before].filter(([id, s]) => p.slotOf.get(id) !== s).map(([id]) => id)
  assert.ok(moved.includes(far))
  assert.ok(moved.length <= 2 && moved.every((id) => id === far || !joined.find((t) => t.id === id).group), 'only it and one in no group moved')
  // Asked again, nothing moves: it is where it wants to be.
  const settled = houses(p)
  p.assignSlots(joined)
  assert.equal(houses(p), settled)
})

test("nobody is moved out of their own group's run to make room for another's", () => {
  const p = new Plot('a', 0)
  p.setCells([[1, 0]])
  // a1 in the middle of the top row, with b's on either side of it; u1 down one side.
  const roster = [G('a1', 'g-a', 'blocked', 1), G('b1', 'g-b', 'waiting', 2), G('b2', 'g-b', 'waiting', 3), G('u1', '', 'idle', 4)]
  p.assignSlots(roster)
  const before = new Map(p.slotOf)
  p.assignSlots(roster.map((t) => (t.id === 'u1' ? { ...t, group: 'g-a' } : t)))
  for (const id of ['a1', 'b1', 'b2']) assert.equal(p.slotOf.get(id), before.get(id), `${id} moved`)
})

test('the first of a group, and a thread leaving one, stay where they are', () => {
  const p = new Plot('a', 0)
  p.setCells([[1, 0], [2, 0]])
  const roster = [G('a1', 'g-a'), G('a2', 'g-a'), G('u1', ''), G('u2', '')]
  p.assignSlots(roster)
  const before = houses(p)
  p.assignSlots(roster.map((t) => (t.id === 'u2' ? { ...t, group: 'g-new' } : t.id === 'a2' ? { ...t, group: '' } : t)))
  assert.equal(houses(p), before)
})
