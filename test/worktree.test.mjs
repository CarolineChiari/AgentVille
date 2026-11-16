import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { isBare, mainCheckoutOf, resolveWorktrees } from '../server/worktree.mjs'
import { tmpHome, worktreeFixture as fixture } from './helpers/fixtures.mjs'

test('a linked worktree leads back to its main checkout, wherever it was put', async (t) => {
  const { home, cleanup } = tmpHome()
  t.after(cleanup)
  const repo = fixture(home)
  assert.equal(await mainCheckoutOf(path.join(home, 'app-feat')), repo)
  assert.equal(await mainCheckoutOf(path.join(home, 'app-fix')), repo)
  assert.equal(await mainCheckoutOf(repo), null, 'the main checkout is not a worktree of itself')
})

test('a submodule, a bare repo\'s worktree, a stale pointer and nonsense stay where they are', async (t) => {
  const { home, cleanup } = tmpHome()
  t.after(cleanup)
  // A submodule's .git file points into the parent's modules dir, which has no commondir.
  const mod = path.join(home, 'parent', '.git', 'modules', 'lib')
  fs.mkdirSync(mod, { recursive: true })
  const sub = path.join(home, 'parent', 'lib')
  fs.mkdirSync(sub)
  fs.writeFileSync(path.join(sub, '.git'), `gitdir: ${mod}\n`)
  assert.equal(await mainCheckoutOf(sub), null)
  // A bare repository has no checkout to stand on.
  const bare = path.join(home, 'app.git')
  fs.mkdirSync(path.join(bare, 'worktrees', 'w'), { recursive: true })
  fs.writeFileSync(path.join(bare, 'worktrees', 'w', 'commondir'), '../..\n')
  const w = path.join(home, 'w')
  fs.mkdirSync(w)
  fs.writeFileSync(path.join(w, '.git'), `gitdir: ${path.join(bare, 'worktrees', 'w')}\n`)
  assert.equal(await mainCheckoutOf(w), null)
  // A bare repository kept in a folder named `.git`: its parent is no checkout.
  const dotBare = path.join(home, 'store', '.git')
  fs.mkdirSync(path.join(dotBare, 'worktrees', 'v'), { recursive: true })
  fs.writeFileSync(path.join(dotBare, 'config'), '[core]\n\trepositoryformatversion = 0\n\tbare = true\n')
  fs.writeFileSync(path.join(dotBare, 'worktrees', 'v', 'commondir'), '../..\n')
  const v = path.join(home, 'v')
  fs.mkdirSync(v)
  fs.writeFileSync(path.join(v, '.git'), `gitdir: ${path.join(dotBare, 'worktrees', 'v')}\n`)
  assert.equal(await mainCheckoutOf(v), null)
  // A worktree whose repo is gone.
  const stale = path.join(home, 'stale')
  fs.mkdirSync(stale)
  fs.writeFileSync(path.join(stale, '.git'), `gitdir: ${path.join(home, 'gone', '.git', 'worktrees', 'stale')}\n`)
  assert.equal(await mainCheckoutOf(stale), null)
  const junk = path.join(home, 'junk')
  fs.mkdirSync(junk)
  fs.writeFileSync(path.join(junk, '.git'), 'not a pointer\n')
  assert.equal(await mainCheckoutOf(junk), null)
  assert.equal(await mainCheckoutOf(path.join(home, 'nothing')), null)
  assert.equal(await mainCheckoutOf('relative/app'), null)
  assert.equal(await mainCheckoutOf(42), null)
})

test('threads in a worktree take their repo\'s plot and keep their own folder', async (t) => {
  const { home, cleanup } = tmpHome()
  t.after(cleanup)
  const repo = fixture(home)
  const feat = path.join(home, 'app-feat')
  const out = await resolveWorktrees([
    { id: 'a', project: 'app-feat', projectPath: feat, worktree: '', cwd: feat },
    { id: 'b', project: 'Feature', projectPath: feat, worktree: '', cwd: path.join(feat, 'src') },
    { id: 'c', project: 'app', projectPath: repo, worktree: '', cwd: repo },
    { id: 'd', project: '', projectPath: '' },
  ])
  assert.deepEqual(out[0], { id: 'a', project: 'app', projectPath: repo, worktree: 'app-feat', cwd: feat })
  assert.deepEqual(out[1], { id: 'b', project: 'Feature', projectPath: repo, worktree: 'app-feat', cwd: path.join(feat, 'src') }, 'a name the harness chose is kept')
  assert.deepEqual(out[2], { id: 'c', project: 'app', projectPath: repo, worktree: '', cwd: repo })
  assert.deepEqual(out[3], { id: 'd', project: '', projectPath: '' })
})

test('a config is bare only when its core section says so', () => {
  assert.equal(isBare('[core]\n\tbare = true\n'), true)
  assert.equal(isBare('[Core]\n  Bare=TRUE\n'), true)
  assert.equal(isBare('[core]\n\tbare = false\n'), false)
  assert.equal(isBare('[core]\n\tfilemode = true\n[other]\n\tbare = true\n'), false)
  assert.equal(isBare('[core]\n\tbare\n'), true)
  assert.equal(isBare('[core]\n\tbare = yes ; set by clone\n'), true)
  assert.equal(isBare('[core]\n\tbareish = true\n'), false)
  assert.equal(isBare(''), false)
  assert.equal(isBare(undefined), false)
})
