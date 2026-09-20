import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { appVersion, isNewerVersion, parseVersion, versionOf } from '../server/version.mjs'
import { tmpHome } from './helpers/fixtures.mjs'

test('a version or a release tag reads as three numbers, or not at all', () => {
  assert.deepEqual(parseVersion('0.39.0'), [0, 39, 0])
  assert.deepEqual(parseVersion('v0.39.0'), [0, 39, 0])
  assert.deepEqual(parseVersion(' v1.2.3 '), [1, 2, 3])
  assert.equal(parseVersion('0.40.0-rc.1'), null, 'a pre-release is not a release to tell anyone about')
  assert.equal(parseVersion('0.39'), null)
  assert.equal(parseVersion('latest'), null)
  assert.equal(parseVersion(undefined), null)
  assert.equal(versionOf('v2.0.1'), '2.0.1')
  assert.equal(versionOf('nightly'), '')
})

test('newer is newer, per component, and never on a guess', () => {
  assert.equal(isNewerVersion('v0.40.0', '0.39.0'), true)
  assert.equal(isNewerVersion('0.39.1', '0.39.0'), true)
  assert.equal(isNewerVersion('1.0.0', '0.99.99'), true)
  assert.equal(isNewerVersion('0.39.0', '0.39.0'), false, 'the version you are running is not news')
  assert.equal(isNewerVersion('0.9.0', '0.39.0'), false, 'not a string compare: 9 < 39')
  assert.equal(isNewerVersion('0.38.0', '0.39.0'), false, 'a build ahead of the release says nothing')
  assert.equal(isNewerVersion('', '0.39.0'), false)
  assert.equal(isNewerVersion('0.40.0', ''), false)
  assert.equal(isNewerVersion('0.40.0-rc.1', '0.39.0'), false)
})

test('the running version comes from the package.json beside the app', async (t) => {
  const { home, cleanup } = tmpHome()
  t.after(cleanup)
  fs.writeFileSync(path.join(home, 'package.json'), JSON.stringify({ version: '1.2.3' }))
  assert.equal(await appVersion(home), '1.2.3')
  fs.writeFileSync(path.join(home, 'package.json'), 'not json')
  assert.equal(await appVersion(home), '', 'an unreadable package.json means no notice, not a crash')
  assert.equal(await appVersion(path.join(home, 'nowhere')), '')
})
