import { test } from 'node:test'
import assert from 'node:assert/strict'
import { tipOf } from '../src/ui/tip.js'

const NOW = 1_700_000_000_000
const MIN = 60_000
const thread = (more = {}) => ({ title: 'Fix the gate', project: 'garden', lastActivityAt: NOW - 5 * MIN, running: false, needsInput: '', ...more })

test('a resting thread gives its name, its folder and how long ago it was last active', () => {
  assert.deepEqual(tipOf(thread(), NOW), { title: 'Fix the gate', where: 'garden', when: 'Last active 5 min ago' })
  assert.equal(tipOf(thread({ lastActivityAt: NOW - 30 * 60 * MIN }), NOW).when, 'Last active yesterday')
})

test('working and waiting say so instead of a time', () => {
  assert.equal(tipOf(thread({ running: true }), NOW).when, 'Working now')
  assert.equal(tipOf(thread({ running: true, needsInput: 'permission prompt' }), NOW).when, 'Waiting on you')
})

test('a thread with no title or no thread at all', () => {
  assert.equal(tipOf(thread({ title: '' }), NOW).title, 'Untitled')
  assert.equal(tipOf(null, NOW), null)
})
