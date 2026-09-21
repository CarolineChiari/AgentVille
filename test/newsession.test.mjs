import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parentOf, pick, startableHarnesses } from '../src/ui/newsession.js'

test('parentOf splits either separator', () => {
  assert.equal(parentOf('/Users/me/GitHub/app'), '/Users/me/GitHub')
  assert.equal(parentOf('/Users/me/GitHub/app/'), '/Users/me/GitHub')
  assert.equal(parentOf('C:\\Users\\me\\app'), 'C:\\Users\\me')
  assert.equal(parentOf('/app'), '/')
  assert.equal(parentOf(''), '')
  assert.equal(parentOf('app'), '')
})

test('only harnesses with somewhere to start are offered, the remembered one first', () => {
  const list = startableHarnesses([{ id: 'a', detected: true, targets: [{}] }, { id: 'b', detected: true, targets: [] }, { id: 'c', detected: false, targets: [{}] }])
  assert.deepEqual(list.map((h) => h.id), ['a'])
  assert.equal(pick(list, 'zz').id, 'a')
})
