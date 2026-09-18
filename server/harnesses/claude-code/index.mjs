// The Claude Code adapter. Three stores, all read-only, merged into one thread per conversation:
//   desktop records  <userData>/claude-code-sessions/<account>/<org>/local_<uuid>.json
//   CLI transcripts  ~/.claude/projects/<encoded-cwd>/<uuid>.jsonl
//   live processes   ~/.claude/sessions/<pid>.json
import os from 'node:os'
import path from 'node:path'
import fsp from 'node:fs/promises'
import { isAlive, jsonLines, listDirs, listFiles, num, readHead, readJson, readTail, exists } from '../../lib/fsutil.mjs'
import { HARNESS_ID, isCliId, isDesktopId, threadId } from './ids.mjs'
import { cliDirs, desktopDataDir, SESSIONS_SUBDIR } from './paths.mjs'
import { decodeProjectDir } from './project.mjs'
import { awaitingReply, readTranscriptMeta } from './transcript.mjs'
import { emptyEntry, isBookkeepingOnly, mergeThread, toThread } from './merge.mjs'

const NAME = 'Claude Code'
// Enough of the head to reach the first real prompt past a long run of tool-list attachments.
const HEAD_BYTES = 192 * 1024
// Enough of the tail to reach the last assistant turn past a big tool result.
const TAIL_BYTES = 64 * 1024
// A live pid alone means little: the desktop app keeps idle sessions warm. "Running" also
// needs the transcript to have moved recently.
const ACTIVE_WINDOW_MS = 30 * 60 * 1000

/**
 * @param {{ home?: string, env?: object, platform?: string, now?: () => number }} [opts]
 *        Injectable so tests can point it at a fake home directory.
 */
export function createClaudeCodeAdapter(opts = {}) {
  const home = opts.home ?? os.homedir()
  const env = opts.env ?? process.env
  const platform = opts.platform ?? process.platform
  const now = opts.now ?? Date.now
  const cli = cliDirs(home)
  let desktopDir // resolved lazily, once
  const metaCache = new Map() // file → { key, meta }

  async function desktopRoot() {
    if (desktopDir === undefined) desktopDir = await desktopDataDir({ home, env, platform })
    return desktopDir ? path.join(desktopDir, SESSIONS_SUBDIR) : null
  }

  async function detect() {
    const root = await desktopRoot()
    return (await exists(cli.projects)) || (root ? await exists(root) : false)
  }

  async function scanDesktop() {
    const root = await desktopRoot()
    if (!root) return []
    const files = []
    for (const account of await listDirs(root)) {
      for (const org of await listDirs(path.join(root, account))) {
        const dir = path.join(root, account, org)
        for (const f of await listFiles(dir, (n) => n.startsWith('local_') && n.endsWith('.json'))) {
          files.push(path.join(dir, f))
        }
      }
    }
    const records = await Promise.all(files.map(readJson))
    return records.filter((r) => r && typeof r === 'object' && isDesktopId(r.sessionId))
  }

  async function scanTranscripts() {
    const out = new Map() // uuid → { file, size, mtime, dirName }
    for (const dirName of await listDirs(cli.projects)) {
      const dir = path.join(cli.projects, dirName)
      for (const f of await listFiles(dir, (n) => n.endsWith('.jsonl'))) {
        const id = f.slice(0, -'.jsonl'.length)
        if (!isCliId(id)) continue
        const file = path.join(dir, f)
        try {
          const st = await fsp.stat(file)
          const prev = out.get(id)
          if (!prev || st.mtimeMs > prev.mtime) out.set(id, { file, size: st.size, mtime: st.mtimeMs, dirName })
        } catch {
          // Deleted between readdir and stat.
        }
      }
    }
    return out
  }

  async function scanLive() {
    const live = new Set()
    for (const f of await listFiles(cli.sessions, (n) => n.endsWith('.json'))) {
      const r = await readJson(path.join(cli.sessions, f))
      if (r && isCliId(r.sessionId) && isAlive(num(r.pid))) live.add(r.sessionId)
    }
    return live
  }

  /** Head metadata plus tail "waiting" flag, cached against mtime+size so a big transcript isn't reparsed every poll. */
  async function transcriptInfo(t, wantTail) {
    const key = `${t.mtime}:${t.size}`
    let hit = metaCache.get(t.file)
    if (!hit || hit.key !== key) {
      const meta = readTranscriptMeta(jsonLines(await readHead(t.file, HEAD_BYTES)))
      hit = { key, meta, waiting: undefined }
      metaCache.set(t.file, hit)
    }
    if (wantTail && hit.waiting === undefined) {
      hit.waiting = awaitingReply(jsonLines(await readTail(t.file, TAIL_BYTES)))
    }
    return hit
  }

  function fromDesktop(s) {
    const cliId = isCliId(s.cliSessionId) ? s.cliSessionId : ''
    const e = emptyEntry(threadId(cliId || s.sessionId))
    const recordAt = num(s.lastActivityAt) || num(s.lastFocusedAt) || num(s.createdAt)
    Object.assign(e, {
      cliSessionId: cliId,
      desktopSessionId: s.sessionId,
      desktopSessionIds: [s.sessionId],
      title: typeof s.title === 'string' ? s.title.trim() : '',
      cwd: String(s.cwd || s.originCwd || ''),
      originCwd: String(s.originCwd || ''),
      model: typeof s.model === 'string' ? s.model : '',
      effort: typeof s.effort === 'string' ? s.effort : '',
      createdAt: num(s.createdAt),
      lastActivityAt: recordAt,
      recordActivityAt: recordAt,
      lastFocusedAt: num(s.lastFocusedAt),
      hasError: Boolean(s.error),
      prState: typeof s.prState === 'string' ? s.prState.toUpperCase() : '',
      archived: s.isArchived === true || s.isArchived === 'True',
      source: 'desktop',
    })
    return e
  }

  async function scanThreads() {
    const [desktop, transcripts, live] = await Promise.all([scanDesktop(), scanTranscripts(), scanLive()])
    const t = now()
    const byId = new Map()
    const add = (e) => byId.set(e.id, byId.has(e.id) ? mergeThread(byId.get(e.id), e) : e)

    for (const s of desktop) add(fromDesktop(s))
    for (const [uuid] of transcripts) {
      const id = threadId(uuid)
      if (!byId.has(id)) add(Object.assign(emptyEntry(id), { cliSessionId: uuid }))
    }

    const out = []
    for (const e of byId.values()) {
      const tr = e.cliSessionId ? transcripts.get(e.cliSessionId) : null
      e.live = Boolean(e.cliSessionId && live.has(e.cliSessionId))
      if (tr) {
        e.hasTranscript = true
        e.sizeBytes = tr.size
        e.lastActivityAt = Math.max(e.lastActivityAt, tr.mtime)
        const fresh = t - e.lastActivityAt < ACTIVE_WINDOW_MS
        const info = await transcriptInfo(tr, e.live && fresh)
        const m = info.meta
        e.title = e.title || m.customTitle || m.summary
        e.preview = m.firstPrompt
        e.cwd = e.cwd || m.cwd || decodeProjectDir(tr.dirName)
        e.gitBranch = m.gitBranch
        e.model = e.model || m.model
        e.createdAt = e.createdAt || m.startedAt || tr.mtime
        e.prState = e.prState || m.prState
        e.waiting = Boolean(info.waiting) && e.live && fresh
      }
      if (isBookkeepingOnly(e, t)) continue
      const fresh = t - e.lastActivityAt < ACTIVE_WINDOW_MS
      // Terminal-only threads have no focus history, so "unread" is unknowable, not true —
      // unless the transcript itself says the model is waiting for a reply.
      e.unread = e.desktopSessionIds.length > 0 && e.recordActivityAt > e.lastFocusedAt
      e.running = e.live && fresh && !e.waiting
      if (e.waiting) e.unread = true
      out.push(toThread(e, NAME))
    }
    return out
  }

  /**
   * @param {object} ref
   * @param {{ target?: 'app' | 'vscode' }} [opts]
   */
  function openThread(ref, { target = 'app' } = {}) {
    const r = ref && typeof ref === 'object' ? ref : {}
    if (target === 'vscode') {
      // The VS Code extension resumes by CLI session id, and only in the window that receives the
      // link — so the repo folder is opened (or focused) first, then the session.
      if (!isCliId(r.cliSessionId)) return { ok: false, error: 'This thread only exists in the Claude app, so VS Code cannot open it.' }
      const folder = typeof r.cwd === 'string' && path.isAbsolute(r.cwd) ? r.cwd : ''
      const session = `vscode://anthropic.claude-code/open?${new URLSearchParams({ session: r.cliSessionId })}`
      return { ok: true, url: session, urls: folder ? [vscodeFolderUrl(folder), session] : [session] }
    }
    // Navigating the desktop app to a thread it already has is preferred. `resume` imports the
    // transcript as a second session, so it is only for threads that exist only as a CLI file.
    if (isDesktopId(r.desktopSessionId)) {
      return { ok: true, url: `claude://claude.ai/epitaxy/${r.desktopSessionId}` }
    }
    if (isCliId(r.cliSessionId)) {
      return { ok: true, url: `claude://resume?${new URLSearchParams({ session: r.cliSessionId })}` }
    }
    return { ok: false, error: 'This thread has no id Claude can open.' }
  }

  function newSession(dir, { target = 'app' } = {}) {
    if (typeof dir !== 'string' || !path.isAbsolute(dir)) return { ok: false, error: 'Not an absolute folder.' }
    if (target === 'vscode') {
      const open = 'vscode://anthropic.claude-code/open'
      return { ok: true, url: open, urls: [vscodeFolderUrl(dir), open] }
    }
    return { ok: true, url: `claude://code/new?${new URLSearchParams({ folder: dir })}` }
  }

  return { id: HARNESS_ID, name: NAME, detect, scanThreads, openThread, newSession, paths: { ...cli } }
}

/**
 * `vscode://file/<path>` opens a folder in VS Code, or focuses the window that already has it.
 * Windows paths go forward-slashed (`vscode://file/C:/code/app`); each segment is escaped.
 */
export function vscodeFolderUrl(dir) {
  const parts = String(dir).split(/[\\/]/).filter(Boolean)
  const drive = /^[A-Za-z]:$/.test(parts[0] || '') ? parts.shift() + '/' : ''
  return `vscode://file/${drive}${parts.map(encodeURIComponent).join('/')}/`
}

export default createClaudeCodeAdapter()
