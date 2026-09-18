import { test } from 'node:test'
import assert from 'node:assert/strict'
import { APP_PORT, augmentedPath, isAppUrl } from '../electron/env.mjs'

test('a Finder-launched Mac app still finds Homebrew and ~/.local/bin', () => {
  const p = augmentedPath({ PATH: '/usr/bin:/bin:/usr/sbin:/sbin' }, { home: '/Users/me', platform: 'darwin' })
  const dirs = p.split(':')
  assert.deepEqual(dirs.slice(0, 4), ['/usr/bin', '/bin', '/usr/sbin', '/sbin'])
  assert.ok(dirs.includes('/opt/homebrew/bin'))
  assert.ok(dirs.includes('/usr/local/bin'))
  assert.ok(dirs.includes('/Users/me/.local/bin'))
  assert.equal(new Set(dirs).size, dirs.length)
})

test('an existing PATH keeps its order and wins', () => {
  const p = augmentedPath({ PATH: '/custom/bin:/opt/homebrew/bin' }, { home: '/h', platform: 'darwin' })
  assert.ok(p.startsWith('/custom/bin:/opt/homebrew/bin:'))
  assert.equal(p.split(':').filter((d) => d === '/opt/homebrew/bin').length, 1)
})

test('an empty PATH still gets the standard directories', () => {
  const p = augmentedPath({}, { home: '/h', platform: 'linux' })
  assert.ok(!p.startsWith(':'))
  assert.ok(p.split(':').includes('/usr/bin'))
})

test('Windows PATH is left alone', () => {
  const PATH = 'C:\\Windows;C:\\Tools'
  assert.equal(augmentedPath({ PATH }, { home: 'C:\\Users\\me', platform: 'win32' }), PATH)
})

test('only the app origin may be navigated to', () => {
  const app = `http://localhost:${APP_PORT}`
  assert.equal(APP_PORT === 5274, false)
  assert.ok(isAppUrl(`${app}/?demo=1`, app))
  assert.ok(!isAppUrl(`http://localhost:${APP_PORT + 1}/`, app))
  assert.ok(!isAppUrl('https://github.com/x/y/pull/1', app))
  assert.ok(!isAppUrl('file:///etc/passwd', app))
  assert.ok(!isAppUrl('not a url', app))
  assert.ok(!isAppUrl(undefined, app))
  assert.ok(!isAppUrl(`${app}/`, null))
})
