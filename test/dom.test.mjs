import { test } from 'node:test'
import assert from 'node:assert/strict'
import { openLabel, submitKey } from '../src/ui/dom.js'

test('the submit shortcut is ⌘↵ on a Mac and Ctrl+Enter everywhere else', () => {
  assert.equal(submitKey('MacIntel'), '⌘↵')
  assert.equal(submitKey('Win32'), 'Ctrl+Enter')
  assert.equal(submitKey('Linux x86_64'), 'Ctrl+Enter')
  assert.equal(submitKey(''), 'Ctrl+Enter')
})

test('only Claude\'s threads follow the Open-in setting to VS Code', () => {
  assert.equal(openLabel({ harness: 'claude-code' }, 'vscode'), 'Open in VS Code')
  assert.equal(openLabel({ harness: 'antigravity' }, 'vscode'), 'Open')
  assert.equal(openLabel({ harness: 'antigravity', opensIn: 'Antigravity' }, 'vscode'), 'Open in Antigravity')
})
