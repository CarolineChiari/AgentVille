import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CONTEXT, countDiff, diffLines, foldContext, lines } from '../src/sim/diff.js'
import { REVIEW_ROWS, reviewRows } from '../src/sim/room.js'

const signs = (rows) => rows.map((r) => r.sign).join('')
const shown = (rows) => rows.map((r) => `${r.sign}${r.text}`)

test('text splits into lines without a phantom last one', () => {
  assert.deepEqual(lines('a\nb\n'), ['a', 'b'])
  assert.deepEqual(lines('a\nb'), ['a', 'b'])
  assert.deepEqual(lines(''), [])
  assert.deepEqual(lines('\n'), [''])
})

test('a one-line change keeps what it kept and marks what it swapped', () => {
  const rows = diffLines('const a = 1\nconst b = 2\n', 'const a = 2\nconst b = 2\n')
  assert.deepEqual(shown(rows), ['-const a = 1', '+const a = 2', ' const b = 2'])
  assert.deepEqual(countDiff(rows), { added: 1, removed: 1 })
})

test('a file that did not exist before is all arrival', () => {
  assert.equal(signs(diffLines('', 'one\ntwo')), '++')
  assert.equal(signs(diffLines('one\ntwo', '')), '--')
  assert.deepEqual(diffLines('', ''), [])
})

test('lines inserted in the middle are insertions, not a rewrite', () => {
  const rows = diffLines('a\nb\nc', 'a\nx\ny\nb\nc')
  assert.deepEqual(shown(rows), [' a', '+x', '+y', ' b', ' c'])
})

test('a run of untouched lines is folded away, with a count', () => {
  const before = ['head', ...Array.from({ length: 20 }, (_, i) => `line ${i}`), 'tail'].join('\n')
  const after = before.replace('line 10', 'line ten')
  const folded = foldContext(diffLines(before, after))
  const skip = folded.filter((r) => r.sign === '…')
  assert.equal(skip.length, 2, 'the quiet runs above and below')
  assert.match(skip[0].text, /unchanged lines$/)
  // Exactly the context asked for is kept either side of the change.
  const changed = folded.findIndex((r) => r.sign === '-')
  assert.equal(folded.slice(changed - CONTEXT, changed).every((r) => r.sign === ' '), true)
  assert.ok(folded.length < 26, 'and the rest is gone')
})

test('a change with nothing quiet around it folds nothing away', () => {
  const rows = foldContext(diffLines('a\nb', 'a\nc'))
  assert.deepEqual(shown(rows), [' a', '-b', '+c'])
})

test('an unreasonably long pair is shown as one going and one arriving', () => {
  const big = Array.from({ length: 700 }, (_, i) => `l${i}`).join('\n')
  const rows = diffLines(big, big.replace('l0', 'l zero'))
  assert.equal(rows.length, 1400)
  assert.equal(rows[0].sign, '-')
  assert.equal(rows.at(-1).sign, '+')
})

test('reading a file close up lists each edit, newest first, with its own diff', () => {
  const file = {
    ok: true,
    path: 'src/a.js',
    edits: [
      { at: 1000, tool: 'Write', kind: 'created', hunks: [{ before: '', after: 'const a = 1' }] },
      { at: 2000, tool: 'Edit', kind: 'edited', hunks: [{ before: 'const a = 1', after: 'const a = 2' }] },
    ],
  }
  const page = reviewRows(file, { now: 2000 })
  assert.equal(page.lines[0].act, 'back', 'there is always a way back to the log')
  const heads = page.lines.filter((l) => l.type === 'edit-head')
  assert.deepEqual(heads.map((h) => h.text), ['Edit', 'Write'])
  assert.deepEqual(heads[0], { type: 'edit-head', text: 'Edit', when: 'now', added: 1, removed: 1 })
  assert.deepEqual(page.lines.filter((l) => l.type === 'diff').map((l) => `${l.sign}${l.text}`), [
    '-const a = 1',
    '+const a = 2',
    '+const a = 1',
  ])
})

test('an edit that touched several places shows each, divided', () => {
  const file = {
    ok: true,
    path: 'a.js',
    edits: [{ at: 1, tool: 'MultiEdit', kind: 'edited', hunks: [{ before: 'x', after: 'y' }, { before: 'p', after: 'q' }] }],
  }
  const page = reviewRows(file, { now: 1 })
  assert.match(page.lines.find((l) => l.type === 'edit-head').text, /2 places/)
  assert.equal(page.lines.filter((l) => l.type === 'hunk').length, 1, 'a rule between the two')
})

test('the close-up board pages like the log does, and says when there is nothing to read', () => {
  const many = {
    ok: true,
    path: 'a.js',
    edits: Array.from({ length: 30 }, (_, i) => ({ at: i, tool: 'Edit', kind: 'edited', hunks: [{ before: `a${i}`, after: `b${i}` }] })),
  }
  const page = reviewRows(many, { now: 0 })
  assert.equal(page.lines.length, REVIEW_ROWS)
  assert.equal(reviewRows(many, { scroll: 9999, now: 0 }).scroll, page.total - REVIEW_ROWS)
  assert.match(reviewRows(null, {}).lines[1].text, /Reading/)
  assert.match(reviewRows({ ok: false, error: 'gone' }, {}).lines[1].text, /gone/)
  assert.match(reviewRows({ ok: true, edits: [] }, {}).lines[1].text, /Nothing was written/)
})
