import { test } from 'node:test'
import assert from 'node:assert/strict'
import { shouldDownload, updateButton } from '../src/game/release.js'

const release = (update, extra = {}) => ({ current: '0.54.0', latest: '0.55.0', newer: true, update, ...extra })

test('no newer release, no button', () => {
  assert.equal(updateButton(release({ supported: true, state: 'ready', version: '0.55.0' }, { newer: false })), null)
  assert.equal(updateButton(undefined), null)
})

test('a copy that cannot update itself only points at the release notes', () => {
  const b = updateButton(release({ supported: false, state: 'idle', version: '' }))
  assert.deepEqual([b.label, b.act], ['0.55.0 available', 'notes'])
  assert.equal(updateButton(release(undefined)).act, 'notes', 'an older server with no `update` still gets the notice')
  assert.equal(shouldDownload(release({ supported: false, state: 'idle', version: '' })), false)
})

test('one that can goes notice, download, restart', () => {
  assert.equal(shouldDownload(release({ supported: true, state: 'idle', version: '' })), true)
  assert.equal(updateButton(release({ supported: true, state: 'downloading', version: '0.55.0' })).act, 'wait')
  assert.equal(shouldDownload(release({ supported: true, state: 'downloading', version: '0.55.0' })), false)
  const ready = updateButton(release({ supported: true, state: 'ready', version: '0.55.0' }))
  assert.deepEqual([ready.label, ready.act], ['Restart for 0.55.0', 'install'])
  assert.equal(shouldDownload(release({ supported: true, state: 'ready', version: '0.55.0' })), false)
})

test('a failed download waits for a click, and a newer release starts over', () => {
  const failed = release({ supported: true, state: 'failed', version: '0.55.0', error: 'offline' })
  assert.equal(shouldDownload(failed), false)
  assert.equal(updateButton(failed).act, 'retry')
  assert.match(updateButton(failed).title, /offline/)
  const stale = release({ supported: true, state: 'ready', version: '0.55.0' }, { latest: '0.56.0' })
  assert.equal(shouldDownload(stale), true, 'the build for the release before is not the one on offer')
  assert.equal(updateButton(stale).act, 'notes')
})
