import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_SPOT, LANDMARK_SPOTS, capacityOf, flowerAt, isFenceGap, isRect, isTrail, propsOf, rectOf, shapeOf, tilledRows } from '../src/sim/shape.js'
import { BUILDING_H, BUILDING_W } from '../src/sim/constants.js'
import { key } from '../src/sim/grid.js'

const SHAPES = [[1, 1], [2, 1], [1, 2], [2, 2], [3, 2], [4, 3]]
const at = (w, h, cx = 0, cy = 0, spot = DEFAULT_SPOT) => shapeOf({ cx, cy, w, h }, spot)
/** The tallest landmark, 72 px of it, over the tiles its footprint covers. */
const silhouette = (s) => ({ x: s.landmark.x, y: s.landmark.y + s.landmark.h - 72 / 16, w: s.landmark.w, h: 72 / 16 })
/** Is the flower at this spot behind the landmark? Its sprite hangs 2 px below its spot. */
const hidden = (s, p) => {
  const l = silhouette(s)
  return p.x >= l.x && p.x < l.x + l.w && p.y + 2 / 16 > l.y && p.y < l.y + l.h
}
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
  // The landmark takes a 2×2 of every field: sixteen spots a flower could have had.
  assert.deepEqual(table, [['1x1', 5, 40], ['2x1', 9, 208], ['1x2', 13, 232], ['2x2', 17, 976], ['3x2', 21, 1720], ['4x3', 33, 4384]])
})

test('the first houses gather round the field: top middle, then either side, then the top corners', () => {
  assert.deepEqual(at(1, 1).slots, [{ x: 5, y: 2 }, { x: 2, y: 5 }, { x: 8, y: 5 }, { x: 2, y: 2 }, { x: 8, y: 2 }])
})

for (const [w, h] of SHAPES) {
  test(`${w}×${h}: trails run along both walkways and out through every gap, and never under a house or the field`, () => {
    const s = at(w, h, 2, 1)
    const houses = new Set()
    for (const slot of s.slots) for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) houses.add(key(slot.x + dx, slot.y + dy))
    const trail = new Set()
    for (let ly = 0; ly < s.h; ly++) {
      for (let lx = 0; lx < s.w; lx++) {
        const x = s.x0 + lx
        const y = s.y0 + ly
        const ring = Math.min(lx, ly, s.w - 1 - lx, s.h - 1 - ly)
        if (ring === 1 && isFenceGap(s, lx, ly)) assert.ok(isTrail(s, lx, ly), `the gap at ${lx},${ly} has no trail`)
        if (!isTrail(s, lx, ly)) continue
        trail.add(key(x, y))
        assert.ok(ring > 0, 'a trail on the road')
        assert.ok(ring > 1 || isFenceGap(s, lx, ly), `a trail under the fence at ${lx},${ly}`)
        assert.ok(!houses.has(key(x, y)), `a trail under a house at ${x},${y}`)
        assert.ok(!inRect(s.bed, x, y), `a trail in the field at ${x},${y}`)
      }
    }
    for (let x = s.yard.x; x < s.yard.x + s.yard.w; x++) {
      assert.ok(trail.has(key(x, s.walkTop)) && trail.has(key(x, s.walkBottom)), `the walkways are broken at x=${x}`)
    }
    // Every stretch of trail leads out through a gap in the fence to the road.
    const gaps = [...trail].filter((k) => {
      const [x, y] = k.split(',').map(Number)
      const lx = x - s.x0
      const ly = y - s.y0
      return Math.min(lx, ly, s.w - 1 - lx, s.h - 1 - ly) === 1
    })
    const seen = new Set(gaps)
    const queue = gaps.map((k) => k.split(',').map(Number))
    while (queue.length) {
      const [x, y] = queue.pop()
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const k = key(x + dx, y + dy)
        if (trail.has(k) && !seen.has(k)) {
          seen.add(k)
          queue.push([x + dx, y + dy])
        }
      }
    }
    assert.equal(seen.size, trail.size, 'a stretch of trail leads nowhere')
  })

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

  test(`${w}×${h}: the landmark stands across the middle of the field, clear of the walkway the top houses open onto`, () => {
    const s = at(w, h, 3, -2)
    const l = s.landmark
    for (let y = l.y; y < l.y + l.h; y++) for (let x = l.x; x < l.x + l.w; x++) assert.ok(inRect(s.bed, x, y), `the landmark reaches ${x},${y}, outside the field`)
    // Centred across the field, to the tile.
    assert.ok(Math.abs(l.x - s.bed.x - (s.bed.x + s.bed.w - l.x - l.w)) <= 1, 'not across the middle of the field')
    // Its tallest tier is 72 px, 4.5 tiles, from the bottom of its footprint: that must stay below
    // the row where the top houses' doors are, and whoever stands at them.
    assert.ok(l.y + l.h - 72 / 16 >= s.walkTop + 0.5, `its top reaches ${l.y + l.h - 4.5}, over the doorsteps on row ${s.walkTop}`)
  })

  test(`${w}×${h}: what a landmark brings stands in the fence line, clear of every gap, the board and each other`, () => {
    const s = at(w, h, 1, 2)
    const ringOf = (x, y) => Math.min(x - s.x0, y - s.y0, s.x0 + s.w - 1 - x, s.y0 + s.h - 1 - y)
    const taken = new Set()
    let before = []
    for (let tier = 0; tier <= 5; tier++) {
      const props = propsOf(s, tier)
      // Each tier keeps what the tiers below it brought.
      for (const p of before) assert.ok(props.some((q) => q.sprite === p.sprite && q.x === p.x && q.y === p.y), `tier ${tier} lost a ${p.sprite}`)
      assert.ok(props.length > before.length || tier === 0, `tier ${tier} brings nothing`)
      before = props
    }
    for (const p of before) {
      assert.equal(ringOf(p.x, p.y), 1, `a ${p.sprite} at ${p.x},${p.y} is off the fence line`)
      const gap = isFenceGap(s, p.x - s.x0, p.y - s.y0)
      if (p.walk) assert.ok(gap, 'the gateway stands over a gap')
      else assert.ok(p.tiles.length > 0, `a ${p.sprite} takes no tile`)
      for (const [x, y] of p.tiles) {
        assert.equal(ringOf(x, y), 1, `a ${p.sprite} takes ${x},${y}, off the fence line`)
        assert.ok(!isFenceGap(s, x - s.x0, y - s.y0), `a ${p.sprite} plugs the gap at ${x},${y}`)
        assert.ok(!taken.has(key(x, y)), `two props share ${x},${y}`)
        taken.add(key(x, y))
      }
    }
    assert.ok(!taken.has(key(s.board.x, s.board.y)))
  })

  test(`${w}×${h}: flowers fill the field round the landmark, one to a spot`, () => {
    const s = at(w, h, -2, 1)
    const seen = new Set()
    for (let i = 0; i < s.spots.length; i++) {
      const { x, y } = flowerAt(s, i)
      assert.ok(inRect(s.bed, x, y), `flower ${i} is outside the field`)
      assert.ok(!inRect(s.landmark, x, y), `flower ${i} is on the landmark`)
      assert.ok(!seen.has(`${x},${y}`), `two flowers at ${x},${y}`)
      seen.add(`${x},${y}`)
    }
    assert.equal(capacityOf(w, h).flowers, s.spots.length)
  })

  test(`${w}×${h}: every door and every fence gap can be reached from the road`, () => {
    const s = at(w, h, 1, -1)
    const blocked = new Set([key(s.board.x, s.board.y)])
    for (const slot of s.slots) for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) blocked.add(key(slot.x + dx, slot.y + dy))
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) blocked.add(key(s.landmark.x + dx, s.landmark.y + dy))
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
    for (let y = s.bed.y; y < s.bed.y + s.bed.h; y++) {
      for (let x = s.bed.x; x < s.bed.x + s.bed.w; x++) if (!inRect(s.landmark, x, y)) assert.ok(seen.has(key(x, y)), `field tile ${x},${y} is shut in`)
    }
  })
}

test('in a small field the rows beside the landmark are shorter, and the one below starts under it', () => {
  const s = at(1, 1)
  const rows = new Map()
  for (const p of s.spots) rows.set(p.row, (rows.get(p.row) || 0) + 1)
  assert.deepEqual([...rows.values()], [8, 8, 8, 4, 4, 4, 4])
  // Soil follows the flowers: a flower beside the landmark still has ploughed ground under it.
  for (let n = 1; n <= s.spots.length; n++) {
    const { y } = flowerAt(s, n - 1)
    assert.ok(Math.floor(y - 0.01) < s.bed.y + tilledRows(s, n), `flower ${n} is on grass`)
  }
})

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
  // Deep enough that the rows below the landmark run clear across; the first ones, level with it,
  // are short, so the row is as wide as the spots in it.
  const s = at(1, 2)
  // Spots kept for last are back in the first rows, so it is the leading run that is one row.
  const first = s.spots.findIndex((p) => p.row !== 0)
  assert.ok(first > 0 && first < s.flowers.cols, 'the landmark stands in the first row')
  assert.equal(flowerAt(s, 1).y, flowerAt(s, 0).y)
  assert.ok(flowerAt(s, 1).x > flowerAt(s, 0).x)
  assert.equal(flowerAt(s, first).x, flowerAt(s, 0).x)
  assert.ok(flowerAt(s, first).y > flowerAt(s, 0).y)
  assert.equal(tilledRows(s, 0), 1, 'an empty field is one strip of soil')
  assert.equal(tilledRows(s, first + 1), 2)
  assert.equal(tilledRows(s, 10_000), s.bed.h, 'never past the field')
  // Every flower that fits stands on ploughed ground, the last ones included: they are back up
  // the field, behind the landmark, on soil turned long before.
  for (let n = 1; n <= capacityOf(1, 2).flowers; n++) {
    const { y } = flowerAt(s, n - 1)
    assert.ok(Math.floor(y - 0.01) < s.bed.y + tilledRows(s, n), `flower ${n} is on grass`)
  }
})

test('a landmark stands where it is asked in the field, and never high enough to reach the doorsteps', () => {
  for (const [w, h] of SHAPES) {
    const ys = LANDMARK_SPOTS.map((spot) => at(w, h, 0, 0, spot).landmark.y)
    const [top, middle, bottom] = ys
    assert.ok(top <= middle && middle <= bottom, `${w}×${h}: the spots are out of order: ${ys}`)
    for (const [i, spot] of LANDMARK_SPOTS.entries()) {
      const s = at(w, h, 0, 0, spot)
      assert.ok(s.landmark.y >= s.bed.y && s.landmark.y + s.landmark.h <= s.bed.y + s.bed.h, `${w}×${h} ${spot}: outside the field`)
      // Its tallest tier is 72 px: at the head of the field it reaches into the walkway, never past it.
      assert.ok(silhouette(s).y >= s.walkTop, `${w}×${h} ${spot}: its tallest tier is over the houses`)
      if (i === 2) assert.equal(s.landmark.y + s.landmark.h, s.bed.y + s.bed.h, `${w}×${h}: not at the foot of the field`)
    }
    // A field with no room for the spot asked puts it as low as it must go, not out of the field.
    assert.equal(at(w, h, 0, 0, 'nonsense').landmark.y, at(w, h).landmark.y, `${w}×${h}: a spot we don't know isn't the default`)
  }
})

test('a plot holds the same work wherever its landmark stands, so the layout needn’t know', () => {
  for (const [w, h] of SHAPES) {
    const counts = LANDMARK_SPOTS.map((spot) => at(w, h, 0, 0, spot).spots.length)
    assert.deepEqual(counts, counts.map(() => capacityOf(w, h).flowers), `${w}×${h}: ${counts}`)
  }
})

test('nothing is planted behind the landmark while the field has open ground', () => {
  for (const spot of LANDMARK_SPOTS) {
    for (const [w, h] of SHAPES) {
      const s = at(w, h, 0, 0, spot)
      const behind = s.spots.filter((p) => hidden(s, p))
      assert.ok(behind.length > 0, `${w}×${h} ${spot}: the landmark hides none of the field`)
      const firstHidden = s.spots.findIndex((p) => hidden(s, p))
      assert.ok(s.spots.slice(firstHidden).every((p) => hidden(s, p)), `${w}×${h} ${spot}: an open spot is taken after a hidden one`)
      assert.equal(behind.length, s.spots.length - firstHidden)
    }
  }
})
