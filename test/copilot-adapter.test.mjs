import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createCopilotAdapter } from '../server/harnesses/copilot/index.mjs'
import { STATE, chatMessages, foldChatLog, headMeta, lastTurn } from '../server/harnesses/copilot/chatlog.mjs'
import { eventMessages, eventsTail, yamlScalars } from '../server/harnesses/copilot/events.mjs'
import { tmpHome, uuid } from './helpers/fixtures.mjs'
import { jsonl, userDir, workspace, writeFile } from './helpers/editor.mjs'

const NOW = Date.parse('2026-09-01T12:00:00Z')
const adapterFor = (home, extra = {}) => createCopilotAdapter({ home, env: {}, platform: 'darwin', now: () => NOW, copilotPath: null, ...extra })

const request = (text, state, extra = {}) => ({
  requestId: 'r', timestamp: NOW - 120_000, modelId: 'copilot/claude-opus-5', message: { text, parts: [] },
  response: [], modelState: state === undefined ? undefined : { value: state, completedAt: NOW - 100_000 }, ...extra,
})
const snapshot = (requests = []) => ({ kind: 0, v: { version: 3, creationDate: NOW - 3_600_000, sessionId: 's', requests, pendingRequests: [] } })

/** VS Code with Copilot Chat installed: its storage folder is what detection looks for. */
function vscodeWithCopilot(home) {
  const user = userDir(home, 'Code')
  fs.mkdirSync(path.join(user, 'globalStorage', 'github.copilot-chat'), { recursive: true })
  return user
}

/** One VS Code workspace on /work/app with one chat log, and the index entry for it. */
function chatHome(home, { id = uuid(1), records, index, mtime = NOW - 60_000 }) {
  const user = vscodeWithCopilot(home)
  const items = index === null ? {} : { 'chat.ChatSessionStore.index': { version: 1, entries: { [id]: { sessionId: id, title: 'Fix the login', lastMessageDate: NOW - 100_000, timing: { created: NOW - 3_600_000 }, lastResponseState: 1, ...index } } } }
  const ws = workspace(user, 'abc123', '/work/app', items)
  writeFile(path.join(ws, 'chatSessions', `${id}.jsonl`), jsonl(records), mtime)
  return id
}

test('the operation log folds: set, push, cut-then-push, delete', () => {
  const s = foldChatLog([
    snapshot(),
    { kind: 1, k: ['customTitle'], v: 'Named' },
    { kind: 2, k: ['requests'], v: [request('a', 0)] },
    { kind: 2, k: ['requests', 0, 'response'], v: [{ value: 'one ' }, { value: 'two' }] },
    { kind: 2, k: ['requests', 0, 'response'], i: 1, v: [{ value: 'three' }] },
    { kind: 1, k: ['requests', 0, 'modelState'], v: { value: 1, completedAt: 5 } },
    { kind: 2, k: ['pendingRequests'], v: [{ x: 1 }] },
    { kind: 2, k: ['pendingRequests'], i: 0 },
    { kind: 3, k: ['customTitle'] },
  ])
  assert.equal(s.customTitle, undefined)
  assert.deepEqual(s.requests[0].response.map((p) => p.value), ['one ', 'three'])
  assert.equal(s.requests[0].modelState.value, 1)
  assert.deepEqual(s.pendingRequests, [])
})

test('the newest request\'s state comes from the tail, even one that starts mid-request', () => {
  assert.equal(lastTurn([snapshot(), { kind: 2, k: ['requests'], v: [request('a')] }]).state, STATE.PENDING)
  const mid = lastTurn([
    { kind: 2, k: ['requests', 7, 'response'], v: [{ kind: 'questionCarousel', questions: [] }] },
    { kind: 1, k: ['requests', 7, 'modelState'], v: { value: 4 } },
  ])
  assert.deepEqual({ index: mid.index, state: mid.state, asking: mid.asking }, { index: 7, state: STATE.NEEDS_INPUT, asking: true })
  const later = lastTurn([
    { kind: 1, k: ['requests', 7, 'modelState'], v: { value: 1 } },
    { kind: 2, k: ['requests', 8, 'response'], v: [{ value: 'streaming' }] },
  ])
  assert.equal(later.index, 8)
  assert.equal(later.state, null, 'request 8 never said, so the index decides')
  assert.equal(lastTurn([{ kind: 1, k: ['inputState', 'inputText'], v: 'typing' }]), null)
})

test('the first prompt is found in a head cut off mid-line', () => {
  const full = JSON.stringify(snapshot([request('Fix "the" bug\nplease', 1)]))
  const m = headMeta(full.slice(0, full.indexOf('please') + 20))
  assert.equal(m.firstPrompt, 'Fix "the" bug please')
  assert.equal(m.createdAt, NOW - 3_600_000)
  assert.equal(m.model, 'claude-opus-5')
})

test('an absent install is not detected, nor VS Code without Copilot', async (t) => {
  const { home, cleanup } = tmpHome()
  t.after(cleanup)
  assert.equal(await adapterFor(home).detect(), false)
  userDir(home, 'Code')
  assert.equal(await adapterFor(home).detect(), false)
  assert.deepEqual(await adapterFor(home).scanThreads(), [])
})

test('a finished VS Code chat lands on its folder\'s plot, titled by the index, ready for review', async (t) => {
  const { home, cleanup } = tmpHome()
  t.after(cleanup)
  const id = chatHome(home, { records: [snapshot([request('fix login', 1)])] })
  const a = adapterFor(home)
  assert.equal(await a.detect(), true)
  const [th] = await a.scanThreads()
  assert.equal(th.id, `copilot:${id}`)
  assert.equal(th.title, 'Fix the login')
  assert.equal(th.preview, 'fix login')
  assert.equal(th.project, 'app')
  assert.equal(th.projectPath, '/work/app')
  assert.equal(th.model, 'claude-opus-5')
  assert.equal(th.running, false)
  assert.equal(th.unread, true)
  assert.equal(th.opensIn, 'VS Code')
})

test('a pending request is working only while the log keeps moving', async (t) => {
  const { home, cleanup } = tmpHome()
  t.after(cleanup)
  chatHome(home, { records: [snapshot(), { kind: 2, k: ['requests'], v: [request('go', 0)] }], index: { lastResponseState: 0 } })
  const [th] = await adapterFor(home).scanThreads()
  assert.equal(th.running, true)
  assert.equal(th.unread, false)
  const [cold] = await adapterFor(home, { now: () => NOW + 3_600_000 }).scanThreads()
  assert.equal(cold.running, false, 'an hour without a write: cut off, not working')
})

test('a stored question or permission prompt is needs-input while recent', async (t) => {
  const { home, cleanup } = tmpHome()
  t.after(cleanup)
  chatHome(home, {
    records: [snapshot([request('go', 0)]), { kind: 2, k: ['requests', 0, 'response'], v: [{ kind: 'questionCarousel' }] }, { kind: 1, k: ['requests', 0, 'modelState'], v: { value: 4 } }],
  })
  assert.equal((await adapterFor(home).scanThreads())[0].needsInput, 'question')
  assert.equal((await adapterFor(home, { now: () => NOW + 2 * 86_400_000 }).scanThreads())[0].needsInput, '', 'VS Code has long since reloaded it')
})

test('a chat panel opened and never used is not a villager', async (t) => {
  const { home, cleanup } = tmpHome()
  t.after(cleanup)
  chatHome(home, { records: [snapshot()], index: null })
  assert.deepEqual(await adapterFor(home).scanThreads(), [])
  const { home: h2, cleanup: c2 } = tmpHome()
  t.after(c2)
  chatHome(h2, { records: [snapshot()], index: { isEmpty: true } })
  assert.deepEqual(await adapterFor(h2).scanThreads(), [])
})

test('a CLI session run by a VS Code background agent stands on its repo, in its worktree', async (t) => {
  const { home, cleanup } = tmpHome()
  t.after(cleanup)
  const id = uuid(5)
  const dir = path.join(home, '.copilot', 'session-state', id)
  const ev = (type, data, ms) => ({ type, data, id: 'e', timestamp: new Date(NOW - ms).toISOString(), parentId: null })
  writeFile(path.join(dir, 'events.jsonl'), jsonl([
    ev('session.start', { selectedModel: 'gpt-5', startTime: new Date(NOW - 600_000).toISOString(), context: { cwd: '/work/app.worktrees/wt-1', gitRoot: '/work/app.worktrees/wt-1', branch: 'wt-1' } }, 600_000),
    ev('user.message', { content: 'add tests' }, 590_000),
    ev('assistant.turn_start', {}, 580_000),
    ev('tool.execution_start', { toolName: 'bash', arguments: { command: 'npm test' } }, 570_000),
  ]), NOW - 30_000)
  writeFile(path.join(dir, 'vscode.metadata.json'), JSON.stringify({ worktreeProperties: { repositoryPath: '/work/app', worktreePath: '/work/app.worktrees/wt-1', branchName: 'wt-1' } }))
  const a = adapterFor(home)
  const [th] = await a.scanThreads()
  assert.equal(th.project, 'app')
  assert.equal(th.worktree, 'wt-1')
  assert.equal(th.cwd, '/work/app.worktrees/wt-1')
  assert.equal(th.title, 'add tests')
  assert.equal(th.running, true)
  assert.equal(th.source, 'vscode-agent')
  const tr = await a.readTranscript(th.ref)
  assert.deepEqual(tr.messages.map((m) => m.role), ['user', 'tool'])
  // With the CLI installed it resumes in a terminal; the id is checked before it reaches argv.
  const withCli = adapterFor(home, { copilotPath: '/usr/local/bin/copilot' })
  const r = await withCli.openThread(th.ref)
  assert.deepEqual(r.terminal, { exe: '/usr/local/bin/copilot', args: [`--resume=${id}`], cwd: '/work/app.worktrees/wt-1' })
  assert.equal((await withCli.openThread({ ...th.ref, sessionId: [id] })).ok, false)
})

test('opening a chat opens its folder in the editor it lives in', async (t) => {
  const { home, cleanup } = tmpHome()
  t.after(cleanup)
  chatHome(home, { records: [snapshot([request('x', 1)])] })
  const a = adapterFor(home)
  const [th] = await a.scanThreads()
  assert.equal((await a.openThread(th.ref)).url, 'vscode://file/work/app/?windowId=_blank')
  assert.equal((await a.openThread({ ...th.ref, editor: 'javascript' })).ok, false)
  assert.equal((await a.openThread({ ...th.ref, folder: 'relative' })).ok, false)
})

test('the transcript replays the log: prompt, reply, tool line, reasoning', async (t) => {
  const { home, cleanup } = tmpHome()
  t.after(cleanup)
  chatHome(home, {
    records: [
      snapshot([request('why?', 0)]),
      { kind: 2, k: ['requests', 0, 'response'], v: [{ value: 'Because ' }, { kind: 'inlineReference', inlineReference: { path: '/work/app/a.js' } }] },
      { kind: 2, k: ['requests', 0, 'response'], v: [{ kind: 'toolInvocationSerialized', toolId: 'copilot_readFile', pastTenseMessage: { value: 'Read a.js' } }, { kind: 'thinking', value: 'hmm' }] },
      { kind: 1, k: ['requests', 0, 'modelState'], v: { value: 1 } },
    ],
  })
  const a = adapterFor(home)
  const [th] = await a.scanThreads()
  const tr = await a.readTranscript(th.ref)
  assert.deepEqual(tr.messages.map((m) => [m.role, m.text ?? `${m.name}: ${m.detail}`]), [
    ['user', 'why?'],
    ['assistant', 'Because `a.js`'],
    ['tool', 'readFile: Read a.js'],
    ['thinking', 'hmm'],
  ])
  // The panel folds reasoning away, so each thought keeps a name across refreshes.
  assert.equal(tr.messages.at(-1).key, '0:3') // request 0, the fourth part appended to its response
  assert.equal((await a.readTranscript({ sessionId: '../../etc/passwd' })).ok, false)
})

test('new sessions: the editor always, a terminal only with the CLI installed', async (t) => {
  const { home, cleanup } = tmpHome()
  t.after(cleanup)
  vscodeWithCopilot(home)
  assert.deepEqual((await adapterFor(home).targets()).map((x) => x.id), ['vscode'])
  const withCli = adapterFor(home, { copilotPath: '/usr/local/bin/copilot' })
  assert.deepEqual((await withCli.targets()).map((x) => x.id), ['vscode', 'terminal'])
  const r = await withCli.newSession('/work/app', { target: 'terminal', prompt: 'hi' })
  assert.deepEqual(r.terminal, { exe: '/usr/local/bin/copilot', args: [], promptArgs: ['-i'], cwd: '/work/app', prompt: 'hi' })
  assert.equal((await withCli.newSession('/work/app', { target: 'vscode' })).url, 'vscode://file/work/app/?windowId=_blank')
  assert.equal((await withCli.newSession('relative', { target: 'vscode' })).ok, false)
})

test('CLI helpers: a finished turn is reviewable, an aborted one is not; workspace.yaml scalars', () => {
  const e = (type) => ({ type, data: {}, timestamp: new Date(NOW).toISOString() })
  assert.deepEqual([eventsTail([e('assistant.turn_end')]).finished, eventsTail([e('abort')]).finished, eventsTail([e('assistant.turn_start')]).turnOver], [true, false, false])
  assert.deepEqual(yamlScalars("id: x\ncwd: '/work/o''neil'\nsummary: \"Fix it\"\nlist:\n  - a\n"), { id: 'x', cwd: "/work/o'neil", summary: 'Fix it' })
  assert.deepEqual(eventMessages([{ type: 'assistant.reasoning', data: { content: 'x' } }]), [])
  assert.deepEqual(chatMessages(null), [])
})
