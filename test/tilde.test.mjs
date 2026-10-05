import test from 'node:test'
import assert from 'node:assert/strict'
import { tilde } from '../server/lib/tilde.mjs'

test('a path under home starts with ~', () => {
  assert.equal(tilde('/Users/me/.claude/projects', '/Users/me'), '~/.claude/projects')
  assert.equal(tilde('C:\\Users\\me\\.gemini', 'C:\\Users\\me'), '~\\.gemini')
  assert.equal(tilde('/Users/me', '/Users/me'), '~')
})

test('a sibling of home is left alone', () => {
  assert.equal(tilde('/Users/mere/x', '/Users/me'), '/Users/mere/x')
  assert.equal(tilde('/opt/x', '/Users/me'), '/opt/x')
  assert.equal(tilde('', '/Users/me'), '')
})
