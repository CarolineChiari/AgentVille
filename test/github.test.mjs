import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createIssueStore, createPrStore, createReleaseStore, githubRepoOf, ISSUE_FIELDS, ISSUE_LIMIT, normalizeIssue, normalizePr, parseGithubRemote, summarizeChecks } from '../server/github.mjs'
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

test('checks are boiled down to one word and a failing count', () => {
  const run = (status, conclusion) => ({ __typename: 'CheckRun', status, conclusion })
  assert.deepEqual(summarizeChecks(undefined), { checks: '', failing: 0 })
  assert.deepEqual(summarizeChecks([]), { checks: '', failing: 0 })
  assert.deepEqual(summarizeChecks([run('COMPLETED', 'SUCCESS'), { state: 'SUCCESS' }, run('COMPLETED', 'SKIPPED')]), { checks: 'pass', failing: 0 })
  assert.deepEqual(summarizeChecks([run('COMPLETED', 'SUCCESS'), run('IN_PROGRESS', '')]), { checks: 'pending', failing: 0 })
  assert.deepEqual(summarizeChecks([run('COMPLETED', 'FAILURE'), run('IN_PROGRESS', ''), { state: 'ERROR' }]), { checks: 'fail', failing: 2 })
  const p = normalizePr({ number: 1, state: 'OPEN', statusCheckRollup: [run('COMPLETED', 'FAILURE')], reviewDecision: 'CHANGES_REQUESTED' })
  assert.equal(p.checks, 'fail')
  assert.equal(p.reviewDecision, 'CHANGES_REQUESTED')
  assert.equal(normalizePr({ number: 2, state: 'OPEN', reviewDecision: 'bogus' }).reviewDecision, '')
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

test('the release check asks once a day, remembers the answer, and only reports a newer one', async (t) => {
  const { home, cleanup } = tmpHome()
  t.after(cleanup)
  let clock = 1000
  const calls = []
  const gh = async (args) => {
    calls.push(args)
    return JSON.stringify({ tagName: 'v0.40.0', url: 'https://github.com/me/app/releases/tag/v0.40.0' })
  }
  const opts = { dataDir: home, repo: 'me/app', gh, now: () => clock, version: () => '0.39.0' }
  const store = createReleaseStore(opts)
  const first = await store.get()
  assert.equal(first.newer, false, 'nothing is claimed before the first answer is in')
  await store.settle()
  assert.deepEqual(calls[0], ['release', 'view', '--repo', 'me/app', '--json', 'tagName,url'])
  const known = await store.get()
  assert.equal(known.latest, '0.40.0')
  assert.equal(known.current, '0.39.0')
  assert.equal(known.newer, true)
  assert.equal(known.url, 'https://github.com/me/app/releases/tag/v0.40.0')
  clock += 60 * 60 * 1000 // an hour later: still the same day's answer
  await store.get()
  await store.settle()
  assert.equal(calls.length, 1)
  clock += 24 * 60 * 60 * 1000
  await store.get()
  await store.settle()
  assert.equal(calls.length, 2, 'a day on, it asks again')
  const restarted = createReleaseStore({ ...opts, gh: async () => { throw new Error('offline') } })
  const offline = await restarted.get()
  assert.equal(offline.latest, '0.40.0', 'the answer survives a restart')
  assert.equal((await createReleaseStore({ ...opts, version: () => '0.40.0' }).get()).newer, false, 'the current version is not news')
})

test('a release nobody can read leaves the notice off, and a missing gh stops the asking', async (t) => {
  const { home, cleanup } = tmpHome()
  t.after(cleanup)
  const opts = { dataDir: home, repo: 'me/app', version: () => '0.39.0' }
  const junk = createReleaseStore({ ...opts, gh: async () => JSON.stringify({ tagName: 'nightly', url: 'javascript:alert(1)' }) })
  await junk.get()
  await junk.settle()
  const r = await junk.get()
  assert.equal(r.latest, '')
  assert.equal(r.newer, false)
  assert.equal(r.url, 'https://github.com/me/app/releases/latest', 'a link that is not this repo\'s release page is dropped')

  const { home: home2, cleanup: cleanup2 } = tmpHome()
  t.after(cleanup2)
  let calls = 0
  const none = createReleaseStore({
    ...opts, dataDir: home2, ttlMs: 0,
    gh: async () => { calls++; throw Object.assign(new Error('gh is not installed'), { code: 'ENOENT' }) },
  })
  await none.get()
  await none.settle()
  const after = await none.get()
  await none.settle()
  assert.equal(after.available, false)
  assert.equal(calls, 1)
})

test('the issue store says who gh is signed in as, asked once, and ignores anything that is not a login', async (t) => {
  const { home, cleanup } = tmpHome()
  t.after(cleanup)
  const repo = path.join(home, 'app')
  fakeRepo(repo, 'https://github.com/me/app.git')
  const calls = []
  const gh = async (args) => {
    calls.push(args)
    return args[0] === 'api' ? 'octo-cat\n' : JSON.stringify([{ number: 1, state: 'OPEN', title: 'a' }])
  }
  const store = createIssueStore({ dataDir: home, gh })
  await store.get([{ name: 'app', path: repo }])
  await store.settle()
  const first = await store.get([{ name: 'app', path: repo }])
  assert.equal(first.viewer, '')
  assert.equal(first.updating, true, 'the page is told to look again')
  await store.settle()
  assert.equal((await store.get([{ name: 'app', path: repo }])).viewer, 'octo-cat')
  await store.get([{ name: 'app', path: repo }])
  assert.equal(calls.filter((a) => a[0] === 'api').length, 1)
  assert.deepEqual(calls.find((a) => a[0] === 'api'), ['api', 'user', '--jq', '.login'])

  const odd = createIssueStore({ dataDir: home + '/2', gh: async (a) => (a[0] === 'api' ? '{"x":1}; rm -rf' : JSON.stringify([{ number: 1, state: 'OPEN', title: 'a' }])) })
  for (let i = 0; i < 2; i++) {
    await odd.get([{ name: 'app', path: repo }])
    await odd.settle()
  }
  assert.equal((await odd.get([{ name: 'app', path: repo }])).viewer, '')
})

test('a failed viewer lookup waits out the TTL instead of being asked on every poll', async (t) => {
  const { home, cleanup } = tmpHome()
  t.after(cleanup)
  const repo = path.join(home, 'app')
  fakeRepo(repo, 'https://github.com/me/app.git')
  let clock = 1000
  let asked = 0
  const gh = async (args) => {
    if (args[0] !== 'api') return JSON.stringify([{ number: 1, state: 'OPEN', title: 'a' }])
    asked++
    throw new Error('not logged in')
  }
  const store = createIssueStore({ dataDir: home, gh, now: () => clock, ttlMs: 60_000 })
  const look = async () => {
    const out = await store.get([{ name: 'app', path: repo }])
    await store.settle()
    return out
  }
  await look() // fetches the issues
  await look() // asks who you are, and fails
  const after = await look()
  assert.equal(asked, 1)
  assert.equal(after.updating, false, 'nothing left to wait for')
  clock += 61_000
  await look()
  assert.equal(asked, 2, 'asked again once the TTL has passed')
})
