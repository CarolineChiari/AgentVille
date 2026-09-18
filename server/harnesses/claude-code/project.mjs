// Pure: turning a session's working directory into the repo it belongs to.

// Both separators, because a Windows cwd has to be understood in a test running on a Mac.
const WORKTREE_RE = /[\\/]\.claude[\\/]worktrees[\\/]([^\\/]+)/
const SEP_RE = /[\\/]/

export const basename = (p) => String(p || '').split(SEP_RE).filter(Boolean).pop() || ''

/** `/repo/.claude/worktrees/feature` → `{ root: '/repo', worktree: 'feature' }`. */
export function splitWorktree(cwd) {
  const s = String(cwd || '')
  const m = WORKTREE_RE.exec(s)
  if (!m) return { root: s, worktree: '' }
  return { root: s.slice(0, m.index), worktree: m[1] }
}

/**
 * Which repo a thread stands on. A worktree thread lands on its parent repo's plot: the
 * desktop app records the repo as `originCwd`, and a CLI-only worktree still carries the
 * `.claude/worktrees/<name>` marker in its cwd.
 */
export function projectOf({ cwd, originCwd }) {
  const where = String(cwd || originCwd || '')
  const { root, worktree } = splitWorktree(where)
  const projectPath = String(originCwd || root || where)
  return { project: basename(projectPath), projectPath, worktree, cwd: where }
}

/**
 * Reverse the CLI's project-folder encoding, used only when a transcript carries no `cwd`.
 * The encoding is lossy (`Diary_MCP` and `Diary-MCP` both become `Diary-MCP`), which is why
 * the record's own `cwd` is always preferred.
 *   `-Users-me-Code-app` → `/Users/me/Code/app`
 *   `C--Users-me-app`    → `C:\Users\me\app`
 */
export function decodeProjectDir(name) {
  const s = String(name || '')
  const drive = /^([A-Za-z])--(.*)$/.exec(s)
  if (drive) return `${drive[1].toUpperCase()}:\\${drive[2].split('-').join('\\')}`
  if (s.startsWith('-')) return '/' + s.slice(1).split('-').join('/')
  return s
}
