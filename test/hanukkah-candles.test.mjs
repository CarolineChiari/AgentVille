import test from 'node:test'
import assert from 'node:assert/strict'
import { drawHanukkah } from '../src/render/themes/hanukkah/harvest.js'
import { FLOWER_KINDS } from '../src/sim/flowers.js'
import { PALETTE as P } from '../src/render/sprites/palette.js'

const look = (pc) => JSON.stringify(pc.pixels ?? pc.data ?? [...pc.buf ?? []])
const COLOUR = P.hkPaint[3]

test('every kind of finished work shows its colour, and white differs from it', () => {
  FLOWER_KINDS.forEach((k, i) => {
    for (const stage of [1, 2]) {
      assert.notEqual(look(drawHanukkah(i, stage, COLOUR)), look(drawHanukkah(i, stage, P.white)), `${k.name} stage ${stage}`)
    }
  })
})

test('no two kinds of different work share a candle', () => {
  const seen = new Map()
  FLOWER_KINDS.forEach((k, i) => {
    const key = look(drawHanukkah(i, 2, COLOUR))
    const other = seen.get(key)
    if (other && other.work !== k.work) assert.fail(`${k.name} (${k.work}) is drawn as ${other.name} (${other.work})`)
    seen.set(key, k)
  })
})
