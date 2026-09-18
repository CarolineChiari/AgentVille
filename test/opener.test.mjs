import { test } from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import { commandFor, createOpener, resolveFolder } from '../server/opener.mjs'

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

test('resolveFolder rejects relative, missing and non-string folders', async () => {
  assert.equal(await resolveFolder('relative/dir'), null)
  assert.equal(await resolveFolder('/definitely/not/here/xyz'), null)
  assert.equal(await resolveFolder(['/tmp']), null)
  assert.ok(await resolveFolder(os.tmpdir()))
})
