import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CUSTOM_MAX, LABEL_MAX, PROMPT_MAX, TASKS, cleanTask, cleanTasks, customId, issueTask, taskById, tasksFor } from '../src/game/tasks.js'

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

test('taskById finds a built-in or a repo\'s own task, and returns null for anything else', () => {
  assert.equal(taskById('commit-push').label, 'Commit & push')
  const mine = [{ id: 'c-deploy', label: 'Deploy', prompt: 'Deploy to staging.' }]
  assert.equal(taskById('c-deploy', mine).prompt, 'Deploy to staging.')
  assert.equal(taskById('c-deploy'), null, 'another repo does not have it')
  assert.equal(taskById('nope', mine), null)
  assert.equal(taskById(undefined), null)
})

test('a repo offers the built-in tasks first, then its own', () => {
  const mine = [{ id: 'c-deploy', label: 'Deploy', prompt: 'Deploy.' }]
  assert.deepEqual(tasksFor(mine).map((t) => t.id), [...TASKS.map((t) => t.id), 'c-deploy'])
  assert.equal(tasksFor(undefined).length, TASKS.length)
})

test('a saved task is trimmed and bounded, and junk from a hand-edited file is dropped', () => {
  assert.deepEqual(cleanTask({ id: 'c-x', label: '  X  ', prompt: ' do it ', extra: 1 }), { id: 'c-x', label: 'X', prompt: 'do it' })
  assert.equal(cleanTask({ id: 'c-x', label: 'y'.repeat(99), prompt: 'p' }).label.length, LABEL_MAX)
  for (const bad of [null, 'x', { id: 'commit-push', label: 'L', prompt: 'p' }, { id: 'c-X!', label: 'L', prompt: 'p' },
    { id: 'c-x', label: '  ', prompt: 'p' }, { id: 'c-x', label: 'L', prompt: 5 }, { id: ['c-x'], label: 'L', prompt: 'p' }]) {
    assert.equal(cleanTask(bad), null, JSON.stringify(bad))
  }
  const many = Array.from({ length: CUSTOM_MAX + 5 }, (_, i) => ({ id: `c-t${i}`, label: 'L', prompt: 'p' }))
  assert.equal(cleanTasks(many).length, CUSTOM_MAX)
  assert.equal(cleanTasks([{ id: 'c-a', label: 'A', prompt: 'p' }, { id: 'c-a', label: 'B', prompt: 'q' }]).length, 1, 'duplicate ids')
  assert.deepEqual(cleanTasks('nope'), [])
})

test('a new task gets an id from its name, unique in its repo and never a built-in one', () => {
  assert.equal(customId('Deploy to staging!'), 'c-deploy-to-staging')
  assert.equal(customId('Deploy', ['c-deploy', 'c-deploy-2']), 'c-deploy-3')
  assert.equal(customId('✨✨'), 'c-task')
  assert.ok(cleanTask({ id: customId('x'.repeat(200)), label: 'L', prompt: 'p' }), 'a long name still makes a valid id')
})

test('an issue becomes a task that names it, links it and says where to stop', () => {
  const t = issueTask({ number: 12, title: 'Crash\non   start', url: 'https://github.com/me/app/issues/12' })
  assert.equal(t.label, 'Issue #12')
  assert.ok(t.label.length <= LABEL_MAX)
  assert.match(t.prompt, /#12 "Crash on start" \(https:\/\/github\.com\/me\/app\/issues\/12\)/)
  assert.match(t.prompt, /stop and tell me/)
  assert.ok(!issueTask({ number: 3, title: 'x', url: '' }).prompt.includes('()'), 'no empty link without a url')
  assert.ok(issueTask({ number: 3, title: 'x'.repeat(300), url: 'https://github.com/a/b/issues/3' }).prompt.length <= PROMPT_MAX)
  assert.equal(issueTask({ number: 3, title: 'y'.repeat(300) }).prompt.includes('y'.repeat(201)), false, 'long titles are clipped')
})
