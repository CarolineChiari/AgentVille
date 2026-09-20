import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createApiMiddleware } from '../server/api.mjs'
import { tmpHome } from './helpers/fixtures.mjs'

let server, base, home, cleanup
const launched = []
const terminals = []
const fakeHarness = {
  id: 'fake',
  name: 'Fake',
  detect: async () => true,
  scanThreads: async () => [{ id: 'fake:1', title: 'One', lastActivityAt: 1, ref: { sid: '1' } }],
  openThread: (ref) =>
    ref?.sid === '1'
      ? { ok: true, url: 'fake://1' }
      : ref?.sid === 'two'
        ? { ok: true, where: 'VS Code', url: 'fake://chat', urls: ['fake://folder', 'fake://chat'] }
        : { ok: false, error: 'nope' },
  newSession: (dir) => ({ ok: true, url: `fake://new?${dir}` }),
  targets: async () => [{ id: 'vscode', label: 'VS Code', note: '' }, { id: 'terminal', label: 'Terminal', note: '' }],
}

before(async () => {
  ;({ home, cleanup } = tmpHome())
  const opener = {
    platform: 'test',
    launch: (u) => (launched.push(u), { ok: true }),
    launchAll: async (urls) => (urls.forEach((u) => launched.push(u)), { ok: true }),
    reveal: (d) => (launched.push(d), { ok: true }),
  }
  const prStore = { get: async () => ({ repos: {}, updating: false, available: true, warnings: [] }) }
  const terminal = async (spec) => (terminals.push(spec), { ok: true, promptPassed: true })
  const issueStore = { get: async (list) => ({ repos: {}, updating: false, available: true, warnings: [], asked: list.length }) }
  const repoStore = { get: async (list) => ({ repos: Object.fromEntries(list.map((p) => [p.name, { lines: 12 }])), updating: false }) }
  const releaseStore = { get: async () => ({ current: '0.39.0', latest: '0.40.0', url: 'https://github.com/me/app/releases/tag/v0.40.0', newer: true }) }
  const api = createApiMiddleware({ dataDir: home, harnesses: [fakeHarness], opener, prStore, issueStore, repoStore, releaseStore, terminal })
  server = http.createServer((req, res) => api(req, res, null))
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  base = `http://127.0.0.1:${server.address().port}`
})
after(() => {
  server.close()
  cleanup()
})

const ORIGIN = () => ({ Origin: base, 'Content-Type': 'application/json' })
const put = (body, headers = ORIGIN()) => fetch(`${base}/api/state`, { method: 'PUT', headers, body: JSON.stringify(body) })
const post = (p, body, headers = ORIGIN()) => fetch(`${base}${p}`, { method: 'POST', headers, body: JSON.stringify(body) })

test('threads endpoint returns the documented shape', async () => {
  const r = await fetch(`${base}/api/threads`)
  assert.equal(r.status, 200)
  assert.equal(r.headers.get('cache-control'), 'no-store')
  const body = await r.json()
  assert.equal(body.threads[0].id, 'fake:1')
  assert.equal(body.threads[0].harness, 'fake')
  assert.equal(typeof body.scannedAt, 'number')
  assert.deepEqual(body.warnings, [])
})

test('harnesses endpoint reports detection and platform', async () => {
  const body = await (await fetch(`${base}/api/harnesses`)).json()
  assert.deepEqual(body.harnesses.map(({ targets, ...h }) => ({ ...h, targets: targets.map((t) => t.id) })), [{ id: 'fake', name: 'Fake', detected: true, targets: ['vscode', 'terminal'] }])
  assert.equal(body.platform, 'test')
})

test('a stale PUT gets 409 with the state on disk; a PUT without base is allowed', async () => {
  const first = await (await put({ archived: ['a'] })).json()
  const second = await put({ archived: ['b'], baseUpdatedAt: first.updatedAt })
  assert.equal(second.status, 200)
  const stale = await put({ archived: ['c'], baseUpdatedAt: first.updatedAt })
  assert.equal(stale.status, 409)
  assert.deepEqual((await stale.json()).archived, ['b'])
})

test('five concurrent PUTs on one base give one 200 and four 409s', async () => {
  const cur = await (await fetch(`${base}/api/state`)).json()
  const results = await Promise.all([1, 2, 3, 4, 5].map((n) => put({ archived: [`n${n}`], baseUpdatedAt: cur.updatedAt })))
  const codes = results.map((r) => r.status).sort()
  assert.deepEqual(codes, [200, 409, 409, 409, 409])
})

test('a state-changing request without Origin, or from another origin, is refused', async () => {
  assert.equal((await put({}, { 'Content-Type': 'application/json' })).status, 403)
  assert.equal((await put({}, { Origin: 'https://evil.example', 'Content-Type': 'application/json' })).status, 403)
  assert.equal((await put({}, { Origin: 'null', 'Content-Type': 'application/json' })).status, 403)
})

test('another page on this machine is refused: same host, different port or scheme', async () => {
  const { port } = new URL(base)
  for (const origin of [`http://127.0.0.1:${Number(port) + 1}`, 'http://localhost:3000', `https://127.0.0.1:${port}`, 'http://127.0.0.1']) {
    assert.equal((await post('/api/new-session', { harness: 'fake', folder: os.tmpdir() }, { Origin: origin, 'Content-Type': 'application/json' })).status, 403, origin)
  }
})

test('a state-changing request that is not JSON is refused, since only JSON is preflighted', async () => {
  assert.equal((await put({}, { Origin: base })).status, 403)
  assert.equal((await put({}, { Origin: base, 'Content-Type': 'text/plain' })).status, 403)
  assert.equal((await put({}, { Origin: base, 'Content-Type': 'application/json; charset=utf-8' })).status, 200)
})

test('a foreign Host is refused even for GET', async () => {
  const status = await new Promise((resolve) => {
    http.get(`${base}/api/threads`, { headers: { Host: 'evil.example' } }, (res) => {
      res.resume()
      resolve(res.statusCode)
    })
  })
  assert.equal(status, 403)
})

test('an oversized body is rejected', async () => {
  const big = 'x'.repeat(5 * 1024 * 1024)
  const r = await fetch(`${base}/api/state`, { method: 'PUT', headers: ORIGIN(), body: big }).catch(() => ({ status: 413 }))
  assert.equal(r.status, 413)
})

test('open hands the adapter URL to the opener', async () => {
  const r = await post('/api/open', { harness: 'fake', ref: { sid: '1' } })
  assert.equal(r.status, 200)
  assert.equal(launched.at(-1), 'fake://1')
  assert.equal((await post('/api/open', { harness: 'fake', ref: { sid: '2' } })).status, 400)
  assert.equal((await post('/api/open', { harness: 'nope', ref: {} })).status, 400)
})

test('a two-link open sends both in order and offers the chat link again on its own', async () => {
  const r = await post('/api/open', { harness: 'fake', ref: { sid: 'two' } })
  assert.equal(r.status, 200)
  assert.equal((await r.json()).chatAgain, true)
  assert.deepEqual(launched.slice(-2), ['fake://folder', 'fake://chat'])
  const again = await post('/api/open', { harness: 'fake', ref: { sid: 'two' }, only: 'chat' })
  assert.equal(again.status, 200)
  assert.equal(launched.at(-1), 'fake://chat')
  assert.notEqual(launched.at(-2), 'fake://folder') // the folder link is not repeated
})

test('only: chat is ignored where the adapter gave a single link', async () => {
  const r = await post('/api/open', { harness: 'fake', ref: { sid: '1' }, only: 'chat' })
  assert.equal(r.status, 200)
  assert.equal((await r.json()).chatAgain, false)
  assert.equal(launched.at(-1), 'fake://1')
})

test('reveal and new-session refuse relative or missing folders', async () => {
  assert.equal((await post('/api/reveal', { folder: 'relative' })).status, 400)
  assert.equal((await post('/api/new-session', { folder: '/not/here/xyz' })).status, 400)
  assert.equal((await post('/api/reveal', { folder: os.tmpdir() })).status, 200)
})

test('archive recorded under a ref id is recognised', async () => {
  const cur = await (await fetch(`${base}/api/state`)).json()
  await put({ ...cur, archived: ['fake:1'], baseUpdatedAt: cur.updatedAt })
  const body = await (await fetch(`${base}/api/threads`)).json()
  assert.equal(body.threads[0].archivedHere, true)
})

test('open passes the target through to the adapter', async () => {
  let seen
  fakeHarness.openThread = (ref, opts) => ((seen = opts), { ok: true, url: 'fake://x' })
  await post('/api/open', { harness: 'fake', ref: {}, target: 'vscode' })
  assert.deepEqual(seen, { target: 'vscode' })
  await post('/api/open', { harness: 'fake', ref: {}, target: 'rm -rf' })
  assert.deepEqual(seen, { target: 'app' }, 'unknown targets fall back to the app')
})

test('prs endpoint answers from the store', async () => {
  const body = await (await fetch(`${base}/api/prs`)).json()
  assert.deepEqual(body, { repos: {}, updating: false, available: true, warnings: [] })
})

test('issues endpoint answers from the store', async () => {
  const r = await fetch(`${base}/api/issues`)
  assert.equal(r.status, 200)
  const body = await r.json()
  assert.deepEqual(body.repos, {})
  assert.equal(body.available, true)
  assert.equal(typeof body.asked, 'number', 'the store is handed the known projects')
})

test('open-url only opens https github.com links', async () => {
  assert.equal((await post('/api/open-url', { url: 'https://github.com/me/app/pull/1' })).status, 200)
  assert.equal(launched.at(-1), 'https://github.com/me/app/pull/1')
  assert.equal((await post('/api/open-url', { url: 'https://github.com/me/app/issues/4' })).status, 200)
  assert.equal((await post('/api/open-url', { url: 'http://github.com/me' })).status, 400)
  assert.equal((await post('/api/open-url', { url: 'https://evil.example/github.com' })).status, 400)
  assert.equal((await post('/api/open-url', { url: 'file:///etc/passwd' })).status, 400)
  assert.equal((await post('/api/open-url', { url: 'not a url' })).status, 400)
})

test('transcript endpoint needs the page origin and a harness that can read one', async () => {
  fakeHarness.readTranscript = async (ref) => (ref?.sid === '1' ? { ok: true, messages: [{ role: 'user', text: 'hi' }], total: 1 } : { ok: false, error: 'nope' })
  const r = await post('/api/transcript', { harness: 'fake', ref: { sid: '1' } })
  assert.equal(r.status, 200)
  assert.equal((await r.json()).messages[0].text, 'hi')
  assert.equal((await post('/api/transcript', { harness: 'fake', ref: { sid: '2' } })).status, 404)
  assert.equal((await post('/api/transcript', { harness: 'fake', ref: { sid: '1' } }, { 'Content-Type': 'application/json' })).status, 403)
})

test('changes endpoint passes the detail flag to the harness that has one', async () => {
  let seen
  fakeHarness.readChanges = async (ref, opts) => ((seen = opts), ref?.sid === '1' ? { ok: true, files: [{ path: 'a.js', edits: 2 }] } : { ok: false, error: 'nope' })
  const r = await post('/api/changes', { harness: 'fake', ref: { sid: '1' } })
  assert.equal(r.status, 200)
  assert.equal((await r.json()).files[0].path, 'a.js')
  assert.equal(seen.detail, false)
  await post('/api/changes', { harness: 'fake', ref: { sid: '1' }, detail: true })
  assert.equal(seen.detail, true)
  // `path` asks for one file's own text; it is a string, and a bounded one.
  await post('/api/changes', { harness: 'fake', ref: { sid: '1' }, path: 'src/a.js' })
  assert.equal(seen.path, 'src/a.js')
  await post('/api/changes', { harness: 'fake', ref: { sid: '1' }, path: 'x'.repeat(900) })
  assert.equal(seen.path.length, 400)
  await post('/api/changes', { harness: 'fake', ref: { sid: '1' }, path: ['src/a.js'] })
  assert.equal(seen.path, '', 'anything that is not a string asks for no file at all')
  assert.equal((await post('/api/changes', { harness: 'fake', ref: { sid: '2' } })).status, 404)
  assert.equal((await post('/api/changes', { harness: 'fake', ref: { sid: '1' } }, { 'Content-Type': 'application/json' })).status, 403)
  delete fakeHarness.readChanges
  assert.equal((await post('/api/changes', { harness: 'fake', ref: { sid: '1' } })).status, 400)
})

test('open-file only opens a real file inside the folder the page named', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentville-files-'))
  fs.mkdirSync(path.join(dir, 'src'))
  fs.writeFileSync(path.join(dir, 'src', 'a b.js'), 'x')
  const real = fs.realpathSync(dir)

  assert.equal((await post('/api/open-file', { folder: dir, path: 'src/a b.js' })).status, 200)
  assert.equal(launched.at(-1), `vscode://file${real.split(path.sep).filter(Boolean).map((s) => '/' + encodeURIComponent(s)).join('')}/src/a%20b.js`)
  await post('/api/open-file', { folder: dir, path: 'src/a b.js', editor: 'cursor' })
  assert.match(launched.at(-1), /^cursor:\/\/file\//)
  // An editor we don't know about never picks the scheme.
  await post('/api/open-file', { folder: dir, path: 'src/a b.js', editor: 'evil' })
  assert.match(launched.at(-1), /^vscode:\/\/file\//)

  const before = launched.length
  assert.equal((await post('/api/open-file', { folder: dir, path: '../../etc/passwd' })).status, 400)
  assert.equal((await post('/api/open-file', { folder: dir, path: '/etc/passwd' })).status, 400)
  assert.equal((await post('/api/open-file', { folder: dir, path: 'src' })).status, 400, 'a folder is not a file')
  assert.equal((await post('/api/open-file', { folder: dir, path: 'src/gone.js' })).status, 400)
  assert.equal((await post('/api/open-file', { folder: path.join(dir, 'nope'), path: 'a.js' })).status, 400)
  assert.equal(launched.length, before, 'nothing refused ever reached the OS')
  fs.rmSync(dir, { recursive: true, force: true })
})

test('new-session passes the prompt and model through, and runs terminal launches', async () => {
  let seen
  fakeHarness.newSession = (dir, opts) => ((seen = opts), { ok: true, url: 'fake://new' })
  await post('/api/new-session', { folder: os.tmpdir(), target: 'vscode', prompt: 'hello' })
  assert.deepEqual(seen, { target: 'vscode', prompt: 'hello', model: '', effort: '' })
  fakeHarness.newSession = (dir, opts) => ((seen = opts), { ok: true, terminal: { exe: '/bin/x', args: [], cwd: dir, prompt: '' } })
  const r = await post('/api/new-session', { folder: os.tmpdir(), target: 'terminal', model: 'opus', effort: 'high' })
  assert.equal(r.status, 200)
  assert.equal(terminals.length, 1)
  assert.deepEqual(seen, { target: 'terminal', prompt: '', model: 'opus', effort: 'high' })
})

test('new-session only uses a target the harness offers on this machine', async () => {
  let seen
  fakeHarness.newSession = (dir, opts) => ((seen = opts), { ok: true, url: 'fake://new' })
  await post('/api/new-session', { folder: os.tmpdir(), target: 'app' })
  assert.equal(seen.target, 'vscode', 'an unoffered target falls back to the first offered one')
  await post('/api/new-session', { folder: os.tmpdir(), target: ['terminal'] })
  assert.equal(seen.target, 'vscode', 'a target must be a string')
  const saved = fakeHarness.targets
  fakeHarness.targets = async () => []
  const r = await post('/api/new-session', { folder: os.tmpdir(), target: 'vscode' })
  fakeHarness.targets = saved
  assert.equal(r.status, 400)
})

test('a task goes into the thread when the harness can continue it', async () => {
  let seen
  fakeHarness.continueThread = async (ref, opts) => ((seen = { ref, opts }), { ok: true, where: 'a terminal', terminal: { exe: '/bin/x', args: ['--resume', '1'], cwd: '/w', prompt: opts.prompt } })
  const before = terminals.length
  const r = await post('/api/task', { harness: 'fake', ref: { sid: '1' }, folder: os.tmpdir(), prompt: '  commit it  ' })
  delete fakeHarness.continueThread
  assert.equal(r.status, 200)
  assert.deepEqual(await r.json(), { ok: true, continued: true, where: 'a terminal', promptPassed: true })
  assert.deepEqual(seen, { ref: { sid: '1' }, opts: { prompt: 'commit it' } })
  assert.equal(terminals.length, before + 1)
})

test('a task falls back to a new session in the folder when the thread cannot take it', async () => {
  let seen
  fakeHarness.continueThread = async () => ({ ok: false, error: 'no CLI' })
  fakeHarness.newSession = (dir, opts) => ((seen = { dir, opts }), { ok: true, url: 'fake://new' })
  const r = await post('/api/task', { harness: 'fake', ref: {}, folder: os.tmpdir(), prompt: 'review', target: 'terminal' })
  delete fakeHarness.continueThread
  const body = await r.json()
  assert.equal(r.status, 200)
  assert.equal(body.continued, false)
  assert.equal(seen.opts.prompt, 'review')
  assert.equal(seen.opts.target, 'terminal')
  // A harness with no continueThread at all takes the same path.
  assert.equal((await post('/api/task', { harness: 'fake', folder: os.tmpdir(), prompt: 'x' })).status, 200)
})

test('a task needs a known harness, a prompt, and a real folder to fall back to', async () => {
  assert.equal((await post('/api/task', { harness: 'nope', folder: os.tmpdir(), prompt: 'x' })).status, 400)
  assert.equal((await post('/api/task', { harness: 'fake', folder: os.tmpdir(), prompt: '   ' })).status, 400)
  assert.equal((await post('/api/task', { harness: 'fake', folder: os.tmpdir(), prompt: ['x'] })).status, 400)
  assert.equal((await post('/api/task', { harness: 'fake', folder: '/not/here/xyz', prompt: 'x' })).status, 400)
  assert.equal((await post('/api/task', { harness: 'fake', folder: os.tmpdir(), prompt: 'x' }, { 'Content-Type': 'application/json' })).status, 403)
})

test('the repos endpoint counts only the folders the scan found', async () => {
  const r = await fetch(`${base}/api/repos`)
  assert.equal(r.status, 200)
  const body = await r.json()
  assert.equal(body.updating, false)
  // The fake harness's thread has no folder, so there is nothing to count.
  assert.deepEqual(body.repos, {})
})

test('the version endpoint says what is running and what has been released', async () => {
  const r = await fetch(`${base}/api/version`)
  assert.equal(r.status, 200)
  const body = await r.json()
  assert.equal(body.current, '0.39.0')
  assert.equal(body.latest, '0.40.0')
  assert.equal(body.newer, true)
  // The page opens that link through /api/open-url, which takes only github.com.
  const opened = await post('/api/open-url', { url: body.url })
  assert.equal(opened.status, 200)
  assert.equal(launched.at(-1), body.url)
})
