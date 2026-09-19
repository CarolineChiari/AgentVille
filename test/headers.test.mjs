import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createServer } from '../server/index.mjs'
import { DEV_HEADERS, HEADERS } from '../server/headers.mjs'
import { tmpHome } from './helpers/fixtures.mjs'

test('the built app sends its security headers on the page and on the API', async (t) => {
  const { home, cleanup } = tmpHome()
  t.after(cleanup)
  fs.writeFileSync(path.join(home, 'index.html'), '<!doctype html>')
  const s = createServer({ port: 0, dataDir: home, distDir: home, log: null, harnesses: [] })
  t.after(s.close)
  const base = await s.ready
  for (const p of ['/', '/api/state']) {
    const r = await fetch(`${base}${p}`)
    assert.equal(r.status, 200, p)
    for (const [name, value] of Object.entries(HEADERS)) assert.equal(r.headers.get(name), value, `${name} on ${p}`)
  }
})

test('no page may frame the village, in the built app or in dev', () => {
  for (const h of [HEADERS, DEV_HEADERS]) {
    assert.equal(h['X-Frame-Options'], 'DENY')
    assert.match(h['Content-Security-Policy'], /frame-ancestors 'none'/)
  }
})

test("the built page's scripts and requests stay on its own origin", () => {
  const csp = Object.fromEntries(HEADERS['Content-Security-Policy'].split('; ').map((d) => [d.split(' ')[0], d]))
  assert.equal(csp['script-src'], "script-src 'self'")
  assert.equal(csp['connect-src'], "connect-src 'self'")
  assert.equal(csp['object-src'], "object-src 'none'")
})
