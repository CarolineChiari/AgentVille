import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { createCodexAdapter } from '../server/harnesses/codex/index.mjs'
import { rolloutHead, rolloutMessages, rolloutTail, summarizeCall } from '../server/harnesses/codex/rollout.mjs'
import { tmpHome, uuid } from './helpers/fixtures.mjs'
import { jsonl, writeFile } from './helpers/editor.mjs'

const NOW = Date.parse('2026-09-01T12:00:00Z')
const adapterFor = (home, extra = {}) => createCodexAdapter({ home, env: {}, platform: 'darwin', now: () => NOW, codexPath: null, ...extra })
const iso = (ago) => new Date(NOW - ago).toISOString()

// The lines of a rollout, each `{ timestamp, type, payload }`.
const line = (type, payload, ago = 0) => ({ timestamp: iso(ago), type, payload })
const meta = (id, cwd = '/work/app', extra = {}) => line('session_meta', { id, timestamp: iso(600_000), cwd, originator: 'codex_cli_rs', cli_version: '0.50.0', source: 'cli', instructions: null, git: { branch: 'main' }, ...extra }, 600_000)
const turnContext = (model = 'gpt-5-codex') => line('turn_context', { cwd: '/work/app', approval_policy: 'on-request', model, effort: 'medium' }, 595_000)
const userItem = (text, ago) => line('response_item', { type: 'message', role: 'user', content: [{ type: 'input_text', text }] }, ago)
const agentItem = (text, ago) => line('response_item', { type: 'message', role: 'assistant', content: [{ type: 'output_text', text }] }, ago)
const event = (type, extra, ago) => line('event_msg', { type, ...extra }, ago)
const shell = (command, ago) => line('response_item', { type: 'function_call', name: 'shell', arguments: JSON.stringify({ command: ['bash', '-lc', command] }), call_id: 'c1' }, ago)
const output = (ago) => line('response_item', { type: 'function_call_output', call_id: 'c1', output: 'ok' }, ago)

/** What a new Codex writes for one prompt: the context it injects, then the prompt, twice over. */
const opening = (id, prompt = 'Fix the login test') => [
  meta(id),
  turnContext(),
  userItem('<environment_context>\n  <cwd>/work/app</cwd>\n</environment_context>', 590_000),
  userItem(prompt, 590_000),
  event('user_message', { message: prompt, images: [] }, 590_000),
]

/** Write a rollout where Codex keeps one: the dated tree, or the flat archive. */
function rollout(home, { id = uuid(1), records, mtime = NOW - 60_000, archived = false }) {
  const name = `rollout-2026-09-01T11-50-00-${id}.jsonl`
  const dir = archived ? path.join(home, '.codex', 'archived_sessions') : path.join(home, '.codex', 'sessions', '2026', '09', '01')
  writeFile(path.join(dir, name), jsonl(records), mtime)
  return id
}

test('no ~/.codex is not detected, and scans to nothing', async (t) => {
  const { home, cleanup } = tmpHome()
  t.after(cleanup)
  assert.equal(await adapterFor(home).detect(), false)
  assert.deepEqual(await adapterFor(home).scanThreads(), [])
})

test('a finished session stands on its folder\'s plot, titled by what you asked, ready for review', async (t) => {
  const { home, cleanup } = tmpHome()
  t.after(cleanup)
  const id = rollout(home, { records: [...opening(uuid(1)), shell('npm test', 500_000), output(490_000), agentItem('Fixed it.', 100_000), event('agent_message', { message: 'Fixed it.' }, 100_000), event('token_count', {}, 99_000)] })
  const a = adapterFor(home)
  assert.equal(await a.detect(), true)
  const [th] = await a.scanThreads()
  assert.equal(th.id, `codex:${id}`)
  assert.equal(th.harnessName, 'Codex')
  assert.equal(th.title, 'Fix the login test', 'the injected environment context is not the title')
  assert.equal(th.project, 'app')
  assert.equal(th.projectPath, '/work/app')
  assert.equal(th.gitBranch, 'main')
  assert.equal(th.model, 'gpt-5-codex')
  assert.equal(th.effort, 'medium')
  assert.equal(th.createdAt, NOW - 600_000)
  assert.equal(th.running, false)
  assert.equal(th.unread, true)
  assert.equal(th.archived, false)
  assert.equal(th.canOpen, false, 'nothing to resume it with')
})

test('a turn with no answer yet is working only while the rollout keeps moving', async (t) => {
  const { home, cleanup } = tmpHome()
  t.after(cleanup)
  rollout(home, { records: [...opening(uuid(1)), agentItem('Running the tests first.', 500_000), shell('npm test', 490_000)] })
  const [th] = await adapterFor(home).scanThreads()
  assert.equal(th.running, true, 'a preamble followed by a tool call is not the answer')
  assert.equal(th.unread, false)
  const [cold] = await adapterFor(home, { now: () => NOW + 3_600_000 }).scanThreads()
  assert.equal(cold.running, false, 'an hour without a write: cut off, not working')
})

test('an aborted turn has nothing to review; one stopped on an error is stuck, the day it happens', async (t) => {
  const { home, cleanup } = tmpHome()
  t.after(cleanup)
  rollout(home, { id: uuid(1), records: [...opening(uuid(1)), shell('npm test', 500_000), event('turn_aborted', { reason: 'interrupted' }, 400_000)] })
  rollout(home, { id: uuid(2), records: [...opening(uuid(2)), shell('npm test', 500_000), event('error', { message: 'stream disconnected' }, 400_000)] })
  const byId = Object.fromEntries((await adapterFor(home).scanThreads()).map((x) => [x.id, x]))
  assert.deepEqual([byId[`codex:${uuid(1)}`].unread, byId[`codex:${uuid(1)}`].running, byId[`codex:${uuid(1)}`].hasError], [false, false, false])
  assert.deepEqual([byId[`codex:${uuid(2)}`].hasError, byId[`codex:${uuid(2)}`].running], [true, false])
  const later = await adapterFor(home, { now: () => NOW + 2 * 86_400_000 }).scanThreads()
  assert.equal(later.find((x) => x.id === `codex:${uuid(2)}`).hasError, false)
})

test('a session launched and left, or from before rollouts said where they ran, is not a villager', async (t) => {
  const { home, cleanup } = tmpHome()
  t.after(cleanup)
  rollout(home, { id: uuid(1), records: [meta(uuid(1)), turnContext()] })
  rollout(home, { id: uuid(2), records: [{ id: uuid(2), timestamp: iso(600_000), instructions: '' }, { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'hi' }] }] })
  assert.deepEqual(await adapterFor(home).scanThreads(), [])
})

test('an archived session walks back through the portal; the newer copy of one wins', async (t) => {
  const { home, cleanup } = tmpHome()
  t.after(cleanup)
  rollout(home, { id: uuid(1), records: [...opening(uuid(1)), agentItem('Done.', 100_000)], archived: true })
  rollout(home, { id: uuid(2), records: [...opening(uuid(2), 'old copy'), agentItem('Done.', 100_000)], mtime: NOW - 300_000 })
  rollout(home, { id: uuid(2), records: [...opening(uuid(2), 'new copy'), agentItem('Done.', 100_000)], archived: true, mtime: NOW - 30_000 })
  const all = await adapterFor(home).scanThreads()
  assert.equal(all.length, 2)
  const one = all.find((x) => x.id === `codex:${uuid(1)}`)
  assert.deepEqual([one.archived, one.unread], [true, false])
  assert.equal(all.find((x) => x.id === `codex:${uuid(2)}`).title, 'new copy')
})

test('CODEX_HOME moves the whole store', async (t) => {
  const { home, cleanup } = tmpHome()
  t.after(cleanup)
  const elsewhere = path.join(home, 'elsewhere')
  writeFile(path.join(elsewhere, 'sessions', '2026', '09', '01', `rollout-2026-09-01T11-50-00-${uuid(3)}.jsonl`), jsonl(opening(uuid(3))), NOW - 60_000)
  assert.equal((await adapterFor(home, { env: { CODEX_HOME: elsewhere } }).scanThreads()).length, 1)
  assert.equal((await adapterFor(home, { env: { CODEX_HOME: 'relative' } }).scanThreads()).length, 0, 'a relative CODEX_HOME is ignored')
})

test('a session resumes in a terminal in its folder; the id is checked before it reaches argv', async (t) => {
  const { home, cleanup } = tmpHome()
  t.after(cleanup)
  const id = rollout(home, { records: [...opening(uuid(1)), agentItem('Done.', 100_000)] })
  const a = adapterFor(home, { codexPath: '/usr/local/bin/codex' })
  const [th] = await a.scanThreads()
  assert.equal(th.opensIn, 'Terminal')
  assert.equal(th.canOpen, true)
  assert.deepEqual((await a.openThread(th.ref)).terminal, { exe: '/usr/local/bin/codex', args: ['resume', id], cwd: '/work/app' })
  assert.equal((await a.openThread({ ...th.ref, sessionId: [id] })).ok, false)
  assert.equal((await a.openThread({ ...th.ref, sessionId: '--help' })).ok, false)
  assert.equal((await a.openThread({ ...th.ref, cwd: 'relative' })).ok, false)
  assert.equal((await adapterFor(home).openThread(th.ref)).ok, false, 'without the CLI there is nothing to resume it with')
})

test('the transcript: what you asked, what Codex thought, said and ran, each once', async (t) => {
  const { home, cleanup } = tmpHome()
  t.after(cleanup)
  rollout(home, {
    records: [
      ...opening(uuid(1), 'why does it fail?'),
      line('response_item', { type: 'reasoning', summary: [{ type: 'summary_text', text: '**Looking at the test**' }], encrypted_content: 'xyz' }, 580_000),
      shell('npm test', 570_000),
      output(560_000),
      line('response_item', { type: 'custom_tool_call', name: 'apply_patch', input: '*** Begin Patch\n*** Update File: src/login.js\n@@\n-a\n+b\n*** End Patch', call_id: 'c2' }, 550_000),
      agentItem('A typo in login.js.', 540_000),
      event('agent_message', { message: 'A typo in login.js.' }, 540_000),
    ],
  })
  const a = adapterFor(home)
  const [th] = await a.scanThreads()
  const tr = await a.readTranscript(th.ref)
  assert.deepEqual(tr.messages.map((m) => [m.role, m.text ?? `${m.name}: ${m.detail}`]), [
    ['user', 'why does it fail?'],
    ['thinking', '**Looking at the test**'],
    ['tool', 'shell: npm test'],
    ['tool', 'apply_patch: login.js'],
    ['assistant', 'A typo in login.js.'],
  ])
  assert.equal(tr.messages[2].code, 'npm test')
  assert.equal(tr.messages[1].key, '5', 'a folded line keeps its line number as its name across refreshes')
  const both = await a.readTranscript(th.ref, { limit: 1, head: 1 })
  assert.deepEqual(both.messages.map((m) => m.role), ['user', 'gap', 'assistant'])
  assert.equal(both.messages[1].count, 3)
  assert.equal((await a.readTranscript({ sessionId: '../../etc/passwd' })).ok, false)
})

test('new sessions: a terminal, only with the CLI installed, starting on the prompt', async (t) => {
  const { home, cleanup } = tmpHome()
  t.after(cleanup)
  assert.deepEqual(await adapterFor(home).targets(), [])
  const a = adapterFor(home, { codexPath: '/usr/local/bin/codex' })
  assert.deepEqual((await a.targets()).map((x) => x.id), ['terminal'])
  assert.deepEqual((await a.newSession('/work/app', { target: 'terminal', prompt: ' hi ' })).terminal, { exe: '/usr/local/bin/codex', args: [], cwd: '/work/app', prompt: 'hi' })
  assert.equal((await a.newSession('relative', { target: 'terminal' })).ok, false)
  assert.equal((await a.newSession('/work/app', { target: 'vscode' })).ok, false)
})

test('rollout helpers: the earliest unwrapped lines, user prompts without events, and tool lines', () => {
  const old = [{ id: uuid(9), timestamp: iso(1000), instructions: '' }, { type: 'message', role: 'user', content: [{ type: 'input_text', text: '<user_instructions>be nice</user_instructions>' }] }, { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'hello\nthere' }] }]
  const h = rolloutHead(old)
  assert.deepEqual([h.id, h.cwd, h.firstPrompt], [uuid(9), '', 'hello there'])
  assert.deepEqual(rolloutMessages(old).map((m) => m.text), ['hello\nthere'])
  assert.equal(rolloutTail([]), null)
  assert.equal(rolloutTail(old).inTurn, true)
  // A stream error is a retry on the way, not the end of the turn.
  assert.equal(rolloutTail([...opening(uuid(1)), event('stream_error', { message: 'retrying' }, 1)]).error, false)
  assert.deepEqual(summarizeCall({ type: 'local_shell_call', action: { command: ['zsh', '-lc', 'ls -la'] } }), { name: 'shell', detail: 'ls -la', code: 'ls -la' })
  assert.deepEqual(summarizeCall({ type: 'function_call', name: 'shell', arguments: JSON.stringify({ command: ['git', 'status'] }) }), { name: 'shell', detail: 'git status', code: 'git status' })
  assert.deepEqual(summarizeCall({ type: 'function_call', name: 'read_file', arguments: '{"path":"/work/app/a.js"}' }), { name: 'read_file', detail: '/work/app/a.js' })
  assert.deepEqual(summarizeCall({ type: 'web_search_call', action: { query: 'node fs.watch' } }), { name: 'web search', detail: 'node fs.watch' })
  assert.equal(summarizeCall({ type: 'function_call', name: 'x', arguments: 'not json' }).detail, 'not json')
})
