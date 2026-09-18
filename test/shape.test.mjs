import { test } from 'node:test'
import assert from 'node:assert/strict'
import { capacityOf, flowerAt, isFenceGap, isRect, rectOf, shapeOf, tilledRows } from '../src/sim/shape.js'
import { BUILDING_H, BUILDING_W } from '../src/sim/constants.js'
import { key } from '../src/sim/grid.js'

const SHAPES = [[1, 1], [2, 1], [1, 2], [2, 2], [3, 2], [4, 3]]
const at = (w, h, cx = 0, cy = 0) => shapeOf({ cx, cy, w, h })
const inRect = (r, x, y) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h
const footprint = (s) => ({ x: s.x, y: s.y, w: BUILDING_W, h: BUILDING_H })

test('rectangles are recognised, ragged shapes are not', () => {
  assert.ok(isRect([[0, 0], [1, 0], [0, 1], [1, 1]]))
  assert.ok(!isRect([[0, 0], [1, 0], [1, 1]]))
  assert.ok(!isRect([[0, 0], [0, 0]]))
  assert.deepEqual(rectOf([[3, -2], [2, -1]]), { cx: 2, cy: -2, w: 2, h: 2 })
})

test('how many houses and flowers each size of plot holds', () => {
  const table = SHAPES.map(([w, h]) => [`${w}x${h}`, capacityOf(w, h).slots, capacityOf(w, h).flowers])
  assert.deepEqual(table, [['1x1', 5, 56], ['2x1', 9, 224], ['1x2', 13, 248], ['2x2', 17, 992], ['3x2', 21, 1736], ['4x3', 33, 4400]])
})

test('the first houses gather round the field: top middle, then either side, then the top corners', () => {
  assert.deepEqual(at(1, 1).slots, [{ x: 5, y: 2 }, { x: 2, y: 5 }, { x: 8, y: 5 }, { x: 2, y: 2 }, { x: 8, y: 2 }])
})

for (const [w, h] of SHAPES) {
  test(`${w}×${h}: houses stand in the yard, clear of each other, the field and the board`, () => {
    const s = at(w, h, -1, 2)
    const taken = new Set()
    for (const slot of s.slots) {
      for (let y = slot.y; y < slot.y + BUILDING_H; y++) {
        for (let x = slot.x; x < slot.x + BUILDING_W; x++) {
          assert.ok(inRect(s.yard, x, y), `house at ${slot.x},${slot.y} is outside the fence`)
          assert.ok(!inRect(s.bed, x, y), `house at ${slot.x},${slot.y} is in the field`)
          assert.ok(!taken.has(key(x, y)), `two houses share ${x},${y}`)
          assert.ok(!(x === s.board.x && y === s.board.y), 'a house on the board')
          taken.add(key(x, y))
        }
      }
    }
    assert.ok(!inRect(s.bed, s.board.x, s.board.y), 'the board is not in the field')
  })

  test(`${w}×${h}: every door and every fence gap can be reached from the road`, () => {
    const s = at(w, h, 1, -1)
    const blocked = new Set([key(s.board.x, s.board.y)])
    for (const slot of s.slots) for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) blocked.add(key(slot.x + dx, slot.y + dy))
    for (let ly = 0; ly < s.h; ly++) {
      for (let lx = 0; lx < s.w; lx++) {
        const ring = Math.min(lx, ly, s.w - 1 - lx, s.h - 1 - ly)
        if (ring === 1 && !isFenceGap(s, lx, ly)) blocked.add(key(s.x0 + lx, s.y0 + ly))
      }
    }
    // Flood in from the road's corner.
    const seen = new Set([key(s.x0, s.y0)])
    const queue = [[s.x0, s.y0]]
    while (queue.length) {
      const [x, y] = queue.pop()
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx
        const ny = y + dy
        if (nx < s.x0 || ny < s.y0 || nx >= s.x0 + s.w || ny >= s.y0 + s.h) continue
        if (blocked.has(key(nx, ny)) || seen.has(key(nx, ny))) continue
        seen.add(key(nx, ny))
        queue.push([nx, ny])
      }
    }
    for (const slot of s.slots) {
      const door = key(slot.x + BUILDING_W / 2, slot.y + BUILDING_H)
      assert.ok(seen.has(door), `the door of the house at ${slot.x},${slot.y} can't be reached`)
    }
    for (let y = s.bed.y; y < s.bed.y + s.bed.h; y++) for (let x = s.bed.x; x < s.bed.x + s.bed.w; x++) assert.ok(seen.has(key(x, y)), `field tile ${x},${y} is shut in`)
  })
}

test('a plot growing right or down keeps every house that still fits where it stood', () => {
  const keys = (s) => new Set(s.slots.map((p) => key(p.x, p.y)))
  const one = at(1, 1)
  const right = keys(at(2, 1))
  const down = keys(at(1, 2))
  for (const p of one.slots) {
    const k = key(p.x, p.y)
    assert.ok(down.has(k), `growing down moved the house at ${k}`)
    const rightSide = p.x === one.yard.x + one.yard.w - BUILDING_W && p.y > one.yard.y
    if (!rightSide) assert.ok(right.has(k), `growing right moved the house at ${k}`)
  }
})

test('the field fills a row at a time and is ploughed one row ahead', () => {
  const s = at(1, 1)
  const cols = s.flowers.cols
  assert.equal(flowerAt(s, 1).y, flowerAt(s, 0).y)
  assert.ok(flowerAt(s, 1).x > flowerAt(s, 0).x)
  assert.equal(flowerAt(s, cols).x, flowerAt(s, 0).x)
  assert.ok(flowerAt(s, cols).y > flowerAt(s, 0).y)
  assert.equal(tilledRows(s, 0), 1, 'an empty field is one strip of soil')
  assert.equal(tilledRows(s, cols + 1), 2)
  assert.equal(tilledRows(s, 10_000), s.bed.h, 'never past the field')
  // Every flower that fits stands on ploughed ground.
  for (let n = 1; n <= capacityOf(1, 1).flowers; n++) {
    const { y } = flowerAt(s, n - 1)
    assert.ok(Math.floor(y - 0.01) < s.bed.y + tilledRows(s, n), `flower ${n} is on grass`)
  }
})
