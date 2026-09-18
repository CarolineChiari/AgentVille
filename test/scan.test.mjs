import { test } from 'node:test'
import assert from 'node:assert/strict'
import { disambiguateProjects, scanAll } from '../server/scan.mjs'

const th = (project, projectPath) => ({ id: projectPath, project, projectPath })

test('basename collisions grow leftward only for the colliding repos', () => {
  const out = disambiguateProjects([th('foo', '/w/1/foo'), th('foo', '/w/2/foo'), th('bar', '/w/1/bar')])
  assert.deepEqual(out.map((t) => t.project), ['1/foo', '2/foo', 'bar'])
})

test('drive-letter case and trailing separators are not collisions', () => {
  const out = disambiguateProjects([th('app', 'c:\\code\\app'), th('app', 'C:\\code\\app\\')])
  assert.deepEqual(out.map((t) => t.project), ['app', 'app'])
})

test('a throwing adapter does not sink the scan', async () => {
  const good = { id: 'good', name: 'Good', detect: async () => true, scanThreads: async () => [{ id: 'good:1', lastActivityAt: 1 }] }
  const bad = { id: 'bad', name: 'Bad', detect: async () => true, scanThreads: async () => { throw new Error('boom') } }
  const { threads, warnings } = await scanAll({ harnesses: [bad, good] })
  assert.equal(threads.length, 1)
  assert.equal(threads[0].harness, 'good')
  assert.match(warnings[0], /Bad: boom/)
})
