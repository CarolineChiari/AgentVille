import { test } from 'node:test'
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
  assert.deepEqual(a.openThread({ desktopSessionId: d, cliSessionId: uuid(9) }), { ok: true, url: `claude://claude.ai/epitaxy/${d}` })
  assert.deepEqual(a.openThread({ cliSessionId: uuid(9) }), { ok: true, url: `claude://resume?session=${uuid(9)}` })
  assert.equal(a.openThread({ cliSessionId: [uuid(9)] }).ok, false)
  assert.equal(a.openThread({ desktopSessionId: { toString: () => d } }).ok, false)
  assert.equal(a.openThread(null).ok, false)
})

test('newSession URL-encodes the folder and refuses relative paths', () => {
  const a = adapterFor('/nowhere')
  assert.equal(a.newSession('/a b/c&d').url, 'claude://code/new?folder=%2Fa+b%2Fc%26d')
  assert.equal(a.newSession('relative').ok, false)
})

test('VS Code: the repo folder opens first, then the session', () => {
  const a = adapterFor('/nowhere')
  const r = a.openThread({ cliSessionId: uuid(9), cwd: '/work/my repo' }, { target: 'vscode' })
  assert.equal(r.ok, true)
  assert.deepEqual(r.urls, ['vscode://file/work/my%20repo/', `vscode://anthropic.claude-code/open?session=${uuid(9)}`])
})

test('VS Code refuses a thread that exists only in the desktop app', () => {
  const a = adapterFor('/nowhere')
  assert.equal(a.openThread({ desktopSessionId: `local_${uuid(9)}` }, { target: 'vscode' }).ok, false)
  assert.equal(a.openThread({ cliSessionId: [uuid(9)] }, { target: 'vscode' }).ok, false)
})

test('VS Code new session opens the folder, then a fresh conversation', () => {
  const r = adapterFor('/nowhere').newSession('/work/app', { target: 'vscode' })
  assert.deepEqual(r.urls, ['vscode://file/work/app/', 'vscode://anthropic.claude-code/open'])
})

test('vscodeFolderUrl forward-slashes Windows paths', async () => {
  const { vscodeFolderUrl } = await import('../server/harnesses/claude-code/index.mjs')
  assert.equal(vscodeFolderUrl('C:\\code\\my app'), 'vscode://file/C:/code/my%20app/')
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

test('VS Code new session prefills a prompt, capped in length', () => {
  const a = adapterFor('/nowhere')
  const r = a.newSession('/work/app', { target: 'vscode', prompt: 'Fix the bug & add tests' })
  assert.equal(r.urls[1], 'vscode://anthropic.claude-code/open?prompt=Fix+the+bug+%26+add+tests')
  const long = a.newSession('/work/app', { target: 'vscode', prompt: 'x'.repeat(5000) })
  assert.ok(long.urls[1].length < 2000)
  assert.equal(a.newSession('/work/app', { target: 'app', prompt: 'hi' }).url, 'claude://code/new?folder=%2Fwork%2Fapp')
})
