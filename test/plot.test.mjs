import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DECO, Plot, TILE } from '../src/sim/plot.js'
import { TileMap } from '../src/sim/world.js'
import { BUILDING_H, BUILDING_W, CELL_TILES } from '../src/sim/constants.js'
import { isFenceGap } from '../src/sim/shape.js'

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
  assert.equal(p.setPlanted(0), true, 'the first ploughing changes the ground')
  assert.equal(p.tilled, 1)
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
