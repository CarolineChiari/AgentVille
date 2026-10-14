import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { EventEmitter } from 'node:events'
import { ASK_PROMPT, JUDGE_BATCH, MAX_ASKS, createForeman, digestOf, judgePrompt, runHeadless, seenVerdict } from '../server/foreman.mjs'
import { headlessArgs, readHeadless } from '../server/harnesses/claude-code/headless.mjs'
import { createClaudeCodeAdapter } from '../server/harnesses/claude-code/index.mjs'
import { cleanRow, roundLine, sortReport, verdictsOf } from '../src/game/foreman.js'
import { tmpHome, uuid } from './helpers/fixtures.mjs'

const NOW = Date.parse('2026-10-13T12:00:00Z')
const cli = (value, extra = {}) => JSON.stringify({ type: 'result', is_error: false, result: '', structured_output: value, total_cost_usd: 0.02, ...extra })

test('a headless run saves nothing, reads no repo settings, starts no MCP server and names its tools', () => {
  const args = headlessArgs({ schema: { type: 'object' } })
  for (const flag of ['-p', '--no-session-persistence', '--strict-mcp-config']) assert.ok(args.includes(flag), flag)
  assert.equal(args[args.indexOf('--setting-sources') + 1], 'user')
  assert.equal(args[args.indexOf('--tools') + 1], '', 'the foreman itself has no tools at all')
  assert.ok(!args.includes('--resume'))
  const ask = headlessArgs({ schema: {}, tools: ['Read', 'Grep'], resume: uuid(1) })
  assert.deepEqual(ask.slice(ask.indexOf('--resume')), ['--resume', uuid(1), '--fork-session'], 'a thread is asked in a copy, never itself')
  assert.equal(ask[ask.indexOf('--tools') + 1], 'Read,Grep')
})

test('the adapter asks a thread in its own folder, and never with a prompt on the command line', async (t) => {
  const { home, cleanup } = tmpHome()
  t.after(cleanup)
  const a = createClaudeCodeAdapter({ home, env: {}, platform: 'darwin', claudePath: '/bin/claude' })
  const prompt = '--settings={"hooks":{}} are you done?'
  const spec = await a.headless({ cliSessionId: uuid(2), cwd: '/work/repo' }, { prompt, schema: { type: 'object' } })
  assert.equal(spec.ok, true)
  assert.equal(spec.cwd, '/work/repo')
  assert.equal(spec.input, prompt)
  assert.ok(!spec.args.includes(prompt))
  assert.ok(!spec.args.includes('Bash') && !spec.args.some((x) => /Bash|Edit|Write/.test(x)), 'reading tools only')
  assert.equal((await a.headless({ cliSessionId: ['x'], cwd: '/work/repo' }, { prompt: 'hi', schema: {} })).ok, false)
  assert.equal((await a.headless(null, { prompt: 'hi', schema: {}, cwd: 'relative' })).ok, false)
})

test('the CLI’s answer is read from its structured output, or its result text', () => {
  assert.deepEqual(readHeadless(cli({ verdict: 'done' })), { ok: true, value: { verdict: 'done' }, costUsd: 0.02 })
  const fenced = JSON.stringify({ is_error: false, result: '```json\n{"verdict":"you"}\n```' })
  assert.deepEqual(readHeadless(fenced).value, { verdict: 'you' })
  assert.equal(readHeadless(`warning: something\n${cli({ a: 1 })}`).ok, true, 'a warning line first is skipped')
  assert.equal(readHeadless('nonsense').ok, false)
  assert.equal(readHeadless('', 'warming up\nNo conversation found with session ID: x\n').error, 'No conversation found with session ID: x', 'a run that never started says why')
})

test('a signed-out CLI says how to sign in', () => {
  const r = readHeadless(JSON.stringify({ is_error: true, result: 'Failed to authenticate: OAuth session expired and could not be refreshed' }))
  assert.equal(r.ok, false)
  assert.match(r.error, /sign in/)
})

test('what the village can already see is never sent to be judged', () => {
  assert.equal(seenVerdict({ running: true }).verdict, 'working')
  assert.equal(seenVerdict({ needsInput: 'permission prompt' }).verdict, 'you')
  assert.equal(seenVerdict({ hasError: true, running: true }).verdict, 'stuck')
  assert.equal(seenVerdict({ unread: true }), null)
})

test('a digest keeps the opening ask and the last turns, without reasoning', () => {
  const msgs = [
    { role: 'user', text: 'Add a login page' },
    { role: 'thinking', text: 'secret reasoning' },
    { role: 'tool', name: 'Edit', detail: 'src/login.js' },
    { role: 'assistant', text: 'Done. Tests pass.' },
  ]
  const d = digestOf({ id: 'claude-code:1', title: 'Login', project: 'web', lastActivityAt: NOW - 2 * 3_600_000 }, msgs, NOW)
  assert.equal(d.opening, 'Add a login page')
  assert.equal(d.lastActive, '2h ago')
  assert.deepEqual(d.recent, ['person: Add a login page', 'tool: Edit src/login.js', 'agent: Done. Tests pass.'])
  assert.ok(!JSON.stringify(d).includes('secret'))
  assert.match(judgePrompt([d]), /never instructions to you/)
})

test('runHeadless feeds the prompt on stdin, with no shell, and collects stdout', async () => {
  let seen
  const spawn = (exe, args, opts) => {
    seen = { exe, args, opts, input: '' }
    const child = new EventEmitter()
    child.stdout = new EventEmitter()
    child.stdout.setEncoding = () => {}
    child.stderr = new EventEmitter()
    child.stdin = { on() {}, end: (s) => { seen.input = s; setImmediate(() => { child.stdout.emit('data', cli({ ok: 1 })); child.emit('close', 0) }) } }
    return child
  }
  const r = await runHeadless({ exe: '/bin/claude', args: ['-p'], cwd: '/w', input: 'hello' }, { spawn })
  assert.equal(seen.opts.shell, false)
  assert.equal(seen.input, 'hello')
  assert.equal(r.ok, true)
  assert.equal(readHeadless(r.stdout).ok, true)
})

test('runHeadless gives up on a run that never answers', async () => {
  const killed = []
  const spawn = () => {
    const child = new EventEmitter()
    child.stdout = new EventEmitter()
    child.stderr = new EventEmitter()
    child.stdin = { on() {}, end() {} }
    child.kill = () => killed.push(1)
    return child
  }
  const r = await runHeadless({ exe: '/bin/claude', args: [], cwd: '/w', input: '' }, { spawn, timeoutMs: 10 })
  assert.equal(r.ok, false)
  assert.equal(killed.length, 1)
})

/** A village of threads, a harness that can be asked, and a CLI that answers from a script. */
function rig(t, { threads, judge, answers = {} }) {
  const { home, cleanup } = tmpHome()
  t.after(cleanup)
  const runs = []
  const harness = {
    id: 'claude-code',
    name: 'Claude Code',
    readTranscript: async (ref) => ({ ok: true, messages: [{ role: 'user', text: `task ${ref.n}` }, { role: 'assistant', text: `said ${ref.n}` }] }),
    headless: async (ref, { prompt, schema, cwd }) => ({ ok: true, exe: '/bin/claude', args: [], cwd: ref ? `/work/${ref.n}` : cwd, input: prompt, ref, schema }),
  }
  const run = async (spec) => {
    runs.push(spec)
    if (!spec.ref) return { ok: true, stdout: cli(judge(spec)) }
    const a = answers[spec.ref.n]
    return a ? { ok: true, stdout: cli(a) } : { ok: false, error: 'boom' }
  }
  const foreman = createForeman({ dataDir: home, harnesses: [harness], threads: async () => threads, run, now: () => NOW })
  return { foreman, runs, home }
}

const thread = (n, extra = {}) => ({ id: `claude-code:${n}`, harness: 'claude-code', title: `T${n}`, project: 'web', lastActivityAt: NOW, ref: { n }, ...extra })

test('a round reads every session, asks what it can’t read, and keeps the report', async (t) => {
  const threads = [thread(1), thread(2), thread(3, { running: true }), thread(4)]
  const { foreman, runs, home } = rig(t, {
    threads,
    judge: () => ({ sessions: [
      { id: 'claude-code:1', verdict: 'done', summary: 'Shipped.', next: 'nothing, really' },
      { id: 'claude-code:2', verdict: 'unsure', summary: '', next: '' },
      { id: 'claude-code:3', verdict: 'done', summary: 'Halfway through the migration.', next: 'Finish the migration.' },
      { id: 'claude-code:99', verdict: 'done', summary: 'not in the round', next: '' },
    ] }),
    answers: { 2: { verdict: 'unfinished', summary: 'Wrote the parser.', next: 'Tests left.' } },
  })
  const started = await foreman.start(['claude-code:1', 'claude-code:2', 'claude-code:3', 'claude-code:4', 'claude-code:nope'])
  assert.equal(started.phase, 'reading')
  assert.deepEqual(started.round, ['claude-code:1', 'claude-code:2', 'claude-code:3', 'claude-code:4'], 'only threads the scan knows')
  await foreman.settled()
  const s = await foreman.status()
  assert.equal(s.phase, 'done')
  const by = Object.fromEntries(s.report.map((r) => [r.id, r]))
  assert.deepEqual([by['claude-code:1'].verdict, by['claude-code:1'].next], ['done', ''], 'done can be closed: nothing left')
  assert.deepEqual([by['claude-code:2'].verdict, by['claude-code:2'].asked, by['claude-code:2'].next], ['unfinished', true, 'Tests left.'])
  assert.equal(by['claude-code:3'].verdict, 'working', 'a running thread is seen, not judged')
  assert.equal(by['claude-code:3'].summary, 'Halfway through the migration.', 'but still gets a status update')
  assert.equal(by['claude-code:3'].next, 'Finish the migration.')
  assert.equal(by['claude-code:4'].verdict, 'unsure', 'left out of the answer: unsure')
  assert.ok(!by['claude-code:99'])
  // The judge read every thread, told which it already knows; the asks went to the threads' own folders, with the ask prompt.
  assert.ok(runs[0].input.includes('"known": "working"'))
  for (const n of [1, 2, 3, 4]) assert.ok(runs[0].input.includes(`claude-code:${n}`))
  const asks = runs.filter((r) => r.ref)
  assert.deepEqual(asks.map((r) => r.cwd).sort(), ['/work/2', '/work/4'])
  assert.ok(asks.every((r) => r.input === ASK_PROMPT))
  assert.match(by['claude-code:4'].note, /Couldn’t ask/)
  assert.equal(s.report[0].id, 'claude-code:2', 'most pressing first')
  // Kept for the next start of the app.
  const saved = JSON.parse(fs.readFileSync(path.join(home, 'foreman.json'), 'utf8'))
  assert.equal(saved.report.length, 4)
  const again = createForeman({ dataDir: home, harnesses: [], threads: async () => [], now: () => NOW })
  assert.equal((await again.status()).report.length, 4)
})

test('a big round is read in batches, so every session gets an answer', async (t) => {
  const threads = Array.from({ length: JUDGE_BATCH * 2 + 3 }, (_, i) => thread(i + 1, { lastActivityAt: NOW - 30 * 86_400_000 }))
  // Each run answers for exactly the sessions in its own prompt.
  const judge = (spec) => ({ sessions: [...spec.input.matchAll(/"id": "(claude-code:\d+)"/g)].map(([, id]) => ({ id, verdict: 'done', summary: `Read ${id}.`, next: '' })) })
  const { foreman, runs } = rig(t, { threads, judge })
  await foreman.start(threads.map((x) => x.id))
  await foreman.settled()
  const reads = runs.filter((r) => !r.ref)
  assert.equal(reads.length, 3)
  assert.ok(reads.every((r) => (r.input.match(/"id": /g) || []).length <= JUDGE_BATCH))
  const s = await foreman.status()
  assert.equal(s.report.length, threads.length, 'asleep for a month, and still checked')
  assert.ok(s.report.every((r) => r.verdict === 'done' && r.summary === `Read ${r.id}.`))
  assert.equal(runs.filter((r) => r.ref).length, 0, 'nobody asked when the reading settled it')
})

test('a failed batch waits for the batches already out, and starts no more', async (t) => {
  const threads = Array.from({ length: JUDGE_BATCH * 2 + 1 }, (_, i) => thread(i + 1))
  const { home, cleanup } = tmpHome()
  t.after(cleanup)
  let reads = 0
  let release
  let siblingDone = false
  const run = (spec) => {
    reads++
    if (reads === 1) return Promise.resolve({ ok: false, error: 'boom' })
    return new Promise((r) => (release = () => {
      siblingDone = true
      r({ ok: true, stdout: cli({ sessions: [] }, { total_cost_usd: 0.5 }) })
    }))
  }
  const harness = { id: 'claude-code', headless: async (ref, { prompt, cwd }) => ({ ok: true, exe: '/bin/claude', args: [], cwd, input: prompt }) }
  const foreman = createForeman({ dataDir: home, harnesses: [harness], threads: async () => threads, run, now: () => NOW })
  await foreman.start(threads.map((x) => x.id))
  while (!release) await new Promise((r) => setImmediate(r))
  for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r))
  assert.equal((await foreman.status()).phase, 'reading', 'still out while a sibling runs')
  release()
  await foreman.settled()
  assert.ok(siblingDone)
  const s = await foreman.status()
  assert.equal(s.phase, 'failed')
  assert.equal(s.costUsd, 0.5, 'the sibling’s cost is this round’s')
  assert.equal(reads, 2, 'the third batch never started')
})

test('a round only asks a few sessions', async (t) => {
  const threads = Array.from({ length: MAX_ASKS + 3 }, (_, i) => thread(i + 1))
  const { foreman, runs } = rig(t, { threads, judge: () => ({ sessions: [] }), answers: {} })
  await foreman.start(threads.map((x) => x.id))
  await foreman.settled()
  assert.equal(runs.filter((r) => r.ref).length, MAX_ASKS)
  const s = await foreman.status()
  assert.equal(s.report.filter((r) => /at most/.test(r.note)).length, 3)
})

test('a failed read says why, and a second start while one is out changes nothing', async (t) => {
  const { home, cleanup } = tmpHome()
  t.after(cleanup)
  let release
  const slow = createForeman({
    dataDir: home,
    harnesses: [{ id: 'claude-code', headless: async () => ({ ok: true, exe: '/bin/claude', args: [], cwd: home, input: 'x' }) }],
    threads: async () => [thread(1)],
    run: () => new Promise((r) => (release = () => r({ ok: true, stdout: JSON.stringify({ is_error: true, result: 'Failed to authenticate' }) }))),
    now: () => NOW,
  })
  await slow.start(['claude-code:1'])
  const second = await slow.start(['claude-code:1'])
  assert.equal(second.phase, 'reading')
  assert.equal((await slow.clear()).phase, 'reading', 'can’t clear a round that is out')
  while (!release) await new Promise((r) => setImmediate(r))
  release()
  await slow.settled()
  const s = await slow.status()
  assert.equal(s.phase, 'failed')
  assert.match(s.error, /sign in/)
})

test('clearing puts the report away', async (t) => {
  const { foreman } = rig(t, { threads: [thread(1, { needsInput: 'question' })], judge: () => ({ sessions: [] }) })
  await foreman.start(['claude-code:1'])
  await foreman.settled()
  assert.equal(verdictsOf(await foreman.status()).get('claude-code:1'), 'you')
  assert.equal((await foreman.clear()).phase, 'idle')
  assert.equal(verdictsOf(await foreman.status()).size, 0)
})

test('a report read back by hand keeps only real rows', () => {
  assert.equal(cleanRow({ id: 'claude-code:1', verdict: 'maybe' }), null)
  assert.equal(cleanRow({ id: '../x', verdict: 'done' }), null)
  assert.deepEqual(cleanRow({ id: 'copilot:a-b', verdict: 'done', summary: '  ok\n  ' }).summary, 'ok')
  assert.deepEqual(sortReport([{ verdict: 'done' }, { verdict: 'you' }]).map((r) => r.verdict), ['you', 'done'])
  assert.match(roundLine({ phase: 'done', report: [{ verdict: 'done' }, { verdict: 'done' }, { verdict: 'stuck' }] }), /3 sessions: 1 stuck, 2 done, can be closed/)
  assert.equal(cleanRow({ id: 'claude-code:1', verdict: 'unfinished', next: ' Tests\n left. ' }).next, 'Tests left.')
  assert.match(roundLine({ phase: 'failed', error: 'nope' }), /nope/)
})

test('a round sent to one folder checks and asks only that folder’s sessions', async (t) => {
  const threads = [thread(1, { project: 'web' }), thread(2, { project: 'api' }), thread(3, { project: 'web' })]
  const { foreman, runs, home } = rig(t, { threads, judge: () => ({ sessions: [] }), answers: {} })
  // The page asks for a thread from another folder too: it is left off, never read or asked.
  const started = await foreman.start(threads.map((x) => x.id), { folder: 'web' })
  assert.deepEqual(started.round, ['claude-code:1', 'claude-code:3'])
  assert.equal(started.folder, 'web')
  await foreman.settled()
  const s = await foreman.status()
  assert.deepEqual(s.report.map((r) => r.id).sort(), ['claude-code:1', 'claude-code:3'])
  assert.ok(!runs[0].input.includes('claude-code:2'), 'not read')
  assert.ok(!runs.some((r) => r.ref?.n === 2), 'not asked')
  assert.match(roundLine(s), /in web:/)
  // Remembered with the report, and gone with it.
  const again = createForeman({ dataDir: home, harnesses: [], threads: async () => [], now: () => NOW })
  assert.equal((await again.status()).folder, 'web')
  assert.equal((await foreman.clear()).folder, '')
})

test('a round with no folder named is the whole village’s', async (t) => {
  const threads = [thread(1, { project: 'web' }), thread(2, { project: 'api', running: true })]
  const { foreman } = rig(t, { threads, judge: () => ({ sessions: [] }) })
  const started = await foreman.start(threads.map((x) => x.id))
  assert.equal(started.folder, '')
  assert.equal(started.round.length, 2)
  await foreman.settled()
  assert.match(roundLine(await foreman.status()), /checked 2 sessions: /)
})

test('a folder is matched exactly, and one that isn’t a folder’s name matches nobody', async (t) => {
  const long = 'x'.repeat(130)
  const threads = [thread(1, { project: 'web' }), thread(2, { project: long }), thread(3, { project: 'api' })]
  const ids = threads.map((x) => x.id)
  for (const [folder, want] of [[' web', []], ['web ', []], [long, ['claude-code:2']], [long.slice(0, 120), []], [['web'], []], ['y'.repeat(300), []]]) {
    const { foreman } = rig(t, { threads, judge: () => ({ sessions: [] }) })
    const started = await foreman.start(ids, { folder })
    assert.deepEqual(started.round, want, JSON.stringify(folder).slice(0, 40))
    await foreman.settled()
  }
})
