import { test } from 'node:test'
import assert from 'node:assert/strict'
import { FLOWER_KINDS, WORK, flowerFor, workOf } from '../src/sim/flowers.js'

test('there are fifty kinds with unique names, and every work type has its own family', () => {
  assert.equal(FLOWER_KINDS.length, 50)
  assert.equal(new Set(FLOWER_KINDS.map((k) => k.name)).size, 50)
  for (const w of WORK) assert.ok(FLOWER_KINDS.filter((k) => k.work === w.id).length >= 3, w.id)
})

test('work type is read from the title and prompt', () => {
  const cases = {
    'Fix login redirect bug': 'fix',
    'Main branch merge conflicts': 'review',
    'Write unit tests for the parser': 'test',
    'Investigate memory leak': 'perf',
    'Tidy up the README': 'docs',
    'Dropdown and checkbox styling': 'ui',
    'Build PowerShell automated server patching system': 'infra',
    'Database schema for invoices': 'data',
    'Refactor the scheduler': 'refactor',
    'Add CSV export': 'data',
    'Implement the recipe section': 'feature',
    'Technology tree planning': 'research',
    'Hello there': 'misc',
  }
  for (const [title, work] of Object.entries(cases)) assert.equal(workOf(title), work, title)
})

test('a thread always gets the same flower and colour, drawn from its work family', () => {
  const t = { id: 'claude-code:abc', title: 'Fix the crash on save' }
  const a = flowerFor(t)
  assert.deepEqual(flowerFor(t), a)
  assert.equal(FLOWER_KINDS[a.kind].work, 'fix')
  const colours = new Set(Array.from({ length: 40 }, (_, i) => flowerFor({ id: `x${i}`, title: 'fix' }).color % 14))
  assert.ok(colours.size > 5, 'colours vary from thread to thread')
})
