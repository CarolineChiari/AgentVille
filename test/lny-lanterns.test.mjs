import test from 'node:test'
import assert from 'node:assert/strict'
import { drawLny } from '../src/render/themes/lunar-new-year/harvest.js'
import { FLOWER_KINDS } from '../src/sim/flowers.js'
import { PALETTE as P } from '../src/render/sprites/palette.js'

const look = (pc) => JSON.stringify(pc.pixels ?? pc.data ?? [...pc.buf ?? []])
const COLOUR = P.lnyPaint[0]

test('every kind of finished work shows its colour, and white differs from it', () => {
  FLOWER_KINDS.forEach((k, i) => {
    for (const stage of [1, 2]) {
      assert.notEqual(look(drawLny(i, stage, COLOUR)), look(drawLny(i, stage, P.white)), `${k.name} stage ${stage}`)
    }
  })
})

// The shape alone: which pixels are drawn, not what colour they are.
const silhouette = (pc) => Array.from(pc.data.filter((_, i) => i % 4 === 3), (a) => (a > 0 ? 1 : 0)).join('')

test('no two kinds of different work share a silhouette', () => {
  for (const stage of [1, 2]) {
    const seen = new Map()
    FLOWER_KINDS.forEach((k, i) => {
      const key = silhouette(drawLny(i, stage, COLOUR))
      const other = seen.get(key)
      if (other && other.work !== k.work) assert.fail(`${k.name} (${k.work}) has the outline of ${other.name} (${other.work}) at stage ${stage}`)
      seen.set(key, k)
    })
  }
})
