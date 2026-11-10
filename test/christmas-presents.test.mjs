import test from 'node:test'
import assert from 'node:assert/strict'
import { drawChristmas } from '../src/render/themes/christmas/harvest.js'
import { FLOWER_KINDS } from '../src/sim/flowers.js'
import { PALETTE as P } from '../src/render/sprites/palette.js'

const look = (pc) => JSON.stringify(pc.pixels ?? pc.data ?? [...pc.buf ?? []])
const COLOUR = P.xmasPaint[3]

test('every kind of finished work shows its ribbon colour, and white differs from it', () => {
  FLOWER_KINDS.forEach((k, i) => {
    for (const stage of [1, 2]) {
      assert.notEqual(look(drawChristmas(i, stage, COLOUR)), look(drawChristmas(i, stage, P.white)), `${k.name} stage ${stage}`)
    }
  })
})

test('no two kinds of different work share a present', () => {
  const seen = new Map()
  FLOWER_KINDS.forEach((k, i) => {
    const key = look(drawChristmas(i, 2, COLOUR))
    const other = seen.get(key)
    if (other && other.work !== k.work) assert.fail(`${k.name} (${k.work}) is drawn as ${other.name} (${other.work})`)
    seen.set(key, k)
  })
})

test('a present still being wrapped is not a wrapped one', () => {
  FLOWER_KINDS.forEach((k, i) => assert.notEqual(look(drawChristmas(i, 1, COLOUR)), look(drawChristmas(i, 2, COLOUR)), k.name))
})
