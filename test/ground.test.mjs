import { test } from 'node:test'
import assert from 'node:assert/strict'
import { meadowTone, tintMeadow } from '../src/render/ground.js'
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
