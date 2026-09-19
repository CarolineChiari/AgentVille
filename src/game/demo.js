// ?demo=1: a made-up village, so the renderer can be worked on without a server or sessions.
const REPOS = ['orchard', 'lighthouse', 'bakery-api', 'tidepool', 'windvane', 'quill']
const TITLES = [
  'Fix the flaky login test', 'Add dark mode', 'Refactor the scheduler', 'Write the migration',
  'Investigate memory leak', 'Upgrade to Node 22', 'Tidy up the README', 'Port the parser',
  'Add CSV export', 'Make the map sticky', 'Profile the render loop', 'Review open PRs',
]

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR
/**
 * How long ago each roll of demo thread last did anything, so the village shows every grade of
 * wear. Rolls 0–2 are running; 9 and 10 are asleep, and spread from days to seasons by `n`.
 */
const IDLE = [0, 10 * MIN, 20 * MIN, 25 * MIN, 3 * HOUR, 30 * HOUR, 40 * MIN, 8 * HOUR, 2 * DAY]
const ASLEEP = [5 * DAY, 20 * DAY, 90 * DAY, 10 * DAY, 45 * DAY, 150 * DAY]

export function demoThreads(now = Date.now()) {
  const out = []
  let n = 0
  REPOS.forEach((repo, r) => {
    const count = [9, 5, 3, 7, 2, 1][r]
    for (let i = 0; i < count; i++) {
      n++
      const roll = (n * 37) % 11
      out.push({
        id: `demo:${n}`,
        harness: 'demo',
        harnessName: 'Demo',
        title: TITLES[n % TITLES.length],
        preview: TITLES[n % TITLES.length],
        project: repo,
        projectPath: `/demo/${repo}`,
        worktree: '',
        cwd: `/demo/${repo}`,
        gitBranch: roll % 2 ? 'main' : `feature/${n}`,
        model: 'claude-opus-5',
        effort: '',
        createdAt: now - n * 3_600_000,
        lastActivityAt: now - (roll >= 9 ? ASLEEP[(n + roll) % ASLEEP.length] : IDLE[roll]),
        lastFocusedAt: 0,
        running: roll < 3,
        unread: roll === 3 || roll === 4,
        // Roll 4 is stopped on you, so the demo shows the `?` it is all for.
        needsInput: roll === 4 ? (n % 2 ? 'question' : 'permission prompt') : '',
        hasError: roll === 5,
        prState: roll === 6 ? 'MERGED' : '',
        archived: false,
        sizeBytes: 5_000 * (n * 13) ** 1.3,
        canOpen: false,
        ref: {},
      })
    }
  })
  // Finished work, so the gardens have something in them.
  const DONE = [
    'Fix login redirect bug', 'Add CSV export', 'Refactor the auth module', 'Update the README',
    'Speed up the render loop', 'Review PR 42', 'Write unit tests for the parser', 'Dark mode styling',
    'Deploy pipeline for staging', 'Database schema for invoices', 'Why is the build slow?', 'Tidy up',
  ]
  REPOS.forEach((repo, r) => {
    const count = [40, 16, 9, 120, 5, 0][r]
    for (let i = 0; i < count; i++) {
      n++
      out.push({
        id: `demo:${n}`, harness: 'demo', harnessName: 'Demo', title: DONE[(n * 7) % DONE.length], preview: '',
        project: repo, projectPath: `/demo/${repo}`, worktree: '', cwd: `/demo/${repo}`, gitBranch: 'main',
        model: 'claude-opus-5', effort: '', createdAt: now - (400 - i) * 86_400_000, lastActivityAt: now - (300 - i) * 86_400_000,
        lastFocusedAt: 0, running: false, unread: false, hasError: false, prState: '', archived: true,
        sizeBytes: 20_000 * (i + 1), canOpen: false, ref: {},
      })
    }
  })
  return out
}

const ISSUES = [
  ['Crash when the map is empty', ['bug']], ['Add keyboard shortcuts to the card', ['enhancement']],
  ['Docs: explain the garden', ['docs']], ['Slow first load on big repos', ['performance']],
  ['Villagers overlap at the door', ['bug', 'good first issue']], ['Support GitLab remotes', []],
  ['Night mode is too dark', ['design']],
]

/** Open issues for a few demo repos, shaped like /api/issues. No urls: there is nothing to open. */
export function demoIssues(now = Date.now()) {
  const repo = (name, count, offset) => ({
    slug: `demo/${name}`,
    issues: ISSUES.slice(offset, offset + count).map(([title, labels], i) => ({
      number: 40 + offset + i, title, labels, state: 'OPEN', createdAt: now - (i + 1) * 2 * 86_400_000,
      updatedAt: now - (i + 1) * 3_600_000, author: 'demo', url: '', assignees: i === 0 ? ['you'] : [], comments: 0, milestone: '',
    })),
  })
  return { repos: { orchard: repo('orchard', 5, 0), tidepool: repo('tidepool', 2, 5) }, updating: false, available: true, warnings: [] }
}
