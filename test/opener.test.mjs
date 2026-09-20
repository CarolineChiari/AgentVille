import { test } from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import { commandFor, createOpener, createShellOpener, linkGapMs, resolveFolder } from '../server/opener.mjs'

test('each platform gets an argv without a shell', () => {
  const url = 'claude://code/new?folder=%2Fa'
  assert.deepEqual(commandFor('url', url, 'darwin'), { cmd: 'open', args: [url] })
  assert.deepEqual(commandFor('url', url, 'win32'), { cmd: 'rundll32', args: ['url.dll,FileProtocolHandler', url] })
  assert.deepEqual(commandFor('folder', 'C:\\x', 'win32'), { cmd: 'explorer', args: ['C:\\x'] })
  assert.equal(commandFor('url', url, 'aix'), null)
})

test('launch spawns detached with shell disabled and swallows child errors', () => {
  const calls = []
  const spawn = (cmd, args, opts) => {
    calls.push({ cmd, args, opts })
    return { on: (ev, fn) => calls.push({ ev, fn }), unref: () => calls.push('unref') }
  }
  const r = createOpener({ spawn, platform: 'darwin' }).launch('claude://x')
  assert.deepEqual(r, { ok: true })
  assert.equal(calls[0].opts.shell, false)
  assert.equal(calls[0].opts.detached, true)
  assert.equal(calls[1].ev, 'error')
  assert.equal(calls[2], 'unref')
})

test('nothing is launched hidden on Windows, or the first window never shows', () => {
  const calls = []
  const spawn = (cmd, args, opts) => (calls.push(opts), { on() {}, unref() {} })
  const win = createOpener({ spawn, platform: 'win32' })
  win.launch('vscode://file/C:/x/')
  win.reveal('C:\\x')
  assert.equal(calls.length, 2)
  for (const opts of calls) {
    assert.equal(opts.windowsHide, false)
    assert.equal(opts.shell, false)
    assert.equal(opts.detached, true)
  }
})

test('Windows waits longer between links than a Mac does', () => {
  assert.ok(linkGapMs('win32') > linkGapMs('darwin'))
  assert.equal(linkGapMs('linux'), linkGapMs('darwin'))
})

test('resolveFolder rejects relative, missing and non-string folders', async () => {
  assert.equal(await resolveFolder('relative/dir'), null)
  assert.equal(await resolveFolder('/definitely/not/here/xyz'), null)
  assert.equal(await resolveFolder(['/tmp']), null)
  assert.ok(await resolveFolder(os.tmpdir()))
})

test('launchAll opens each URL in order with a pause between', async () => {
  const opened = []
  const spawn = (cmd, args) => (opened.push([args.at(-1), Date.now()]), { on() {}, unref() {} })
  const r = await createOpener({ spawn, platform: 'darwin' }).launchAll(['a://1', 'b://2'], 50)
  assert.deepEqual(r, { ok: true })
  assert.deepEqual(opened.map((o) => o[0]), ['a://1', 'b://2'])
  assert.ok(opened[1][1] - opened[0][1] >= 45)
})

test('the shell opener hands each link over in order and passes a folder to openPath', async () => {
  const seen = []
  const o = createShellOpener({
    openExternal: async (u) => void seen.push(u),
    openPath: async (d) => (seen.push(d), ''), // '' is openPath's success
    platform: 'win32',
  })
  assert.deepEqual(await o.launchAll(['vscode://file/C:/x/', 'vscode://ext/open?session=1'], 1), { ok: true })
  assert.deepEqual(await o.reveal('C:\\x'), { ok: true })
  assert.deepEqual(seen, ['vscode://file/C:/x/', 'vscode://ext/open?session=1', 'C:\\x'])
  assert.equal(o.platform, 'win32')
})

test('the shell opener reports a rejection and a refusal, and stops at the first bad link', async () => {
  const tried = []
  const o = createShellOpener({
    openExternal: async (u) => (tried.push(u), Promise.reject(new Error('no handler'))),
    openPath: async () => 'Does not exist',
  })
  assert.deepEqual(await o.launchAll(['a://1', 'b://2'], 1), { ok: false, error: 'no handler' })
  assert.deepEqual(tried, ['a://1'])
  assert.deepEqual(await o.reveal('/gone'), { ok: false, error: 'Does not exist' })
})
