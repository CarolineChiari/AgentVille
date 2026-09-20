import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ENTRIES_MAX, changeLog, commitMessage, filesTouched, relativePath, shellArgs } from '../server/harnesses/claude-code/changes.mjs'

const ROOT = '/Users/me/repo'
const at = (n) => new Date(Date.parse('2026-09-01T10:00:00Z') + n * 1000).toISOString()

const assistant = (blocks, n = 0) => ({ type: 'assistant', timestamp: at(n), message: { role: 'assistant', content: blocks } })
const result = (id, isError = false) => ({ type: 'user', timestamp: at(1), message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, is_error: isError }] } })
const tool = (name, input, id = 't1') => ({ type: 'tool_use', id, name, input })
const bash = (command, id = 'b1') => tool('Bash', { command }, id)

test('a path inside the repo goes relative, one outside stays absolute', () => {
  assert.deepEqual(relativePath(`${ROOT}/src/sim/frame.js`, ROOT), { path: 'src/sim/frame.js', outside: false })
  assert.deepEqual(relativePath('/etc/hosts', ROOT), { path: '/etc/hosts', outside: true })
  // A sibling whose name starts with the repo's is not inside it.
  assert.equal(relativePath('/Users/me/repo-two/x.js', ROOT).outside, true)
  // Windows paths read the same on a Mac, drive letter case and all.
  assert.deepEqual(relativePath('c:\\code\\app\\src\\x.js', 'C:/code/app'), { path: 'src/x.js', outside: false })
  // With no root there is nothing to be relative to.
  assert.equal(relativePath('/a/b.js', '').outside, true)
})

test('shell arguments come back with their quotes resolved', () => {
  assert.deepEqual(shellArgs('rm -f "a file.txt" \'b.txt\' c.txt'), ['rm', '-f', 'a file.txt', 'b.txt', 'c.txt'])
})

test('a commit message is read from either form the CLI writes', () => {
  assert.equal(commitMessage('git commit -m "Tidy the frame"'), 'Tidy the frame')
  assert.equal(commitMessage("git commit -m 'Tidy the frame'"), 'Tidy the frame')
  assert.equal(commitMessage('git commit -m "$(cat <<\'EOF\'\nTidy the frame\n\nAnd its tests.\nEOF\n)"'), 'Tidy the frame And its tests.')
  assert.equal(commitMessage('git status'), '')
})

test('the log reads every writing tool, with a before → after', () => {
  const { entries } = changeLog([
    assistant([tool('Write', { file_path: `${ROOT}/src/new.js`, content: 'export const a = 1\nexport const b = 2\n' }, 'w1')], 0),
    assistant([tool('Edit', { file_path: `${ROOT}/src/new.js`, old_string: 'const a = 1', new_string: 'const a = 2' }, 'e1')], 1),
    assistant([tool('MultiEdit', { file_path: `${ROOT}/src/old.js`, edits: [{ old_string: 'x', new_string: 'y' }, { old_string: 'p', new_string: 'q' }] }, 'm1')], 2),
    assistant([tool('NotebookEdit', { notebook_path: `${ROOT}/nb.ipynb`, new_source: 'print(1)' }, 'n1')], 3),
  ], { root: ROOT })
  assert.deepEqual(entries.map((e) => [e.path, e.kind, e.tool]), [
    ['src/new.js', 'created', 'Write'],
    ['src/new.js', 'edited', 'Edit'],
    ['src/old.js', 'edited', 'MultiEdit'],
    ['nb.ipynb', 'edited', 'NotebookEdit'],
  ])
  assert.equal(entries[0].excerpt, 'export const a = 1 …')
  assert.equal(entries[1].excerpt, 'const a = 1 → const a = 2')
  assert.match(entries[2].excerpt, /^2 edits: x → y$/)
})

test('a second Write of the same file edited it rather than creating it', () => {
  const { entries } = changeLog([
    assistant([tool('Write', { file_path: `${ROOT}/a.js`, content: 'one' }, 'w1')], 0),
    assistant([tool('Write', { file_path: `${ROOT}/a.js`, content: 'two' }, 'w2')], 1),
  ], { root: ROOT })
  assert.deepEqual(entries.map((e) => e.kind), ['created', 'edited'])
})

test('a tool call that came back an error never made it to disk', () => {
  const { entries } = changeLog([
    assistant([tool('Edit', { file_path: `${ROOT}/a.js`, old_string: 'x', new_string: 'y' }, 'e1')], 0),
    result('e1', true),
    assistant([tool('Edit', { file_path: `${ROOT}/b.js`, old_string: 'x', new_string: 'y' }, 'e2')], 1),
    result('e2'),
    // Still running: no result yet, and the edit is real.
    assistant([tool('Edit', { file_path: `${ROOT}/c.js`, old_string: 'x', new_string: 'y' }, 'e3')], 2),
  ], { root: ROOT })
  assert.deepEqual(entries.map((e) => e.path), ['b.js', 'c.js'])
})

test('bash commits, moves and removals are read, chained ones too', () => {
  const log = changeLog([
    assistant([bash(`cd ${ROOT} && git mv src/a.js src/b.js`, 'b1')], 0),
    assistant([bash('rm -rf tmp/out.txt tmp/other.txt', 'b2')], 1),
    assistant([bash('git add -A && git commit -m "Move it"', 'b3')], 2),
    assistant([bash('git status && npm test', 'b4')], 3),
  ], { root: ROOT })
  assert.deepEqual(log.entries.map((e) => [e.path, e.kind]), [
    ['src/b.js', 'renamed'],
    ['tmp/out.txt', 'deleted'],
    ['tmp/other.txt', 'deleted'],
  ])
  assert.equal(log.entries[0].excerpt, 'src/a.js → src/b.js')
  assert.deepEqual(log.commits, [{ at: Date.parse(at(2)), message: 'Move it' }])
})

test('a failed commit is not pinned up', () => {
  const log = changeLog([assistant([bash('git commit -m "nope"', 'b1')], 0), result('b1', true)], { root: ROOT })
  assert.deepEqual(log.commits, [])
})

test('a subagent’s edits count: they changed the same working tree', () => {
  const { entries } = changeLog([
    { ...assistant([tool('Write', { file_path: `${ROOT}/sub.js`, content: 'x' }, 'w1')], 0), isSidechain: true },
  ], { root: ROOT })
  assert.deepEqual(entries.map((e) => e.path), ['sub.js'])
})

test('the log stops at its cap and says how much it dropped', () => {
  const records = []
  for (let i = 0; i < ENTRIES_MAX + 5; i++) {
    records.push(assistant([tool('Edit', { file_path: `${ROOT}/f${i}.js`, old_string: 'x', new_string: 'y' }, `e${i}`)], i))
  }
  const log = changeLog(records, { root: ROOT })
  assert.equal(log.entries.length, ENTRIES_MAX)
  assert.equal(log.dropped, 5)
})

test('files are grouped most edited first, and the cap is reported', () => {
  const entries = [
    { path: 'a.js', outside: false, kind: 'created', at: 1 },
    { path: 'a.js', outside: false, kind: 'edited', at: 3 },
    { path: 'b.js', outside: false, kind: 'edited', at: 2 },
    { path: '/etc/hosts', outside: true, kind: 'edited', at: 4 },
  ]
  const { files, more } = filesTouched(entries, { max: 2 })
  assert.deepEqual(files.map((f) => [f.path, f.edits]), [['a.js', 2], ['/etc/hosts', 1]])
  assert.equal(files[0].kind, 'created')
  assert.equal(files[1].outside, true)
  assert.equal(more, 1)
})

test('a file written and then deleted reads as deleted', () => {
  const { files } = filesTouched([
    { path: 'a.js', outside: false, kind: 'created', at: 1 },
    { path: 'a.js', outside: false, kind: 'deleted', at: 2 },
  ])
  assert.equal(files[0].kind, 'deleted')
})
