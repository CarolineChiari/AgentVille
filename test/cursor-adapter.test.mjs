import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { createCursorAdapter, bubbleMessages } from '../server/harnesses/cursor/index.mjs'
import { tmpHome, uuid } from './helpers/fixtures.mjs'
import { userDir, workspace, writeItems } from './helpers/editor.mjs'

const NOW = Date.parse('2026-09-01T12:00:00Z')
const adapterFor = (home, extra = {}) => createCursorAdapter({ home, env: {}, platform: 'darwin', now: () => NOW, agentPath: null, ...extra })
const globalDb = (user) => path.join(user, 'globalStorage', 'state.vscdb')

/** A chat record as Cursor ≥ 3.12 writes it, with its first message. */
function composer(user, id, fields = {}, firstText = 'fix the tests') {
  const rows = {
    [`composerData:${id}`]: {
      _v: 13, composerId: id, name: 'Fix tests', createdAt: NOW - 3_600_000, lastUpdatedAt: NOW - 60_000, status: 'completed',
      modelConfig: { modelName: 'claude-opus-5' }, fullConversationHeadersOnly: [{ bubbleId: 'b1', type: 1 }, { bubbleId: 'b2', type: 2 }],
      generatingBubbleIds: [], ...fields,
    },
    [`bubbleId:${id}:b1`]: { bubbleId: 'b1', type: 1, text: firstText, createdAt: NOW - 3_600_000 },
    [`bubbleId:${id}:b2`]: { bubbleId: 'b2', type: 2, text: 'Done.', toolFormerData: { name: 'run_terminal_cmd', params: JSON.stringify({ command: 'npm test' }) } },
  }
  writeItems(globalDb(user), rows, 'cursorDiskKV')
}

test('no Cursor, no villagers', async (t) => {
  const { home, cleanup } = tmpHome()
  t.after(cleanup)
  assert.equal(await adapterFor(home).detect(), false)
  assert.deepEqual(await adapterFor(home).scanThreads(), [])
  assert.deepEqual(await adapterFor(home).targets(), [])
})

test('a chat that records its own workspace stands on that folder', async (t) => {
  const { home, cleanup } = tmpHome()
  t.after(cleanup)
  const user = userDir(home, 'Cursor')
  composer(user, uuid(1), { workspaceIdentifier: { id: 'w', uri: { fsPath: '/work/app' } } })
  const a = adapterFor(home)
  assert.equal(await a.detect(), true)
  const [th] = await a.scanThreads()
  assert.equal(th.id, `cursor:${uuid(1)}`)
  assert.equal(th.title, 'Fix tests')
  assert.equal(th.preview, 'fix the tests')
  assert.equal(th.project, 'app')
  assert.equal(th.model, 'claude-opus-5')
  assert.equal(th.unread, true)
  assert.equal(th.opensIn, 'Cursor')
  const tr = await a.readTranscript(th.ref)
  assert.deepEqual(tr.messages.map((m) => m.role), ['user', 'tool', 'assistant'])
  assert.equal(tr.messages[1].detail, 'npm test')
})

test('older releases: the folder comes from the global headers or the workspace\'s own list', async (t) => {
  const { home, cleanup } = tmpHome()
  t.after(cleanup)
  const user = userDir(home, 'Cursor')
  composer(user, uuid(2))
  composer(user, uuid(3))
  composer(user, uuid(4)) // listed nowhere: no plot, left out
  writeItems(globalDb(user), { 'composer.composerHeaders': { allComposers: [{ composerId: uuid(2), workspaceIdentifier: { uri: { fsPath: '/work/one' } } }] } })
  workspace(user, 'h1', '/work/two', { 'composer.composerData': { allComposers: [{ composerId: uuid(3) }] } })
  const got = Object.fromEntries((await adapterFor(home).scanThreads()).map((t) => [t.id, t.project]))
  assert.deepEqual(got, { [`cursor:${uuid(2)}`]: 'one', [`cursor:${uuid(3)}`]: 'two' })
})

test('the ≥ 3.12 composerHeaders table places a chat too', async (t) => {
  const { home, cleanup } = tmpHome()
  t.after(cleanup)
  const user = userDir(home, 'Cursor')
  composer(user, uuid(6))
  const db = new DatabaseSync(globalDb(user))
  db.exec('CREATE TABLE composerHeaders (composerId TEXT PRIMARY KEY, workspaceId TEXT, createdAt INTEGER, lastUpdatedAt INTEGER, isArchived INTEGER, isSubagent INTEGER, value TEXT)')
  db.prepare('INSERT INTO composerHeaders (composerId, value) VALUES (?, ?)').run(uuid(6), JSON.stringify({ workspaceIdentifier: { uri: { fsPath: '/work/three' } } }))
  db.close()
  assert.equal((await adapterFor(home).scanThreads())[0].project, 'three')
})

test('generating counts only while recent; subagents and empty chats are left out', async (t) => {
  const { home, cleanup } = tmpHome()
  t.after(cleanup)
  const user = userDir(home, 'Cursor')
  const ws = { workspaceIdentifier: { uri: { fsPath: '/work/app' } } }
  composer(user, uuid(7), { ...ws, status: 'generating', generatingBubbleIds: ['b2'] })
  composer(user, uuid(8), { ...ws, subagentInfo: { parentComposerId: uuid(7) } })
  composer(user, uuid(9), { ...ws, fullConversationHeadersOnly: [] })
  const [th, ...rest] = await adapterFor(home).scanThreads()
  assert.equal(rest.length, 0)
  assert.equal(th.running, true)
  assert.equal(th.unread, false)
  assert.equal((await adapterFor(home, { now: () => NOW + 3_600_000 }).scanThreads())[0].running, false, 'left generating by a crash')
})

test('new sessions open the folder and carry the prompt through Cursor\'s prompt link', async (t) => {
  const { home, cleanup } = tmpHome()
  t.after(cleanup)
  composer(userDir(home, 'Cursor'), uuid(1))
  const a = adapterFor(home, { agentPath: '/usr/local/bin/cursor-agent' })
  assert.deepEqual((await a.targets()).map((x) => x.id), ['cursor', 'terminal'])
  const r = await a.newSession('/work/my app', { target: 'cursor', prompt: 'fix & test' })
  assert.deepEqual(r.urls, ['cursor://file/work/my%20app/', 'cursor://anysphere.cursor-deeplink/prompt?text=fix+%26+test'])
  assert.equal(r.promptPassed, true)
  assert.equal((await a.newSession('/work/app', { target: 'cursor' })).url, 'cursor://file/work/app/')
  const long = await a.newSession('/work/app', { target: 'cursor', prompt: 'x'.repeat(5000) })
  assert.equal(long.url, 'cursor://file/work/app/')
  assert.ok(!long.promptPassed, 'too long for a link: copied whole rather than cut short')
  assert.deepEqual((await a.newSession('/work/app', { target: 'terminal', prompt: 'hi' })).terminal, { exe: '/usr/local/bin/cursor-agent', args: [], cwd: '/work/app', prompt: 'hi' })
  assert.equal((await a.newSession('/work/app', { target: 'vscode' })).ok, false)
  assert.equal(a.openThread({ composerId: [uuid(1)], folder: '/work/app' }).ok, false)
})

test('bubbles: you, then Cursor, with a tool line from its parameters', () => {
  assert.deepEqual(bubbleMessages([{ type: 1, text: ' hi ' }, { type: 2, text: '' }, null]).map((m) => m.text), ['hi'])
  assert.equal(bubbleMessages([{ type: 2, toolFormerData: { name: 'read_file', params: 'not json' } }])[0].name, 'read_file')
})
