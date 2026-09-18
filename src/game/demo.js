// ?demo=1: a made-up village, so the renderer can be worked on without a server or sessions.
const REPOS = ['orchard', 'lighthouse', 'bakery-api', 'tidepool', 'windvane', 'quill']
const TITLES = [
  'Fix the flaky login test', 'Add dark mode', 'Refactor the scheduler', 'Write the migration',
  'Investigate memory leak', 'Upgrade to Node 22', 'Tidy up the README', 'Port the parser',
  'Add CSV export', 'Make the map sticky', 'Profile the render loop', 'Review open PRs',
]

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
        lastActivityAt: roll === 10 ? now - 5 * 86_400_000 : now - roll * 600_000,
        lastFocusedAt: 0,
        running: roll < 3,
        unread: roll === 3 || roll === 4,
        hasError: roll === 5,
        prState: roll === 6 ? 'MERGED' : '',
        archived: false,
        sizeBytes: 5_000 * (n * 13) ** 1.3,
        canOpen: false,
        ref: {},
      })
    }
  })
  return out
}
