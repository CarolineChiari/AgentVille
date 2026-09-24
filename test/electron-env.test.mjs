import { test } from 'node:test'
import assert from 'node:assert/strict'
import { APP_PORT, BADGE_PX, REPLACE_FLAG, augmentedPath, badgeBitmap, badgeCount, isAppUrl, relaunchPlan, replaceTarget, updateKind } from '../electron/env.mjs'
import { APP_TITLE, pageTitle } from '../src/game/notify.js'
import { APP_BG, BADGE, hexToRgb } from '../src/render/sprites/palette.js'

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

test('the dock badge reads the count out of the page title', () => {
  assert.equal(badgeCount('AgentVille'), 0)
  assert.equal(badgeCount('(3) AgentVille'), 3)
  assert.equal(badgeCount('(12) AgentVille'), 12)
})

test('a title that is not a count is no badge', () => {
  for (const junk of ['', '()', '(x) AgentVille', '(-2) AgentVille', '(2.5) AgentVille', '(3)AgentVille', 'AgentVille (3)', ' (3) AgentVille', '(12345) AgentVille', null, undefined, 3, {}]) {
    assert.equal(badgeCount(junk), 0, String(junk))
  }
})

test('the page writes the title the desktop app reads', () => {
  assert.equal(badgeCount(pageTitle({ waiting: 2, blocked: 1 })), 3)
  assert.equal(badgeCount(pageTitle({ waiting: 0, blocked: 0 })), 0)
  assert.equal(pageTitle({}), APP_TITLE)
})

/** The pixel at (x, y) as a palette hex, or null where it's transparent. Bitmaps are BGRA. */
function pixel({ width, data }, x, y) {
  const o = (y * width + x) * 4
  if (data[o + 3] === 0) return null
  const hex = (v) => v.toString(16).padStart(2, '0')
  return `#${hex(data[o + 2])}${hex(data[o + 1])}${hex(data[o])}`
}

test('no one waiting, no taskbar overlay', () => {
  assert.equal(badgeBitmap(0), null)
  assert.equal(badgeBitmap(-1), null)
  assert.equal(badgeBitmap(1.5), null)
  assert.equal(badgeBitmap(NaN), null)
})

test('the taskbar overlay is a rimmed yellow disc with the count in it', () => {
  const b = badgeBitmap(2)
  assert.equal(b.width, BADGE_PX)
  assert.equal(b.height, BADGE_PX)
  assert.equal(b.data.length, BADGE_PX * BADGE_PX * 4)
  assert.equal(pixel(b, 0, 0), null, 'the corners are see-through')
  assert.equal(pixel(b, 0, 8), APP_BG, 'a dark rim')
  assert.equal(pixel(b, 2, 8), BADGE.waiting)
  assert.equal(pixel(b, 5, 3), APP_BG, 'the top of the 2')
  // Every pixel is fully opaque or fully clear, so premultiplied alpha can't tint it.
  for (let i = 3; i < b.data.length; i += 4) assert.ok(b.data[i] === 0 || b.data[i] === 255)
  // Stored blue first, the order nativeImage reads raw bitmaps in.
  const { r, g, b: blue } = hexToRgb(BADGE.waiting)
  const o = (8 * BADGE_PX + 2) * 4
  assert.deepEqual([...b.data.subarray(o, o + 4)], [blue, g, r, 255])
})

test('each count draws differently, and ten or more is 9+', () => {
  const same = (a, b) => a.data.equals(b.data)
  assert.ok(!same(badgeBitmap(1), badgeBitmap(7)))
  assert.ok(!same(badgeBitmap(9), badgeBitmap(10)))
  assert.ok(same(badgeBitmap(10), badgeBitmap(99)))
  assert.ok(same(badgeBitmap(10), badgeBitmap(9999)))
})

test('the high-DPI overlay is the same picture, pixel-doubled', () => {
  const one = badgeBitmap(4)
  const two = badgeBitmap(4, 2)
  assert.equal(two.width, BADGE_PX * 2)
  for (let y = 0; y < two.height; y++) {
    for (let x = 0; x < two.width; x++) assert.equal(pixel(two, x, y), pixel(one, x >> 1, y >> 1))
  }
  assert.equal(badgeBitmap(4, 0), null)
})

test('only a packaged Windows build updates itself, and it knows which kind it is', () => {
  assert.equal(updateKind({ platform: 'win32', packaged: true, env: { PORTABLE_EXECUTABLE_FILE: 'C:\\Users\\me\\AgentVille.exe' } }), 'portable')
  assert.equal(updateKind({ platform: 'win32', packaged: true, env: {} }), 'installer')
  assert.equal(updateKind({ platform: 'win32', packaged: false, env: {} }), null, '`npm run app` is a checkout, not a build')
  assert.equal(updateKind({ platform: 'darwin', packaged: true, env: {} }), null)
})

test('the file an update replaces is only ever an absolute .exe', () => {
  const exe = 'C:\\Users\\me\\Desktop\\AgentVille.exe'
  assert.equal(replaceTarget(['C:\\tmp\\app.exe', `${REPLACE_FLAG}${exe}`]), exe)
  assert.equal(replaceTarget(['app.exe']), '')
  assert.equal(replaceTarget([`${REPLACE_FLAG}AgentVille.exe`]), '', 'relative')
  assert.equal(replaceTarget([`${REPLACE_FLAG}C:\\Users\\me\\notes.txt`]), '')
  assert.equal(replaceTarget([`${REPLACE_FLAG}\\\\server\\share\\AgentVille.exe`]), '', 'not a network share')
  assert.equal(replaceTarget([`${REPLACE_FLAG}C:\\Users\\me\\..\\..\\Windows\\x.exe`]), '')
  assert.equal(replaceTarget(undefined), '')
})

test('each kind restarts the way it installs', () => {
  const exe = 'C:\\Users\\me\\Desktop\\AgentVille.exe'
  assert.deepEqual(relaunchPlan({ kind: 'portable', file: 'C:\\data\\updates\\AgentVille-0.55.0-portable.exe', portableFile: exe }),
    { execPath: 'C:\\data\\updates\\AgentVille-0.55.0-portable.exe', args: [`${REPLACE_FLAG}${exe}`] })
  assert.deepEqual(relaunchPlan({ kind: 'installer', file: 'C:\\data\\updates\\AgentVille.Setup.0.55.0.exe' }),
    { execPath: 'C:\\data\\updates\\AgentVille.Setup.0.55.0.exe', args: ['/S', '--force-run'] })
  assert.equal(relaunchPlan({ kind: 'mac', file: '/x' }), null)
  assert.equal(relaunchPlan({ kind: 'portable', file: '' }), null)
})
