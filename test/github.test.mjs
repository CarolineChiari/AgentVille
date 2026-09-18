import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createIssueStore, createPrStore, githubRepoOf, ISSUE_FIELDS, ISSUE_LIMIT, normalizeIssue, normalizePr, parseGithubRemote } from '../server/github.mjs'
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

test('only open issues survive, typed', () => {
  assert.equal(normalizeIssue({ number: 1, state: 'CLOSED' }), null)
  assert.equal(normalizeIssue({ number: 0, state: 'OPEN' }), null)
  assert.equal(normalizeIssue({ number: '4x', state: 'OPEN' }), null)
  const i = normalizeIssue({
    number: 12, state: 'open', title: 'Crash on start', labels: [{ name: 'bug' }, {}], createdAt: '2026-03-01T00:00:00Z',
    updatedAt: '2026-03-02T00:00:00Z', author: { login: 'sam' }, url: 'javascript:alert(1)',
    assignees: [{ login: 'me' }, { login: '' }], milestone: { title: 'v1' },
  })
  assert.equal(i.url, '', 'only github.com links survive')
  assert.deepEqual(i.labels, ['bug'])
  assert.deepEqual(i.assignees, ['me'])
  assert.equal(i.milestone, 'v1')
  assert.equal(i.comments, 0)
  assert.equal(i.createdAt, Date.parse('2026-03-01T00:00:00Z'))
  assert.equal(normalizeIssue({ number: 1, state: 'OPEN', comments: [{}, {}] }).comments, 2)
  assert.equal(normalizeIssue({ number: 1, state: 'OPEN', comments: { totalCount: 5 } }).comments, 5)
  assert.equal(normalizeIssue({ number: 1, state: 'OPEN', title: 'x'.repeat(900) }).title.length, 300)
})

test('the issue store asks gh for open issues and keeps its own file', async (t) => {
  const { home, cleanup } = tmpHome()
  t.after(cleanup)
  const repo = path.join(home, 'app')
  fakeRepo(repo, 'https://github.com/me/app.git')
  const calls = []
  const gh = async (args) => {
    calls.push(args)
    return JSON.stringify([{ number: 3, state: 'OPEN', title: 'a' }, { number: 4, state: 'CLOSED', title: 'b' }])
  }
  const store = createIssueStore({ dataDir: home, gh })
  assert.ok(store.file.endsWith('issues.json'))
  const first = await store.get([{ name: 'app', path: repo }])
  assert.deepEqual(first.repos.app, { slug: 'me/app', issues: [] })
  await store.settle()
  assert.deepEqual(calls[0], ['issue', 'list', '--repo', 'me/app', '--state', 'open', '--limit', String(ISSUE_LIMIT), '--json', ISSUE_FIELDS])
  assert.deepEqual((await store.get([{ name: 'app', path: repo }])).repos.app.issues.map((i) => i.number), [3])
  const reopened = createIssueStore({ dataDir: home, gh: async () => { throw new Error('offline') } })
  assert.equal((await reopened.get([{ name: 'app', path: repo }])).repos.app.issues.length, 1, 'cache survives a restart')
  assert.ok(!fs.existsSync(path.join(home, 'prs.json')), 'issues never land in the PR cache')
})

test('PRs and issues take turns with gh rather than running it twice at once', async (t) => {
  const { home, cleanup } = tmpHome()
  t.after(cleanup)
  const repo = path.join(home, 'app')
  fakeRepo(repo, 'https://github.com/me/app.git')
  let running = 0
  let most = 0
  const log = []
  const gh = async (args) => {
    running++
    most = Math.max(most, running)
    log.push(args[0])
    await new Promise((r) => setTimeout(r, 10))
    running--
    return '[]'
  }
  const prs = createPrStore({ dataDir: home, gh })
  const issues = createIssueStore({ dataDir: home, gh })
  await Promise.all([prs.get([{ name: 'app', path: repo }]), issues.get([{ name: 'app', path: repo }])])
  await issues.settle()
  assert.deepEqual(log.sort(), ['issue', 'pr'])
  assert.equal(most, 1)
})

test('without gh the issue store stops trying too', async (t) => {
  const { home, cleanup } = tmpHome()
  t.after(cleanup)
  const repo = path.join(home, 'app')
  fakeRepo(repo, 'https://github.com/me/app.git')
  let calls = 0
  const gh = async () => {
    calls++
    throw Object.assign(new Error('gh is not installed'), { code: 'ENOENT' })
  }
  const store = createIssueStore({ dataDir: home, gh, ttlMs: 0 })
  await store.get([{ name: 'app', path: repo }])
  await store.settle()
  const r = await store.get([{ name: 'app', path: repo }])
  await store.settle()
  assert.equal(r.available, false)
  assert.equal(calls, 1)
})
