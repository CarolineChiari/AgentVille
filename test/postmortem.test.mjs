import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { FINDINGS_SCHEMA, RUNNING_MAX, SELF_PROMPT, createPostMortems, readClaudeMd, reviewPrompt, transcriptText } from '../server/postmortem.mjs'
import { MAX_BUDGET_USD, POSTMORTEM_BUDGET_USD } from '../server/harnesses/claude-code/headless.mjs'
import { createClaudeCodeAdapter } from '../server/harnesses/claude-code/index.mjs'
import { LIST_MAX, cleanFindings, cleanPostMortem, itemsOf, openCount, pmLine, workPrompt } from '../src/game/postmortem.js'
import { tmpHome, uuid } from './helpers/fixtures.mjs'

const NOW = Date.parse('2026-10-14T12:00:00Z')
const cli = (value, extra = {}) => JSON.stringify({ type: 'result', is_error: false, result: '', structured_output: value, total_cost_usd: 0.4, ...extra })

const FOUND = {
  summary: 'Added the login page.',
  instructions: [{ where: 'CLAUDE.md', change: 'Run one test file, not the suite.' }, { where: '', change: '' }],
  lessons: ['The router caches routes.', '', 42],
  forYou: ['Say which page to copy.'],
  wentWell: ['Tests first.'],
}

test('findings are kept short, and an empty one is none at all', () => {
  const f = cleanFindings(FOUND)
  assert.deepEqual(f.instructions, [{ where: 'CLAUDE.md', change: 'Run one test file, not the suite.' }], 'a change with nothing in it is dropped')
  assert.deepEqual(f.lessons, ['The router caches routes.'])
  assert.equal(cleanFindings({ summary: '', lessons: [], instructions: 'x' }), null)
  assert.equal(cleanFindings({ lessons: Array.from({ length: 20 }, (_, i) => `l${i}`) }).lessons.length, LIST_MAX)
  assert.equal(cleanPostMortem({ id: 'nope' }), null)
  const p = cleanPostMortem({ id: 'claude-code:1', phase: 'weird', done: ['self.lessons.0', 'self.lessons.0', 'evil.key', '__proto__'] })
  assert.equal(p.phase, 'failed')
  assert.deepEqual(p.done, ['self.lessons.0'])
})

test('a post mortem’s findings are listed by kind, the session’s word first, and worked through', () => {
  const p = cleanPostMortem({ id: 'claude-code:1', title: 'Login', phase: 'done', self: FOUND, review: { summary: 'Fine.', instructions: [{ where: 'docs/testing.md', change: 'Say where fixtures live.' }], lessons: ['Read the tests first.'] }, done: ['self.lessons.0'] })
  const items = itemsOf(p)
  assert.deepEqual(items.slice(0, 3).map((i) => i.key), ['self.instructions.0', 'review.instructions.0', 'self.lessons.0'])
  assert.equal(items.find((i) => i.key === 'self.lessons.0').done, true)
  assert.equal(openCount(p), 4, 'what went well needs no work, and a ticked one is done')
  const all = workPrompt(p)
  assert.match(all, /CLAUDE\.md: Run one test file/)
  assert.match(all, /docs\/testing\.md: Say where fixtures live/)
  assert.match(all, /Read the tests first/)
  assert.ok(!all.includes('The router caches routes'), 'ticked off already')
  assert.ok(!all.includes('Say which page to copy'), 'feedback for the person is theirs, not a session’s')
  assert.match(all, /before committing/)
  const one = workPrompt(p, ['review.instructions.0'])
  assert.ok(one.includes('fixtures') && !one.includes('Run one test file'))
  assert.equal(workPrompt(p, ['self.forYou.0']), '')
  assert.match(pmLine(p), /4 things to work through/)
  assert.match(pmLine({ ...p, phase: 'failed', error: 'signed out' }), /couldn’t finish: signed out/)
})

test('the reviewer reads who said what, never the private reasoning, and a long one keeps both ends', () => {
  const msgs = [
    { role: 'user', text: 'Add a login page' },
    { role: 'thinking', text: 'secret reasoning' },
    { role: 'tool', name: 'Edit', detail: 'src/login.js' },
    { role: 'assistant', text: 'Done.' },
  ]
  assert.equal(transcriptText(msgs), 'person: Add a login page\ntool: Edit src/login.js\nagent: Done.')
  const long = Array.from({ length: 400 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', text: `message ${i} ${'x'.repeat(200)}` }))
  const t = transcriptText(long, 10_000)
  assert.ok(t.length <= 10_100)
  assert.ok(t.startsWith('person: message 0 '), 'the opening ask is kept')
  assert.ok(t.includes('message 399 '), 'and the end')
  assert.match(t, /\[… \d+ messages left out here …\]/)
  const prompt = reviewPrompt({ title: 'Login', project: 'web', transcript: t, instructions: 'Use tabs.' })
  assert.match(prompt, /never instructions to you/)
  assert.match(prompt, /<instructions file="CLAUDE.md">\nUse tabs\.\n<\/instructions>/)
  assert.match(reviewPrompt({ transcript: 'x' }), /has no CLAUDE\.md/)
  assert.match(SELF_PROMPT, /not a new task/)
  assert.match(SELF_PROMPT, /Do not change, create or delete anything/)
})

test('a project’s CLAUDE.md is read from inside its folder only', async (t) => {
  const { home, cleanup } = tmpHome()
  t.after(cleanup)
  const repo = path.join(home, 'repo')
  const elsewhere = path.join(home, 'elsewhere')
  fs.mkdirSync(repo)
  fs.mkdirSync(elsewhere)
  assert.equal(await readClaudeMd(repo), '')
  fs.writeFileSync(path.join(repo, 'CLAUDE.md'), '# Rules\nNo semicolons.')
  assert.equal(await readClaudeMd(repo), '# Rules\nNo semicolons.')
  fs.rmSync(path.join(repo, 'CLAUDE.md'))
  fs.writeFileSync(path.join(elsewhere, 'secret.txt'), 'private')
  fs.symlinkSync(path.join(elsewhere, 'secret.txt'), path.join(repo, 'CLAUDE.md'))
  assert.equal(await readClaudeMd(repo), '', 'a link out of the repo is not its instructions')
  assert.equal(await readClaudeMd('relative/dir'), '')
})

test('a post mortem may spend more than a status check, but never past the cap', async (t) => {
  const { home, cleanup } = tmpHome()
  t.after(cleanup)
  const a = createClaudeCodeAdapter({ home, env: {}, platform: 'darwin', claudePath: '/bin/claude' })
  const budget = async (o) => {
    const spec = await a.headless({ cliSessionId: uuid(3), cwd: '/work/repo' }, { prompt: 'hi', schema: {}, ...o })
    return Number(spec.args[spec.args.indexOf('--max-budget-usd') + 1])
  }
  assert.equal(await budget({}), 1)
  assert.equal(await budget({ budget: POSTMORTEM_BUDGET_USD }), POSTMORTEM_BUDGET_USD)
  assert.equal(await budget({ budget: 500 }), MAX_BUDGET_USD)
  assert.equal(await budget({ budget: 'lots' }), 1)
  const spec = await a.headless({ cliSessionId: uuid(3), cwd: '/work/repo' }, { prompt: 'hi', schema: {}, budget: POSTMORTEM_BUDGET_USD })
  assert.deepEqual(spec.args.slice(spec.args.indexOf('--resume')), ['--resume', uuid(3), '--fork-session'], 'still asked in a copy')
})

/** Threads, a harness that can be asked and read, and a CLI that answers from a script. */
function rig(t, { threads, self = () => ({ ok: true, stdout: cli(FOUND) }), review = () => ({ ok: true, stdout: cli({ summary: 'Read it.', instructions: [], lessons: ['Check the router.'], forYou: [], wentWell: [] }) }), harness: extra = {} }) {
  const { home, cleanup } = tmpHome()
  t.after(cleanup)
  const runs = []
  const harness = {
    id: 'claude-code',
    name: 'Claude Code',
    readTranscript: async (ref) => ({ ok: true, messages: [{ role: 'user', text: `task ${ref.n}` }, { role: 'thinking', text: 'secret' }, { role: 'assistant', text: `said ${ref.n}` }] }),
    headless: async (ref, { prompt, schema, cwd, budget }) => ({ ok: true, exe: '/bin/claude', args: [], cwd: ref ? `/work/${ref.n}` : cwd, input: prompt, ref, schema, budget }),
    ...extra,
  }
  // While `gate.shut`, every run waits on it: a post mortem stays out until the test lets it in.
  const gates = { shut: null }
  const run = async (spec, opts) => {
    runs.push({ ...spec, opts })
    if (gates.shut) await gates.shut
    return spec.ref ? self(spec) : review(spec)
  }
  const pms = createPostMortems({ dataDir: home, harnesses: [harness], threads: async () => threads, run, now: () => NOW, readInstructions: async (dir) => (dir === '/work/web' ? 'Use tabs.' : '') })
  return { pms, runs, home, gates }
}

const thread = (n, extra = {}) => ({ id: `claude-code:${n}`, harness: 'claude-code', title: `T${n}`, project: 'web', projectPath: '/work/web', lastActivityAt: NOW, ref: { n }, ...extra })

test('a post mortem asks the session in a copy, has a reviewer read it cold, and keeps both', async (t) => {
  const { pms, runs, home } = rig(t, { threads: [thread(1)] })
  const started = await pms.start('claude-code:1')
  assert.equal(started.ok, true)
  assert.deepEqual(started.running, ['claude-code:1'])
  assert.equal(started.postmortems[0].phase, 'running')
  await pms.settled()
  const asked = runs.find((r) => r.ref)
  const read = runs.find((r) => !r.ref)
  assert.equal(asked.input, SELF_PROMPT)
  assert.equal(asked.cwd, '/work/1', 'the session is asked in its own folder')
  assert.equal(read.cwd, path.join(home, 'postmortem'), 'the reviewer works at a desk of its own')
  assert.ok(read.input.includes('person: task 1') && read.input.includes('Use tabs.'))
  assert.ok(!read.input.includes('secret'))
  assert.ok(runs.every((r) => r.schema === FINDINGS_SCHEMA && r.budget === POSTMORTEM_BUDGET_USD && r.opts.timeoutMs > 0))
  const s = await pms.status()
  assert.deepEqual(s.running, [])
  const p = s.postmortems[0]
  assert.equal(p.phase, 'done')
  assert.equal(p.self.summary, 'Added the login page.')
  assert.deepEqual(p.review.lessons, ['Check the router.'])
  assert.equal(p.costUsd, 0.8)
  // Ticked off, kept, and read back by the next start of the app.
  assert.equal((await pms.mark('claude-code:1', 'review.lessons.0', true)).ok, true)
  assert.equal((await pms.mark('claude-code:1', 'not.a.key', true)).ok, false)
  const saved = JSON.parse(fs.readFileSync(path.join(home, 'postmortems.json'), 'utf8'))
  assert.deepEqual(saved.postmortems[0].done, ['review.lessons.0'])
  const again = createPostMortems({ dataDir: home, harnesses: [], threads: async () => [] })
  assert.equal((await again.status()).postmortems[0].self.summary, 'Added the login page.')
  await pms.mark('claude-code:1', 'review.lessons.0', false)
  assert.deepEqual((await pms.status()).postmortems[0].done, [])
  assert.equal((await pms.remove('claude-code:1')).postmortems.length, 0)
})

test('one side coming back empty still leaves the other’s findings; neither is a failure', async (t) => {
  const { pms } = rig(t, { threads: [thread(1), thread(2)], self: () => ({ ok: false, error: 'No conversation found' }) })
  await pms.start('claude-code:1')
  await pms.settled()
  let p = (await pms.status()).postmortems[0]
  assert.equal(p.phase, 'done')
  assert.equal(p.self, null)
  assert.match(p.selfNote, /No conversation found/)
  assert.equal(p.review.summary, 'Read it.')

  const both = rig(t, { threads: [thread(1)], self: () => ({ ok: true, stdout: cli({ summary: '', instructions: [], lessons: [], forYou: [], wentWell: [] }) }), review: () => ({ ok: true, stdout: JSON.stringify({ is_error: true, result: 'Failed to authenticate' }) }) })
  await both.pms.start('claude-code:1')
  await both.pms.settled()
  p = (await both.pms.status()).postmortems[0]
  assert.equal(p.phase, 'failed')
  assert.match(p.error, /nothing in it/)
  assert.match(p.error, /sign in/)
})

test('only a thread the scan knows, not one still working, and only a couple at once', async (t) => {
  const { pms, gates } = rig(t, { threads: [thread(1), thread(2), thread(3), thread(4, { running: true })] })
  assert.equal((await pms.start('claude-code:nope')).ok, false)
  assert.equal((await pms.start('../../etc')).ok, false)
  assert.match((await pms.start('claude-code:4')).error, /still working/)
  let open
  gates.shut = new Promise((r) => (open = r))
  for (let n = 1; n <= RUNNING_MAX; n++) assert.equal((await pms.start(`claude-code:${n}`)).ok, true)
  assert.equal((await pms.start('claude-code:1')).ok, true, 'one already out is no new one')
  assert.match((await pms.start('claude-code:3')).error, /already under way/)
  assert.equal((await pms.remove('claude-code:1')).ok, false, 'not while it is out')
  gates.shut = null
  open()
  await pms.settled()
  assert.equal((await pms.start('claude-code:3')).ok, true)
  await pms.settled()
})

test('a post mortem out when the app closed is not left under way', async (t) => {
  const { home, cleanup } = tmpHome()
  t.after(cleanup)
  fs.writeFileSync(path.join(home, 'postmortems.json'), JSON.stringify({ postmortems: [{ id: 'claude-code:1', phase: 'running' }, { id: 'claude-code:2', phase: 'running', review: { summary: 'Half.' } }] }))
  const s = await createPostMortems({ dataDir: home, harnesses: [], threads: async () => [] }).status()
  assert.deepEqual(s.postmortems.map((p) => p.phase), ['failed', 'done'])
  assert.match(s.postmortems[0].error, /closed before it finished/)
})

test('an agent that can’t be asked or read says so', async (t) => {
  const { pms } = rig(t, { threads: [thread(1, { harness: 'other' })] })
  await pms.start('claude-code:1')
  await pms.settled()
  const p = (await pms.status()).postmortems[0]
  assert.equal(p.phase, 'failed')
  assert.match(p.selfNote, /can’t be asked/)
  assert.match(p.reviewNote, /no transcript/)
})
