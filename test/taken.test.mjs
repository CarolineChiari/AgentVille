import test from 'node:test'
import assert from 'node:assert/strict'
import { mentionsIssue, pruneTaken, takenIssues } from '../src/game/taken.js'
import { issueTask } from '../src/game/tasks.js'

test('a prompt written by issueTask names its issue, and only that one', () => {
  const { prompt } = issueTask({ number: 12, title: 'Crash', url: '' })
  assert.ok(mentionsIssue(prompt, 12))
  assert.ok(!mentionsIssue(prompt, 1))
  assert.ok(!mentionsIssue(prompt, 123))
  assert.ok(!mentionsIssue('fix the login', 12))
  assert.ok(!mentionsIssue(undefined, 12))
})

const issues = [{ id: 'issue:me/app#1', number: 1 }, { id: 'issue:me/app#2', number: 2 }]

test('an issue is taken by a thread on its repo whose first prompt names it', () => {
  const threads = [
    { id: 'a', project: 'app', preview: 'Look at GitHub issue #2 "x"', createdAt: 1 },
    { id: 'b', project: 'other', preview: 'Look at GitHub issue #1 "x"', createdAt: 2 },
  ]
  assert.deepEqual([...takenIssues(issues, threads, {}, 'app')], [['issue:me/app#2', 'a']])
})

test('the newest thread that names an issue has it', () => {
  const threads = [
    { id: 'old', project: 'app', preview: 'issue #1', createdAt: 1 },
    { id: 'new', project: 'app', preview: 'issue #1', createdAt: 5 },
  ]
  assert.equal(takenIssues(issues, threads, {}, 'app').get('issue:me/app#1'), 'new')
})

test('a recorded thread counts while it lives', () => {
  const record = { 'issue:me/app#1': { threadId: 'a', at: 1 } }
  assert.equal(takenIssues(issues, [{ id: 'a', project: 'app', preview: '' }], record, 'app').get('issue:me/app#1'), 'a')
  assert.equal(takenIssues(issues, [], record, 'app').size, 0)
})

test('the record drops closed issues and archived threads', () => {
  const record = { x: { threadId: 'a', at: 1 }, y: { threadId: 'gone', at: 1 }, z: { threadId: 'a', at: 1 } }
  assert.deepEqual(pruneTaken(record, new Set(['x', 'y']), new Set(['a'])), { x: { threadId: 'a', at: 1 } })
  assert.deepEqual(pruneTaken(null, new Set(), new Set()), {})
})
