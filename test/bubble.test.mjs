import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fitLine } from '../src/render/bubble.js'

// One unit per character, so widths are lengths.
const len = (s) => s.length

test('a line that fits is kept whole, its whitespace tidied', () => {
  assert.equal(fitLine('  Use   Postgres?\n', 40, len), 'Use Postgres?')
  assert.equal(fitLine('', 40, len), '')
  assert.equal(fitLine(undefined, 40, len), '')
})

test('a long line is cut at a word and ends in an ellipsis, within the width', () => {
  const out = fitLine('Should the cache live in Redis or in memory?', 20, len)
  assert.equal(out, 'Should the cache…')
  assert.ok(out.length <= 20)
})

test('one long word is cut mid-word rather than lost', () => {
  const out = fitLine('x'.repeat(50), 10, len)
  assert.equal(out, `${'x'.repeat(9)}…`)
})

test('punctuation left at the cut is dropped before the ellipsis', () => {
  assert.equal(fitLine('Rename it, then ship', 12, len), 'Rename it…')
})

test('with no room even for the ellipsis, nothing', () => {
  assert.equal(fitLine('Anything', 0, len), '')
})
