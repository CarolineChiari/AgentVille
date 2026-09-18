import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TASKS, taskById } from '../src/game/tasks.js'

test('every task has a unique id, a label and a prompt', () => {
  assert.ok(TASKS.length >= 3)
  assert.equal(new Set(TASKS.map((t) => t.id)).size, TASKS.length)
  for (const t of TASKS) {
    assert.match(t.id, /^[a-z][a-z-]*$/)
    assert.ok(t.label && t.label.length <= 20, `${t.id}: a label short enough for a button`)
    // Well under PROMPT_MAX, so a task survives the trip through a VS Code link on the fallback path.
    assert.ok(t.prompt.length > 20 && t.prompt.length < 1800, t.id)
  }
})

test('taskById finds a task and returns null for anything else', () => {
  assert.equal(taskById('commit-push').label, 'Commit & push')
  assert.equal(taskById('nope'), null)
  assert.equal(taskById(undefined), null)
})
