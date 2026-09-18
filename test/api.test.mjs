import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import os from 'node:os'
import { createApiMiddleware } from '../server/api.mjs'
import { tmpHome } from './helpers/fixtures.mjs'

let server, base, home, cleanup
const launched = []
const fakeHarness = {
  id: 'fake',
  name: 'Fake',
  detect: async () => true,
  scanThreads: async () => [{ id: 'fake:1', title: 'One', lastActivityAt: 1, ref: { sid: '1' } }],
  openThread: (ref) => (ref?.sid === '1' ? { ok: true, url: 'fake://1' } : { ok: false, error: 'nope' }),
  newSession: (dir) => ({ ok: true, url: `fake://new?${dir}` }),
}

before(async () => {
  ;({ home, cleanup } = tmpHome())
  const opener = {
    platform: 'test',
    launch: (u) => (launched.push(u), { ok: true }),
    reveal: (d) => (launched.push(d), { ok: true }),
  }
  const prStore = { get: async () => ({ repos: {}, updating: false, available: true, warnings: [] }) }
  const api = createApiMiddleware({ dataDir: home, harnesses: [fakeHarness], opener, prStore })
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
  assert.deepEqual(body.harnesses, [{ id: 'fake', name: 'Fake', detected: true }])
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

test('open-url only opens https github.com links', async () => {
  assert.equal((await post('/api/open-url', { url: 'https://github.com/me/app/pull/1' })).status, 200)
  assert.equal(launched.at(-1), 'https://github.com/me/app/pull/1')
  assert.equal((await post('/api/open-url', { url: 'http://github.com/me' })).status, 400)
  assert.equal((await post('/api/open-url', { url: 'https://evil.example/github.com' })).status, 400)
  assert.equal((await post('/api/open-url', { url: 'file:///etc/passwd' })).status, 400)
  assert.equal((await post('/api/open-url', { url: 'not a url' })).status, 400)
})
