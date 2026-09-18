import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createPrStore, githubRepoOf, normalizePr, parseGithubRemote } from '../server/github.mjs'
import { tmpHome } from './helpers/fixtures.mjs'

test('GitHub remotes in every common form', () => {
  assert.equal(parseGithubRemote('https://github.com/Owner/repo.git'), 'Owner/repo')
  assert.equal(parseGithubRemote('https://github.com/Owner/repo'), 'Owner/repo')
  assert.equal(parseGithubRemote('https://token@github.com/Owner/my.repo.git'), 'Owner/my.repo')
  assert.equal(parseGithubRemote('git@github.com:Owner/repo.git'), 'Owner/repo')
  assert.equal(parseGithubRemote('ssh://git@github.com/Owner/repo.git'), 'Owner/repo')
  assert.equal(parseGithubRemote('https://gitlab.com/Owner/repo.git'), null)
  assert.equal(parseGithubRemote('https://github.com/Owner/repo;rm -rf'), null)
})

function fakeRepo(root, url) {
  fs.mkdirSync(path.join(root, '.git'), { recursive: true })
  fs.writeFileSync(path.join(root, '.git', 'config'), `[core]\n\tbare = false\n[remote "origin"]\n\turl = ${url}\n\tfetch = +refs/heads/*:refs/remotes/origin/*\n`)
}

test('the repo is read from .git/config, following a worktree back to it', async (t) => {
  const { home, cleanup } = tmpHome()
  t.after(cleanup)
  const repo = path.join(home, 'app')
  fakeRepo(repo, 'git@github.com:me/app.git')
  assert.equal(await githubRepoOf(repo), 'me/app')
  const wtGit = path.join(repo, '.git', 'worktrees', 'w1')
  fs.mkdirSync(wtGit, { recursive: true })
  fs.writeFileSync(path.join(wtGit, 'commondir'), '../..\n')
  const wt = path.join(home, 'wt')
  fs.mkdirSync(wt)
  fs.writeFileSync(path.join(wt, '.git'), `gitdir: ${wtGit}\n`)
  assert.equal(await githubRepoOf(wt), 'me/app')
  assert.equal(await githubRepoOf(path.join(home, 'nothing')), null)
  assert.equal(await githubRepoOf('relative'), null)
})

test('closed-unmerged PRs are dropped and fields are typed', () => {
  assert.equal(normalizePr({ number: 1, state: 'CLOSED' }), null)
  assert.equal(normalizePr({ number: 'x', state: 'OPEN' }), null)
  const p = normalizePr({
    number: 7, state: 'MERGED', title: 'Fix it', labels: [{ name: 'bug' }], mergedAt: '2026-01-02T00:00:00Z',
    author: { login: 'me' }, url: 'javascript:alert(1)', additions: 3, deletions: '2',
  })
  assert.equal(p.url, '', 'only github.com links survive')
  assert.deepEqual(p.labels, ['bug'])
  assert.equal(p.deletions, 2)
  assert.equal(p.mergedAt, Date.parse('2026-01-02T00:00:00Z'))
})

test('the store answers from cache at once, refreshes stale repos in the background, and persists', async (t) => {
  const { home, cleanup } = tmpHome()
  t.after(cleanup)
  const repo = path.join(home, 'app')
  fakeRepo(repo, 'https://github.com/me/app.git')
  let clock = 1000
  const calls = []
  const gh = async (args) => {
    calls.push(args)
    return JSON.stringify([
      { number: 1, state: 'MERGED', title: 'a', labels: [], mergedAt: '2026-01-01T00:00:00Z' },
      { number: 2, state: 'OPEN', title: 'b', labels: [], createdAt: '2026-01-03T00:00:00Z' },
      { number: 3, state: 'CLOSED', title: 'c', labels: [] },
    ])
  }
  const store = createPrStore({ dataDir: home, gh, now: () => clock, ttlMs: 100 })
  const first = await store.get([{ name: 'app', path: repo }])
  assert.deepEqual(first.repos.app.prs, [], 'nothing cached yet')
  assert.equal(first.updating, true)
  await store.settle()
  assert.deepEqual(calls[0].slice(0, 6), ['pr', 'list', '--repo', 'me/app', '--state', 'all'])
  const second = await store.get([{ name: 'app', path: repo }])
  assert.deepEqual(second.repos.app.prs.map((p) => p.number), [1, 2])
  assert.equal(calls.length, 1, 'fresh cache is not refetched')
  clock += 500
  await store.get([{ name: 'app', path: repo }])
  await store.settle()
  assert.equal(calls.length, 2, 'stale cache is')
  const reopened = createPrStore({ dataDir: home, gh: async () => { throw new Error('offline') }, now: () => clock })
  assert.equal((await reopened.get([{ name: 'app', path: repo }])).repos.app.prs.length, 2, 'cache survives a restart')
})

test('without gh installed the store says so and stops trying', async (t) => {
  const { home, cleanup } = tmpHome()
  t.after(cleanup)
  const repo = path.join(home, 'app')
  fakeRepo(repo, 'https://github.com/me/app.git')
  let calls = 0
  const gh = async () => {
    calls++
    throw Object.assign(new Error('gh is not installed'), { code: 'ENOENT' })
  }
  const store = createPrStore({ dataDir: home, gh, ttlMs: 0 })
  await store.get([{ name: 'app', path: repo }])
  await store.settle()
  const r = await store.get([{ name: 'app', path: repo }])
  await store.settle()
  assert.equal(r.available, false)
  assert.equal(calls, 1)
})
