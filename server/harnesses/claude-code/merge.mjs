// Pure: folding the desktop app's records and the CLI's transcripts into one thread each.
import { HARNESS_ID, isCliId, isDesktopId, threadId } from './ids.mjs'
import { projectOf } from './project.mjs'

/** How long an empty desktop record may exist before it is treated as abandoned bookkeeping. */
export const NEW_SESSION_MS = 10 * 60 * 1000

/**
 * The adapter's private working shape, one per conversation. `toThread` is what leaves.
 * @typedef {object} Entry
 */
export function emptyEntry(id) {
  return {
    id,
    cliSessionId: '',
    desktopSessionId: '',
    desktopSessionIds: [],
    title: '',
    preview: '',
    cwd: '',
    originCwd: '',
    gitBranch: '',
    model: '',
    effort: '',
    createdAt: 0,
    lastActivityAt: 0,
    recordActivityAt: 0, // the desktop app's own stamps only, never the transcript mtime
    lastFocusedAt: 0,
    hasError: false,
    prState: '',
    prNumber: 0,
    prUrl: '',
    archived: false,
    sizeBytes: 0,
    hasTranscript: false,
    live: false,
    source: 'cli',
  }
}

/**
 * Two desktop records for the same CLI session — resuming writes a second untitled one. The
 * titled record keeps the canonical desktop id; both ids are retained so an archive covers
 * the ghost too; flags OR together, `archived` ANDs (un-archiving either copy un-archives).
 */
export function mergeThread(a, b) {
  const [keep, other] = a.title && !b.title ? [a, b] : !a.title && b.title ? [b, a] : a.createdAt <= b.createdAt ? [a, b] : [b, a]
  const out = { ...keep }
  out.cliSessionId = keep.cliSessionId || other.cliSessionId
  out.desktopSessionId = keep.desktopSessionId || other.desktopSessionId
  out.desktopSessionIds = [...new Set([...keep.desktopSessionIds, ...other.desktopSessionIds])]
  out.title = keep.title || other.title
  out.preview = keep.preview || other.preview
  out.cwd = keep.cwd || other.cwd
  out.originCwd = keep.originCwd || other.originCwd
  out.gitBranch = keep.gitBranch || other.gitBranch
  out.model = keep.model || other.model
  out.effort = keep.effort || other.effort
  out.createdAt = Math.min(keep.createdAt || Infinity, other.createdAt || Infinity)
  if (!Number.isFinite(out.createdAt)) out.createdAt = 0
  out.lastActivityAt = Math.max(keep.lastActivityAt, other.lastActivityAt)
  out.recordActivityAt = Math.max(keep.recordActivityAt, other.recordActivityAt)
  out.lastFocusedAt = Math.max(keep.lastFocusedAt, other.lastFocusedAt)
  out.hasError = keep.hasError || other.hasError
  out.prState = keep.prState || other.prState
  out.prNumber = keep.prNumber || other.prNumber
  out.prUrl = keep.prUrl || other.prUrl
  out.archived = keep.archived && other.archived
  out.sizeBytes = Math.max(keep.sizeBytes, other.sizeBytes)
  out.hasTranscript = keep.hasTranscript || other.hasTranscript
  out.live = keep.live || other.live
  out.source = keep.source === 'desktop' || other.source === 'desktop' ? 'desktop' : 'cli'
  return out
}

/**
 * A desktop record with no transcript, no title and no process, older than a few minutes, is
 * a session that was opened and abandoned before anything happened. It would be a villager
 * with nothing to do on a plot with nothing on it.
 */
export function isBookkeepingOnly(entry, now = Date.now()) {
  if (entry.hasTranscript || entry.title || entry.live) return false
  return now - (entry.lastActivityAt || entry.createdAt || 0) > NEW_SESSION_MS
}

/** The public Thread. Private fields stay behind; `ref` carries what `openThread` needs back. */
export function toThread(entry, harnessName) {
  const where = projectOf({ cwd: entry.cwd, originCwd: entry.originCwd })
  return {
    id: entry.id,
    harness: HARNESS_ID,
    harnessName,
    title: entry.title || entry.preview || 'Untitled',
    preview: entry.preview,
    project: where.project,
    projectPath: where.projectPath,
    worktree: where.worktree,
    cwd: where.cwd,
    gitBranch: entry.gitBranch,
    model: entry.model,
    effort: entry.effort,
    createdAt: entry.createdAt,
    lastActivityAt: entry.lastActivityAt,
    lastFocusedAt: entry.lastFocusedAt,
    running: Boolean(entry.running),
    unread: Boolean(entry.unread),
    hasError: entry.hasError,
    needsInput: entry.needsInput || '',
    prState: entry.prState,
    prNumber: entry.prNumber,
    prUrl: entry.prUrl,
    archived: entry.archived,
    sizeBytes: entry.sizeBytes,
    source: entry.source,
    canOpen: isDesktopId(entry.desktopSessionId) || isCliId(entry.cliSessionId),
    opensIn: '',
    ref: {
      desktopSessionId: entry.desktopSessionId,
      desktopSessionIds: entry.desktopSessionIds,
      cliSessionId: entry.cliSessionId,
      cwd: where.cwd,
    },
  }
}

export { threadId }
