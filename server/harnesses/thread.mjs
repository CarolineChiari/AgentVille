// A whole Thread from the fields a harness actually knows; everything else gets its neutral value.
// Claude Code builds its own (server/harnesses/claude-code/merge.mjs); the others start here.

export const basename = (p) => String(p || '').split(/[\\/]/).filter(Boolean).pop() || ''

/**
 * @param {string} harness     adapter id, also the id prefix
 * @param {string} harnessName
 * @param {object} f           `sessionId` plus any Thread fields
 */
export function makeThread(harness, harnessName, f) {
  const projectPath = f.projectPath || ''
  const running = Boolean(f.running)
  return {
    id: `${harness}:${f.sessionId}`,
    harness,
    harnessName,
    title: f.title || f.preview || 'Untitled',
    preview: f.preview || '',
    project: f.project || basename(projectPath),
    projectPath,
    worktree: f.worktree || '',
    cwd: f.cwd || projectPath,
    gitBranch: f.gitBranch || '',
    model: f.model || '',
    effort: f.effort || '',
    createdAt: f.createdAt || 0,
    lastActivityAt: f.lastActivityAt || 0,
    // Only Claude's desktop app records when you last looked at a thread.
    lastFocusedAt: f.lastFocusedAt || 0,
    running,
    // A thread still working has nothing to review yet.
    unread: Boolean(f.unread) && !running,
    needsInput: f.needsInput || '',
    hasError: Boolean(f.hasError),
    prState: '',
    prNumber: 0,
    prUrl: '',
    archived: Boolean(f.archived),
    sizeBytes: f.sizeBytes || 0,
    source: f.source || '',
    canOpen: f.canOpen ?? Boolean(f.opensIn),
    opensIn: f.opensIn || '',
    ref: f.ref || {},
  }
}
