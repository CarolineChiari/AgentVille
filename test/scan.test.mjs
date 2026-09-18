import { test } from 'node:test'
import assert from 'node:assert/strict'
import { disambiguateProjects, normalizePath, pathKey, scanAll } from '../server/scan.mjs'

const th = (project, projectPath) => ({ id: projectPath, project, projectPath })

test('basename collisions grow leftward only for the colliding repos', () => {
  const out = disambiguateProjects([th('foo', '/w/1/foo'), th('foo', '/w/2/foo'), th('bar', '/w/1/bar')])
  assert.deepEqual(out.map((t) => t.project), ['1/foo', '2/foo', 'bar'])
})

test('drive-letter case and trailing separators are not collisions', () => {
  const out = disambiguateProjects([th('app', 'c:\\code\\app'), th('app', 'C:\\code\\app\\')])
  assert.deepEqual(out.map((t) => t.project), ['app', 'app'])
})

test('one Windows folder spelled three ways is one plot with one path, not three full paths', () => {
  // Claude Code, a `file://` URI from Copilot, Cursor's fsPath.
  const out = disambiguateProjects([
    th('Intranet', 'C:\\Users\\me\\GitHub\\Intranet'),
    th('Intranet', 'C:/Users/me/GitHub/Intranet'),
    th('Intranet', 'c:\\Users\\me\\GitHub\\Intranet'),
  ])
  assert.deepEqual(out.map((t) => t.project), ['Intranet', 'Intranet', 'Intranet'])
  assert.deepEqual(new Set(out.map((t) => t.projectPath)), new Set(['C:\\Users\\me\\GitHub\\Intranet']))
})

test('Windows paths differing only in case are one folder, named as first met', () => {
  const out = disambiguateProjects([th('App', 'C:\\code\\App'), th('app', 'c:/Code/app/')])
  assert.deepEqual(out.map((t) => [t.project, t.projectPath]), [['App', 'C:\\code\\App'], ['App', 'C:\\code\\App']])
})

test('a name a harness chose itself survives the respelling', () => {
  const out = disambiguateProjects([th('app', 'C:\\code\\app'), th('Custom', 'C:/code/app')])
  assert.deepEqual(out.map((t) => [t.project, t.projectPath]), [['app', 'C:\\code\\app'], ['Custom', 'C:\\code\\app']])
})

test('POSIX paths keep their case, and two Windows folders that differ still disambiguate', () => {
  assert.deepEqual(disambiguateProjects([th('foo', '/w/A/foo'), th('foo', '/w/a/foo')]).map((t) => t.project), ['A/foo', 'a/foo'])
  const win = disambiguateProjects([th('app', 'C:\\one\\app'), th('app', 'D:/two/app')])
  assert.deepEqual(win.map((t) => t.project), ['one/app', 'two/app'])
})

test('normalizePath and pathKey', () => {
  assert.equal(normalizePath('c:/code//app/'), 'C:\\code\\app')
  assert.equal(normalizePath('c:/'), 'C:\\')
  assert.equal(normalizePath('\\\\server\\share\\app\\'), '\\\\server\\share\\app')
  assert.equal(normalizePath('/Users/me/app/'), '/Users/me/app')
  assert.equal(normalizePath('/'), '/')
  assert.equal(pathKey('C:\\Code\\App'), pathKey('c:/code/app'))
  assert.notEqual(pathKey('/w/App'), pathKey('/w/app'))
})

test('a throwing adapter does not sink the scan', async () => {
  const good = { id: 'good', name: 'Good', detect: async () => true, scanThreads: async () => [{ id: 'good:1', lastActivityAt: 1 }] }
  const bad = { id: 'bad', name: 'Bad', detect: async () => true, scanThreads: async () => { throw new Error('boom') } }
  const { threads, warnings } = await scanAll({ harnesses: [bad, good] })
  assert.equal(threads.length, 1)
  assert.equal(threads[0].harness, 'good')
  assert.match(warnings[0], /Bad: boom/)
})
