import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isIgnored, parseIgnore } from '../server/ignore.mjs'

const top = (text) => [{ base: '', rules: parseIgnore(text) }]
const ig = (text, rel, dir = false) => isIgnored(top(text), rel, dir)

test('a name with no slash matches at any depth; comments and blank lines are nothing', () => {
  const t = '# build output\n\ndist\n*.log\n'
  assert.ok(ig(t, 'dist', true))
  assert.ok(ig(t, 'packages/web/dist', true))
  assert.ok(ig(t, 'a/b/server.log'))
  assert.ok(!ig(t, 'distance.js'))
  assert.ok(!ig(t, '# build output'))
})

test('a leading or inner slash anchors a pattern where its .gitignore is', () => {
  assert.ok(ig('/build', 'build', true))
  assert.ok(!ig('/build', 'src/build', true))
  assert.ok(ig('docs/out', 'docs/out', true))
  assert.ok(!ig('docs/out', 'site/docs/out', true))
})

test('a trailing slash matches folders only', () => {
  assert.ok(ig('cache/', 'cache', true))
  assert.ok(!ig('cache/', 'cache', false))
})

test('a later ! takes a file back', () => {
  const t = '*.json\n!package.json\n'
  assert.ok(ig(t, 'data/x.json'))
  assert.ok(!ig(t, 'package.json'))
  assert.ok(!ig(t, 'apps/a/package.json'))
})

test('* and ? stay within a folder; ** crosses them', () => {
  assert.ok(ig('src/*.gen.ts', 'src/a.gen.ts'))
  assert.ok(!ig('src/*.gen.ts', 'src/x/a.gen.ts'))
  assert.ok(ig('file?.txt', 'file1.txt') && !ig('file?.txt', 'file10.txt'))
  assert.ok(ig('**/fixtures', 'fixtures', true) && ig('**/fixtures', 'a/b/fixtures', true))
  assert.ok(ig('logs/**', 'logs/a/b.txt') && !ig('logs/**', 'logs', true))
  assert.ok(ig('a/**/z', 'a/z', true) && ig('a/**/z', 'a/b/c/z', true))
  assert.ok(ig('[Bb]uild', 'Build', true) && ig('*.[!o]', 'x.c') && !ig('*.[!o]', 'x.o'))
})

test('special characters are taken literally, and a bad pattern ignores nothing', () => {
  assert.ok(ig('a+b(1).txt', 'a+b(1).txt'))
  assert.ok(!ig('a+b(1).txt', 'aab1.txt'))
  assert.ok(ig('\\#notes', '#notes'))
  assert.ok(ig('\\!important', '!important'))
  assert.doesNotThrow(() => parseIgnore('[z-a]\n'))
})

test('a nested .gitignore speaks only for its own folder, after the ones above it', () => {
  const sets = [{ base: '', rules: parseIgnore('*.tmp\n') }, { base: 'web', rules: parseIgnore('/out\n!keep.tmp\n') }]
  assert.ok(isIgnored(sets, 'web/out', true))
  assert.ok(!isIgnored(sets, 'out', true), 'its anchor is its own folder')
  assert.ok(isIgnored(sets, 'a.tmp', false))
  assert.ok(!isIgnored(sets, 'web/keep.tmp', false), 'the deeper rule wins')
  assert.ok(isIgnored(sets, 'webby/keep.tmp', false), 'a folder whose name only starts the same is not its own')
})
