import { test } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createClaudeCodeAdapter } from '../server/harnesses/claude-code/index.mjs'
import { HARNESSES } from '../server/harnesses/index.mjs'
import {
  DEAD_PID, assistantRecord, text, tmpHome, toolUse, userRecord, uuid, writeDesktop, writeLive, writeTranscript,
} from './helpers/fixtures.mjs'

const NOW = Date.parse('2026-09-01T12:00:00Z')
const adapterFor = (home) => createClaudeCodeAdapter({ home, env: {}, platform: 'darwin', now: () => NOW })

test('every registered harness honours the contract and never writes', () => {
  for (const h of HARNESSES) {
    assert.match(h.id, /^[a-z][a-z0-9-]*$/)
    for (const fn of ['detect', 'scanThreads', 'openThread', 'newSession']) assert.equal(typeof h[fn], 'function')
    assert.equal(h.setArchived, undefined, `${h.id} must not write to its harness`)
  }
})

test('an absent install is not detected', async (t) => {
  const { home, cleanup } = tmpHome()
  t.after(cleanup)
  assert.equal(await adapterFor(home).detect(), false)
})

test('a desktop record and its transcript merge into one thread', async (t) => {
  const { home, cleanup } = tmpHome()
  t.after(cleanup)
  const id = uuid(1)
  writeTranscript(home, { id, records: [userRecord('build the thing'), assistantRecord(text('ok'))], mtime: NOW - 60_000 })
  writeDesktop(home, {
    sessionId: `local_${uuid(2)}`, cliSessionId: id, cwd: '/work/repo', title: 'The thing',
    createdAt: NOW - 3_600_000, lastActivityAt: NOW - 120_000, lastFocusedAt: NOW - 110_000, model: 'm',
  })
  const threads = await adapterFor(home).scanThreads()
  assert.equal(threads.length, 1)
  const [th] = threads
  assert.equal(th.id, `claude-code:${id}`)
  assert.equal(th.title, 'The thing')
  assert.equal(th.preview, 'build the thing')
  assert.equal(th.project, 'repo')
  assert.equal(th.source, 'desktop')
  assert.equal(th.lastActivityAt, NOW - 60_000) // transcript mtime is newer than the record
  assert.equal(th.unread, false) // record activity (-120s) is older than the focus (-110s)
  assert.equal(th.ref.desktopSessionId, `local_${uuid(2)}`)
})

test('unread when the desktop record moved on after it was focused', async (t) => {
  const { home, cleanup } = tmpHome()
  t.after(cleanup)
  writeDesktop(home, {
    sessionId: `local_${uuid(3)}`, cwd: '/work/repo', title: 'x',
    createdAt: NOW - 10_000, lastActivityAt: NOW - 1000, lastFocusedAt: NOW - 5000,
  })
  const [th] = await adapterFor(home).scanThreads()
  assert.equal(th.unread, true)
})

test('a CLI-only transcript becomes a thread with no focus history', async (t) => {
  const { home, cleanup } = tmpHome()
  t.after(cleanup)
  writeTranscript(home, { id: uuid(4), records: [userRecord('hello')], mtime: NOW - 1000 })
  const [th] = await adapterFor(home).scanThreads()
  assert.equal(th.source, 'cli')
  assert.equal(th.lastFocusedAt, 0)
  assert.equal(th.unread, false)
  assert.equal(th.title, 'hello')
})

test('running needs a live pid and fresh activity', async (t) => {
  const { home, cleanup } = tmpHome()
  t.after(cleanup)
  writeTranscript(home, { id: uuid(5), records: [userRecord('go'), assistantRecord(toolUse())], mtime: NOW - 1000 })
  writeLive(home, { pid: process.pid, sessionId: uuid(5) })
  writeTranscript(home, { id: uuid(6), records: [userRecord('go'), assistantRecord(toolUse())], mtime: NOW - 1000, cwd: '/work/b' })
  writeLive(home, { pid: DEAD_PID, sessionId: uuid(6) })
  writeTranscript(home, { id: uuid(7), records: [userRecord('go'), assistantRecord(toolUse())], mtime: NOW - 3 * 3_600_000, cwd: '/work/c' })
  writeLive(home, { pid: process.ppid, sessionId: uuid(7) })
  const byId = Object.fromEntries((await adapterFor(home).scanThreads()).map((t) => [t.id.slice(-1), t]))
  assert.equal(byId['5'].running, true)
  assert.equal(byId['6'].running, false)
  assert.equal(byId['7'].running, false)
})

test('a waiting thread is unread, not running', async (t) => {
  const { home, cleanup } = tmpHome()
  t.after(cleanup)
  writeTranscript(home, { id: uuid(8), records: [userRecord('go'), assistantRecord(text('done, over to you'))], mtime: NOW - 1000 })
  writeLive(home, { pid: process.pid, sessionId: uuid(8) })
  const [th] = await adapterFor(home).scanThreads()
  assert.equal(th.running, false)
  assert.equal(th.unread, true)
})

test('openThread prefers the desktop link and refuses ids that only stringify to one', () => {
  const a = adapterFor('/nowhere')
  const d = `local_${uuid(9)}`
  assert.equal(a.openThread({ desktopSessionId: d, cliSessionId: uuid(9) }).url, `claude://claude.ai/epitaxy/${d}`)
  assert.equal(a.openThread({ cliSessionId: uuid(9) }).url, `claude://resume?session=${uuid(9)}`)
  assert.equal(a.openThread({ cliSessionId: [uuid(9)] }).ok, false)
  assert.equal(a.openThread({ desktopSessionId: { toString: () => d } }).ok, false)
  assert.equal(a.openThread(null).ok, false)
})

test('newSession URL-encodes the folder and refuses relative paths', async () => {
  const a = adapterFor('/nowhere')
  assert.equal((await a.newSession('/a b/c&d')).url, 'claude://code/new?folder=%2Fa+b%2Fc%26d')
  assert.equal((await a.newSession('relative')).ok, false)
})

test('VS Code: the repo folder opens first, then the session', () => {
  const a = adapterFor('/nowhere')
  const r = a.openThread({ cliSessionId: uuid(9), cwd: '/work/my repo' }, { target: 'vscode' })
  assert.equal(r.ok, true)
  assert.deepEqual(r.urls, ['vscode://file/work/my%20repo/?windowId=_blank', `vscode://anthropic.claude-code/open?session=${uuid(9)}`])
})

test('VS Code refuses a thread that exists only in the desktop app', () => {
  const a = adapterFor('/nowhere')
  assert.equal(a.openThread({ desktopSessionId: `local_${uuid(9)}` }, { target: 'vscode' }).ok, false)
  assert.equal(a.openThread({ cliSessionId: [uuid(9)] }, { target: 'vscode' }).ok, false)
})

test('VS Code new session opens the folder, then a fresh conversation', async () => {
  const r = await adapterFor('/nowhere').newSession('/work/app', { target: 'vscode' })
  assert.deepEqual(r.urls, ['vscode://file/work/app/?windowId=_blank', 'vscode://anthropic.claude-code/open'])
})

test('vscodeFolderUrl forward-slashes Windows paths', async () => {
  const { vscodeFolderUrl } = await import('../server/harnesses/claude-code/index.mjs')
  assert.equal(vscodeFolderUrl('C:\\code\\my app'), 'vscode://file/C:/code/my%20app/?windowId=_blank')
})

test('readTranscript finds a thread by its CLI id and returns the newest messages', async (t) => {
  const { home, cleanup } = tmpHome()
  t.after(cleanup)
  const records = []
  for (let i = 0; i < 5; i++) records.push(userRecord(`q${i}`), assistantRecord(text(`a${i}`)))
  writeTranscript(home, { id: uuid(20), records, mtime: NOW - 1000 })
  const a = adapterFor(home)
  const r = await a.readTranscript({ cliSessionId: uuid(20) }, { limit: 3 })
  assert.equal(r.ok, true)
  assert.equal(r.total, 10)
  assert.deepEqual(r.messages.map((m) => m.text), ['a3', 'q4', 'a4'])
  assert.equal((await a.readTranscript({ cliSessionId: [uuid(20)] })).ok, false, 'ids are type-checked')
  assert.equal((await a.readTranscript({ cliSessionId: uuid(21) })).ok, false)
})

test('readChanges lists what a session touched, relative to its folder', async (t) => {
  const { home, cleanup } = tmpHome()
  t.after(cleanup)
  const call = (name, input, id) => assistantRecord([{ type: 'tool_use', id, name, input }])
  writeTranscript(home, {
    id: uuid(22),
    records: [
      userRecord('do the work'),
      call('Write', { file_path: '/work/repo/src/new.js', content: 'export const a = 1' }, 'w1'),
      call('Edit', { file_path: '/work/repo/src/new.js', old_string: 'a = 1', new_string: 'a = 2' }, 'e1'),
      call('Edit', { file_path: '/work/repo/README.md', old_string: 'x', new_string: 'y' }, 'e2'),
      call('Edit', { file_path: '/elsewhere/notes.md', old_string: 'x', new_string: 'y' }, 'e3'),
      call('Bash', { command: 'git commit -m "Add the thing"' }, 'b1'),
    ],
    mtime: NOW - 1000,
  })
  const a = adapterFor(home)
  const r = await a.readChanges({ cliSessionId: uuid(22), cwd: '/work/repo' })
  assert.equal(r.ok, true)
  assert.equal(r.root, '/work/repo')
  assert.deepEqual(r.files.map((f) => [f.path, f.edits, f.outside]), [
    ['src/new.js', 2, false],
    // Same timestamp in the fixture, so the tie breaks on the path.
    ['/elsewhere/notes.md', 1, true],
    ['README.md', 1, false],
  ])
  assert.equal(r.entries, undefined, 'a card asks for the summary only')
  const full = await a.readChanges({ cliSessionId: uuid(22), cwd: '/work/repo' }, { detail: true })
  assert.deepEqual(full.entries.map((e) => e.tool), ['Write', 'Edit', 'Edit', 'Edit'])
  assert.deepEqual(full.commits.map((c) => c.message), ['Add the thing'])
  assert.equal((await a.readChanges({ cliSessionId: [uuid(22)] })).ok, false, 'ids are type-checked')
})

test('readChanges reads one file\'s own before and after when asked for it', async (t) => {
  const { home, cleanup } = tmpHome()
  t.after(cleanup)
  const call = (name, input, id) => assistantRecord([{ type: 'tool_use', id, name, input }])
  writeTranscript(home, {
    id: uuid(23),
    records: [
      userRecord('do the work'),
      call('Write', { file_path: '/work/repo/src/a.js', content: 'const a = 1\n' }, 'w1'),
      call('Edit', { file_path: '/work/repo/src/a.js', old_string: 'const a = 1', new_string: 'const a = 2' }, 'e1'),
      call('Edit', { file_path: '/work/repo/src/b.js', old_string: 'x', new_string: 'y' }, 'e2'),
    ],
    mtime: NOW - 1000,
  })
  const a = adapterFor(home)
  const r = await a.readChanges({ cliSessionId: uuid(23), cwd: '/work/repo' }, { path: 'src/a.js' })
  assert.equal(r.ok, true)
  assert.equal(r.path, 'src/a.js')
  assert.deepEqual(r.edits.map((e) => e.tool), ['Write', 'Edit'])
  assert.deepEqual(r.edits[0].hunks, [{ before: '', after: 'const a = 1\n' }])
  assert.deepEqual(r.edits[1].hunks, [{ before: 'const a = 1', after: 'const a = 2' }])
  // Only the file asked about carries its text; the log of everything carries none of it.
  const log = await a.readChanges({ cliSessionId: uuid(23), cwd: '/work/repo' }, { detail: true })
  assert.equal(log.entries.every((e) => e.hunks === undefined), true)
  assert.deepEqual((await a.readChanges({ cliSessionId: uuid(23), cwd: '/work/repo' }, { path: 'nope.js' })).edits, [])
})

test('VS Code new session prefills a prompt, and leaves one too long for a link to the clipboard', async () => {
  const a = adapterFor('/nowhere')
  const r = await a.newSession('/work/app', { target: 'vscode', prompt: 'Fix the bug & add tests' })
  assert.equal(r.urls[1], 'vscode://anthropic.claude-code/open?prompt=Fix+the+bug+%26+add+tests')
  const long = await a.newSession('/work/app', { target: 'vscode', prompt: 'x'.repeat(5000) })
  assert.equal(long.urls[1], 'vscode://anthropic.claude-code/open')
  assert.equal(long.promptPassed, false, 'never cut short: the page copies the whole prompt instead')
  assert.equal((await a.newSession('/work/app', { target: 'app', prompt: 'hi' })).url, 'claude://code/new?folder=%2Fwork%2Fapp')
})

test('terminal new session passes an allowed model to the CLI, and refuses anything else', async () => {
  const a = createClaudeCodeAdapter({ home: '/nowhere', env: {}, platform: 'darwin', claudePath: '/bin/claude' })
  const r = await a.newSession('/work/app', { target: 'terminal', model: 'opus[1m]', prompt: 'hi' })
  assert.deepEqual(r.terminal, { exe: '/bin/claude', args: ['--model', 'opus[1m]'], cwd: '/work/app', prompt: 'hi' })
  assert.deepEqual((await a.newSession('/work/app', { target: 'terminal' })).terminal.args, [], 'no model means your default')
  for (const bad of ['opus; rm -rf ~', '--dangerously-skip-permissions', 'gpt-4', 'opus[1m] x']) {
    assert.equal((await a.newSession('/work/app', { target: 'terminal', model: bad })).ok, false, bad)
  }
  const both = await a.newSession('/work/app', { target: 'terminal', model: 'sonnet', effort: 'xhigh' })
  assert.deepEqual(both.terminal.args, ['--model', 'sonnet', '--effort', 'xhigh'])
  assert.deepEqual((await a.newSession('/work/app', { target: 'terminal', effort: 'max' })).terminal.args, ['--effort', 'max'])
  for (const bad of ['extreme', 'high; ls', ['high']]) {
    assert.equal((await a.newSession('/work/app', { target: 'terminal', effort: bad })).ok, false, String(bad))
  }
})

test('the process saying it is waiting wins over a transcript that looks busy', async (t) => {
  const { home, cleanup } = tmpHome()
  t.after(cleanup)
  writeTranscript(home, { id: uuid(30), records: [userRecord('go'), assistantRecord(toolUse())], mtime: NOW - 1000 })
  const dir = path.join(home, '.claude', 'sessions')
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, `${process.pid}.json`), JSON.stringify({ pid: process.pid, sessionId: uuid(30), status: 'waiting', waitingFor: 'permission prompt', statusUpdatedAt: NOW }))
  const [th] = await adapterFor(home).scanThreads()
  assert.equal(th.running, false)
  assert.equal(th.unread, true)
  assert.equal(th.needsInput, 'permission prompt')
})

test('a question waiting in the transcript counts as needing you, even hours later', async (t) => {
  const { home, cleanup } = tmpHome()
  t.after(cleanup)
  const ask = assistantRecord([{ type: 'tool_use', id: 'q', name: 'AskUserQuestion', input: {} }])
  writeTranscript(home, { id: uuid(31), records: [userRecord('go'), ask], mtime: NOW - 5 * 3_600_000 })
  writeLive(home, { pid: process.pid, sessionId: uuid(31) })
  const [th] = await adapterFor(home).scanThreads()
  assert.equal(th.needsInput, 'question')
  assert.equal(th.running, false)
})

test('the process status decides working and idle when it has one', async (t) => {
  const { home, cleanup } = tmpHome()
  t.after(cleanup)
  writeTranscript(home, { id: uuid(40), records: [userRecord('go'), assistantRecord(text('done'))], mtime: NOW - 3 * 3_600_000 })
  writeLive(home, { pid: process.pid, sessionId: uuid(40), status: 'busy' })
  writeTranscript(home, { id: uuid(41), records: [userRecord('go'), assistantRecord(toolUse())], mtime: NOW - 1000, cwd: '/work/b' })
  writeLive(home, { pid: process.ppid, sessionId: uuid(41), status: 'idle' })
  const byId = Object.fromEntries((await adapterFor(home).scanThreads()).map((t) => [t.id.slice(-2), t]))
  assert.equal(byId['40'].running, true, 'busy is working, however old the transcript')
  assert.equal(byId['41'].running, false, 'idle is not working, whatever the transcript ends with')
})

test('continueThread resumes the CLI session in its own folder with the prompt', async () => {
  const a = createClaudeCodeAdapter({ home: '/nowhere', env: {}, platform: 'darwin', claudePath: '/bin/claude' })
  const id = uuid(1)
  const r = await a.continueThread({ cliSessionId: id, cwd: '/work/app' }, { prompt: '  commit and push  ' })
  assert.deepEqual(r.terminal, { exe: '/bin/claude', args: ['--resume', id], cwd: '/work/app', prompt: 'commit and push' })
  assert.equal((await a.continueThread({ cliSessionId: '--help', cwd: '/work/app' }, { prompt: 'x' })).ok, false, 'an id that is not a uuid')
  assert.equal((await a.continueThread({ cliSessionId: { toString: () => id }, cwd: '/work/app' }, { prompt: 'x' })).ok, false, 'an id that only stringifies to one')
  assert.equal((await a.continueThread({ cliSessionId: id, cwd: 'relative' }, { prompt: 'x' })).ok, false, 'a relative folder')
  assert.equal((await a.continueThread({ cliSessionId: id, cwd: '/work/app' }, { prompt: '  ' })).ok, false, 'no prompt')
  assert.equal((await a.continueThread(null, { prompt: 'x' })).ok, false)
})

test('continueThread refuses when the CLI is not installed', async () => {
  // Windows looks only under home and PATH, so no machine's /usr/local/bin can make this pass by accident.
  const a = createClaudeCodeAdapter({ home: '/nowhere', env: {}, platform: 'win32' })
  assert.equal((await a.continueThread({ cliSessionId: uuid(1), cwd: '/work/app' }, { prompt: 'x' })).ok, false)
})
