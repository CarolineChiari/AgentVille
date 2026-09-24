import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { createAntigravityAdapter, epochMs, stepMessages, workspaceOf } from '../server/harnesses/antigravity/index.mjs'
import { tmpHome, uuid } from './helpers/fixtures.mjs'
import { jsonl, writeFile } from './helpers/editor.mjs'

const NOW = Date.parse('2026-09-01T12:00:00Z')
const adapterFor = (home, extra = {}) => createAntigravityAdapter({ home, env: {}, platform: 'darwin', now: () => NOW, agyPath: null, ...extra })

/** One app's conversation_summaries.db with the given rows. */
function summaries(home, dir, rows) {
  const root = path.join(home, '.gemini', dir)
  fs.mkdirSync(root, { recursive: true })
  const db = new DatabaseSync(path.join(root, 'conversation_summaries.db'))
  db.exec('CREATE TABLE conversation_summaries (conversation_id TEXT, title TEXT, preview TEXT, step_count INTEGER, workspace_uris TEXT, project_id TEXT, last_modified_time INTEGER, killed INTEGER, not_fully_idle INTEGER, nesting_depth INTEGER)')
  const put = db.prepare('INSERT INTO conversation_summaries VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
  for (const r of rows) {
    put.run(r.id, r.title ?? 'Add login', r.preview ?? 'add a login page', r.steps ?? 4, JSON.stringify(r.uris ?? ['file:///work/app']), 'p', r.at ?? NOW - 60_000, r.killed ?? 0, r.busy ?? 0, r.depth ?? 0)
  }
  db.close()
  return root
}

test('no Antigravity, no villagers', async (t) => {
  const { home, cleanup } = tmpHome()
  t.after(cleanup)
  assert.equal(await adapterFor(home).detect(), false)
  assert.deepEqual(await adapterFor(home).scanThreads(), [])
})

test('each app\'s summaries become villagers on their workspace', async (t) => {
  const { home, cleanup } = tmpHome()
  t.after(cleanup)
  summaries(home, 'antigravity-cli', [{ id: uuid(1) }, { id: uuid(2), depth: 1 }, { id: uuid(3), uris: [] }])
  summaries(home, 'antigravity-ide', [{ id: uuid(4), busy: 1, uris: ['file:///work/other'] }])
  const a = adapterFor(home)
  assert.equal(await a.detect(), true)
  const threads = await a.scanThreads()
  assert.deepEqual(threads.map((t) => [t.id, t.project, t.source]), [[`antigravity:${uuid(1)}`, 'app', 'cli'], [`antigravity:${uuid(4)}`, 'other', 'ide']])
  assert.equal(threads[0].title, 'Add login')
  assert.equal(threads[0].unread, true)
  assert.equal(threads[1].running, true)
  assert.equal(threads[0].canOpen, false, 'neither agy nor the IDE is installed')
})

test('a CLI conversation resumes with agy; its transcript is readable', async (t) => {
  const { home, cleanup } = tmpHome()
  t.after(cleanup)
  const root = summaries(home, 'antigravity-cli', [{ id: uuid(1) }])
  writeFile(path.join(root, 'brain', uuid(1), '.system_generated', 'logs', 'transcript_full.jsonl'), jsonl([
    { step_index: 0, source: 'SYSTEM', type: 'SYSTEM_MESSAGE', status: 'DONE', content: 'rules' },
    { step_index: 1, source: 'USER_EXPLICIT', type: 'USER_INPUT', status: 'DONE', created_at: '2026-09-01T11:00:00Z', content: '<USER_REQUEST>\nadd login\n</USER_REQUEST>' },
    { step_index: 2, source: 'MODEL', type: 'RUN_COMMAND', status: 'DONE', content: 'npm test\nok' },
    { step_index: 3, source: 'MODEL', type: 'PLANNER_RESPONSE', status: 'DONE', content: 'Added it.' },
  ]))
  const a = adapterFor(home, { agyPath: '/usr/local/bin/agy' })
  const [th] = await a.scanThreads()
  assert.equal(th.opensIn, 'Terminal')
  assert.deepEqual((await a.openThread(th.ref)).terminal, { exe: '/usr/local/bin/agy', args: ['--conversation', uuid(1)], cwd: '/work/app' })
  const tr = await a.readTranscript(th.ref)
  assert.deepEqual(tr.messages.map((m) => [m.role, m.text ?? m.detail]), [['user', 'add login'], ['tool', 'npm test'], ['assistant', 'Added it.']])
  assert.equal((await a.readTranscript({ ...th.ref, conversationId: '../x' })).ok, false)
  assert.equal((await a.openThread({ ...th.ref, source: 'elsewhere' })).ok, false)
})

test('new sessions: the IDE only when installed, agy in a terminal with -i', async (t) => {
  const { home, cleanup } = tmpHome()
  t.after(cleanup)
  fs.mkdirSync(path.join(home, 'Library', 'Application Support', 'Antigravity IDE', 'User'), { recursive: true })
  const a = adapterFor(home, { agyPath: '/usr/local/bin/agy' })
  assert.deepEqual((await a.targets()).map((x) => x.id), ['ide', 'terminal'])
  assert.equal((await a.newSession('/work/app', { target: 'ide' })).url, 'antigravity-ide://file/work/app/?windowId=_blank')
  assert.deepEqual((await a.newSession('/work/app', { target: 'terminal', prompt: 'go' })).terminal.promptArgs, ['-i'])
  assert.deepEqual((await adapterFor(home).targets()).map((x) => x.id), ['ide'])
})

test('timestamps in any unit, and the first local workspace', () => {
  const ms = Date.parse('2026-09-01T00:00:00Z')
  assert.deepEqual([epochMs(ms / 1000), epochMs(ms), epochMs(ms * 1000), epochMs('2026-09-01T00:00:00Z'), epochMs(String(ms)), epochMs(null)], [ms, ms, ms, ms, ms, 0])
  assert.equal(workspaceOf('["vscode-remote://ssh/x","file:///c%3A/code/app"]'), 'C:/code/app')
  assert.equal(workspaceOf('nonsense'), '')
  assert.deepEqual(stepMessages([{ type: 'CHECKPOINT' }, null]), [])
})
