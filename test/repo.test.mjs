import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { countLines, countRepo, createRepoStore } from '../server/repo.mjs'
import { tmpHome } from './helpers/fixtures.mjs'

/** A repo on disk: `files` maps a path under it to its contents. */
function repo(files) {
  const { home, cleanup } = tmpHome()
  const dir = path.join(home, 'repo')
  for (const [rel, body] of Object.entries(files)) {
    const p = path.join(dir, ...rel.split('/'))
    fs.mkdirSync(path.dirname(p), { recursive: true })
    fs.writeFileSync(p, body)
  }
  fs.mkdirSync(dir, { recursive: true })
  return { dir, home, cleanup }
}
const lines = (n) => 'x\n'.repeat(n)

test('a line is a newline, and a last line without one still counts', () => {
  assert.equal(countLines(Buffer.from('')), 0)
  assert.equal(countLines(Buffer.from('a')), 1)
  assert.equal(countLines(Buffer.from('a\nb\n')), 2)
  assert.equal(countLines(Buffer.from('a\nb')), 2)
  assert.equal(countLines(Buffer.from('\n\n\n')), 3)
})

test('the count reads the code and leaves out what the repo ignores, other tools\' stores, lock files and binaries', async (t) => {
  const { dir, cleanup } = repo({
    '.gitignore': 'dist/\n*.log\n',
    'src/a.js': lines(10),
    'src/b.js': lines(5),
    'README.md': 'one\ntwo',
    'dist/bundle.js': lines(1000),
    'debug.log': lines(1000),
    'node_modules/x/index.js': lines(1000),
    '.git/config': lines(1000),
    '.claude/worktrees/copy/src/a.js': lines(1000),
    'package-lock.json': lines(1000),
    'app.min.js': lines(1000),
    'logo.png': Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0x0a, 0x0a]),
    'web/.gitignore': 'generated/\n',
    'web/generated/api.ts': lines(1000),
    'web/page.ts': lines(3),
  })
  t.after(cleanup)
  const c = await countRepo(dir)
  // The top .gitignore is two lines and the nested one one: they are the repo's files too.
  assert.equal(c.lines, 10 + 5 + 2 + 3 + 2 + 1)
  assert.equal(c.files, 6)
  assert.equal(c.skipped, 1, 'the binary')
  assert.equal(c.truncated, false)
})

test('a file too big to be hand-written is skipped, not read', async (t) => {
  const { dir, cleanup } = repo({ 'a.js': lines(4), 'fixture.json': lines(10) })
  t.after(cleanup)
  const c = await countRepo(dir, { limits: { files: 100, ms: 1e9, fileBytes: 12, sniff: 8000 } })
  assert.deepEqual(c, { lines: 4, files: 1, skipped: 1, truncated: false })
})

test('a link is never followed, even one that points back up the tree', async (t) => {
  const { dir, home, cleanup } = repo({ 'a.js': lines(2) })
  t.after(cleanup)
  fs.writeFileSync(path.join(home, 'outside.js'), lines(500))
  try {
    fs.symlinkSync(path.join(home, 'outside.js'), path.join(dir, 'link.js'))
    fs.symlinkSync(dir, path.join(dir, 'loop'))
  } catch {
    return t.skip('this machine cannot make symlinks')
  }
  assert.equal((await countRepo(dir)).lines, 2)
})

test('a huge tree is cut short and says so', async (t) => {
  const files = {}
  for (let i = 0; i < 30; i++) files[`f${String(i).padStart(2, '0')}.txt`] = lines(1)
  const { dir, cleanup } = repo(files)
  t.after(cleanup)
  const c = await countRepo(dir, { limits: { files: 10, ms: 1e9, fileBytes: 1e6, sniff: 8000 } })
  assert.equal(c.truncated, true)
  assert.ok(c.files >= 10 && c.files < 30, `${c.files} files`)
  let clock = 0
  // Every look at the clock is a second later: the walk is out of time before it is through.
  const slow = await countRepo(dir, { now: () => (clock += 1000), limits: { files: 1e6, ms: 2500, fileBytes: 1e6, sniff: 8000 } })
  assert.equal(slow.truncated, true)
})

test('a folder that has gone counts as empty rather than failing', async () => {
  assert.deepEqual(await countRepo(path.join('/', 'no', 'such', 'agentville', 'repo')), { lines: 0, files: 0, skipped: 0, truncated: false })
})

test('the store counts in the background, answers from its cache, and keeps its counts across a restart', async (t) => {
  const { home, cleanup } = tmpHome()
  t.after(cleanup)
  let clock = 1000
  const counted = []
  const count = async (dir) => (counted.push(dir), { lines: 42, files: 3, skipped: 0, truncated: false })
  const store = createRepoStore({ dataDir: home, ttlMs: 500, count, now: () => clock })
  const projects = [{ name: 'app', path: path.join(home, 'app') }, { name: 'bad', path: 'relative/path' }]
  const first = await store.get(projects)
  assert.deepEqual(first.repos, {}, 'nothing counted yet')
  assert.equal(first.updating, true)
  await store.settle()
  const second = await store.get(projects)
  assert.deepEqual(second.repos, { app: { lines: 42, files: 3, skipped: 0, truncated: false, countedAt: 1000 } })
  assert.deepEqual(counted, [path.join(home, 'app')], 'a relative path is never walked')
  assert.equal(second.updating, false, 'fresh: not counted again')
  clock += 1000
  await store.get(projects)
  await store.settle()
  assert.equal(counted.length, 2, 'stale: counted again')
  const again = createRepoStore({ dataDir: home, ttlMs: 1e9, count, now: () => clock })
  assert.equal((await again.get(projects)).repos.app.lines, 42)
  assert.ok(fs.existsSync(path.join(home, 'repos.json')))
})

test('a count that fails keeps the last good one and waits a full TTL before trying again', async (t) => {
  const { home, cleanup } = tmpHome()
  t.after(cleanup)
  let clock = 0
  let fail = false
  let calls = 0
  const count = async () => {
    calls++
    if (fail) throw new Error('disk on fire')
    return { lines: 7, files: 1, skipped: 0, truncated: false }
  }
  const store = createRepoStore({ dataDir: home, ttlMs: 100, count, now: () => clock })
  const projects = [{ name: 'app', path: path.join(home, 'app') }]
  await store.get(projects)
  await store.settle()
  fail = true
  clock = 200
  await store.get(projects)
  await store.settle()
  assert.equal((await store.get(projects)).repos.app.lines, 7)
  assert.equal(calls, 2)
})
