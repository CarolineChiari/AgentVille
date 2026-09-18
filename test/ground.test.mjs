import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LAWN_FLOWERS, flowerOf, lawnCover, lawnTone, meadowTone, tintMeadow } from '../src/render/ground.js'
import { PALETTE as P } from '../src/render/sprites/palette.js'

const TONES = [P.grass, P.grassSunny, P.grassLush]
const rgb = (hex) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]

test('the countryside has sunny, lush and plain grass, each in patches a few tiles across', () => {
  const counts = [0, 0, 0]
  let changes = 0
  let pairs = 0
  // Sampled every 8 px, half a tile, which steps over the few pixels of dither along an edge.
  for (let y = 0; y < 2000; y += 8) {
    let prev = -1
    for (let x = 0; x < 2000; x += 8) {
      const t = meadowTone(x, y)
      counts[t]++
      if (prev >= 0) {
        pairs++
        if (t !== prev) changes++
      }
      prev = t
    }
  }
  const total = counts[0] + counts[1] + counts[2]
  for (const c of counts) assert.ok(c / total > 0.12, `a tone covers only ${((c / total) * 100).toFixed(1)}%`)
  const run = (8 * pairs) / changes
  assert.ok(run > 40 && run < 160, `patches run ${run.toFixed(0)} px on average; a tile is 16`)
})

test('the tone of a place never changes', () => {
  assert.equal(meadowTone(123, 456), meadowTone(123, 456))
})

test('only plain grass is recoloured, into the matching green of its tone', () => {
  // A strip of plain grass long enough to cross every tone, with a path pixel every few.
  const w = 600
  const data = new Uint8ClampedArray(w * 4)
  for (let x = 0; x < w; x++) {
    const hex = x % 7 === 0 ? P.path : P.grass[x % 4]
    data.set([...rgb(hex), 255], x * 4)
  }
  tintMeadow(data, w, 1, 0, 40, TONES)
  for (let x = 0; x < w; x++) {
    const got = [...data.slice(x * 4, x * 4 + 3)]
    if (x % 7 === 0) assert.deepEqual(got, rgb(P.path))
    else assert.deepEqual(got, rgb(TONES[meadowTone(x, 40)][x % 4]))
  }
})

test('transparent pixels stay transparent', () => {
  const data = new Uint8ClampedArray(8)
  tintMeadow(data, 2, 1, 0, 0, TONES)
  assert.deepEqual([...data], [0, 0, 0, 0, 0, 0, 0, 0])
})

test('the three sets of greens line up one for one', () => {
  assert.equal(P.grassSunny.length, P.grass.length)
  assert.equal(P.grassLush.length, P.grass.length)
})

test('every lawn has sunny and lush patches too, smaller than a meadow\'s', () => {
  const counts = [0, 0, 0]
  let changes = 0
  let pairs = 0
  for (let y = 0; y < 2000; y += 8) {
    let prev = -1
    for (let x = 0; x < 2000; x += 8) {
      const t = lawnTone(x, y)
      counts[t]++
      if (prev >= 0) {
        pairs++
        if (t !== prev) changes++
      }
      prev = t
    }
  }
  const total = counts[0] + counts[1] + counts[2]
  for (const c of counts) assert.ok(c / total > 0.18, `a lawn tone covers only ${((c / total) * 100).toFixed(1)}%`)
  const run = (8 * pairs) / changes
  assert.ok(run > 24 && run < 100, `lawn patches run ${run.toFixed(0)} px on average`)
})

test('no two sets of greens share a colour, so one tint pass never recolours another\'s pixels', () => {
  const sets = [P.grass, P.grassSunny, P.grassLush, ...P.yardTones, ...P.yardSunny, ...P.yardLush]
  const seen = new Map()
  for (const set of sets) {
    for (const c of set) {
      assert.ok(!seen.has(c.toLowerCase()), `${c} is in two sets of greens`)
      seen.set(c.toLowerCase(), true)
    }
  }
  P.yardTones.forEach((plain, t) => {
    assert.equal(P.yardSunny[t].length, plain.length)
    assert.equal(P.yardLush[t].length, plain.length)
  })
})

/** Lawn cover over a big square of lawn. */
const COVER = []
for (let y = -60; y < 60; y++) for (let x = -60; x < 60; x++) COVER.push([x, y, lawnCover(x, y)])

test('a lawn is mostly plain grass, with some cover on it', () => {
  const covered = COVER.filter(([, , c]) => c).length / COVER.length
  assert.ok(covered > 0.08 && covered < 0.25, `${(covered * 100).toFixed(1)}% of the lawn is covered`)
  const kinds = new Set(COVER.filter(([, , c]) => c).map(([, , c]) => c.kind))
  for (const k of ['clover', 'lawnflowers', 'tuft', 'pebbles', 'mushrooms']) assert.ok(kinds.has(k), `no ${k} anywhere`)
  assert.deepEqual(lawnCover(12, -7), lawnCover(12, -7))
})

test('clover and flowers grow in drifts, and a drift is one kind of flower', () => {
  const at = new Map(COVER.map(([x, y, c]) => [`${x},${y}`, c]))
  const near = (x, y, f) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => f(at.get(`${x + dx},${y + dy}`)))
  for (const kind of ['clover', 'lawnflowers']) {
    // Dandelions also turn up one at a time anywhere, so they are left out of the count.
    const is = (c) => c?.kind === kind && !(kind === 'lawnflowers' && flowerOf(c.variant) === LAWN_FLOWERS.indexOf('dandelion'))
    const tiles = COVER.filter(([, , c]) => is(c))
    const share = tiles.length / COVER.length
    const clustered = tiles.filter(([x, y]) => near(x, y, is)).length / tiles.length
    // Scattered at random, a tile would have a neighbour like it about 4 × share of the time.
    assert.ok(clustered > 4 * share * 2, `${kind} is scattered, not drifted: ${clustered.toFixed(2)} vs ${(4 * share).toFixed(2)}`)
  }
  // Next to a flower, almost always the same flower.
  let same = 0
  let pairs = 0
  for (const [x, y, c] of COVER) {
    if (c?.kind !== 'lawnflowers') continue
    const o = at.get(`${x + 1},${y}`)
    if (o?.kind !== 'lawnflowers') continue
    pairs++
    if (flowerOf(o.variant) === flowerOf(c.variant)) same++
  }
  assert.ok(pairs > 10 && same / pairs > 0.8, `${same} of ${pairs} neighbouring flowers match`)
})

test('neighbouring tiles of a drift are not all the same stamp', () => {
  const stamps = new Set(COVER.filter(([, , c]) => c?.kind === 'clover' || c?.kind === 'lawnflowers').map(([, , c]) => `${c.kind}.${c.variant}`))
  assert.ok(stamps.size >= 16, `only ${stamps.size} different stamps across the lawn`)
})
