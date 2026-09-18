import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Building, KINDS, NEW_KINDS, NEW_KIND_CHANCE } from '../src/sim/building.js'

const IDS = Array.from({ length: 3000 }, (_, i) => `claude-code:${i * 7919}`)

test('a thread always builds the same thing', () => {
  const a = new Building('t42')
  const b = new Building('t42')
  assert.equal(a.kind, b.kind)
  assert.equal(a.variant, b.variant)
})

test('buildings from before the new kinds keep what they were, unless their own second roll picks a new kind', () => {
  // Recorded before towers, greenhouses and stalls existed.
  const before = { t1: ['shop', 466], t2: ['workshop', 569], t3: ['farm', 672], 'demo:1': ['cottage', 43], 'demo:2': ['windmill', 937], 'demo:3': ['house', 834] }
  for (const [id, [kind, variant]] of Object.entries(before)) {
    const b = new Building(id)
    assert.equal(b.variant, variant, `${id}'s variant moved`)
    assert.ok(b.kind === kind || NEW_KINDS.includes(b.kind), `${id} was a ${kind} and is now a ${b.kind}`)
  }
})

test('about one building in seven is one of the new kinds, each about as often as the others', () => {
  const counts = Object.fromEntries(KINDS.map((k) => [k, 0]))
  for (const id of IDS) counts[new Building(id).kind]++
  for (const k of KINDS) assert.ok(counts[k] > 0, `nobody builds a ${k}`)
  const fresh = NEW_KINDS.reduce((n, k) => n + counts[k], 0) / IDS.length
  assert.ok(Math.abs(fresh - NEW_KIND_CHANCE) < 0.03, `${(fresh * 100).toFixed(1)}% are new kinds`)
  for (const k of NEW_KINDS) assert.ok(Math.abs(counts[k] / IDS.length - NEW_KIND_CHANCE / NEW_KINDS.length) < 0.02, k)
})
