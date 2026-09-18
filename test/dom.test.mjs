import { test } from 'node:test'
import assert from 'node:assert/strict'
import { submitKey } from '../src/ui/dom.js'

test('the submit shortcut is ⌘↵ on a Mac and Ctrl+Enter everywhere else', () => {
  assert.equal(submitKey('MacIntel'), '⌘↵')
  assert.equal(submitKey('Win32'), 'Ctrl+Enter')
  assert.equal(submitKey('Linux x86_64'), 'Ctrl+Enter')
  assert.equal(submitKey(''), 'Ctrl+Enter')
})
