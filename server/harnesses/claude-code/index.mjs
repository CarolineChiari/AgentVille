// The Claude Code adapter. Three stores, all read-only, merged into one thread per conversation:
//   desktop records  <userData>/claude-code-sessions/<account>/<org>/local_<uuid>.json
//   CLI transcripts  ~/.claude/projects/<encoded-cwd>/<uuid>.jsonl
//   live processes   ~/.claude/sessions/<pid>.json
import os from 'node:os'
import path from 'node:path'
import fsp from 'node:fs/promises'
import { isAlive, jsonLines, listDirs, listFiles, num, readHead, readJson, readTail, exists } from '../../lib/fsutil.mjs'
import { EFFORT_CHOICES, HARNESS_ID, MODEL_CHOICES, isCliId, isDesktopId, isEffort, isModel, threadId } from './ids.mjs'
import { cliDirs, desktopDataDir, findClaude, SESSIONS_SUBDIR } from './paths.mjs'
import { decodeProjectDir } from './project.mjs'
import { awaitingReply, pendingQuestion, readTranscriptMeta, transcriptMessages } from './transcript.mjs'
import { emptyEntry, isBookkeepingOnly, mergeThread, toThread } from './merge.mjs'
import { changeLog, filesTouched } from './changes.mjs'
import { folderUrl } from '../vscode-family.mjs'

const NAME = 'Claude Code'
// Enough of the head to reach the first real prompt past a long run of tool-list attachments.
const HEAD_BYTES = 192 * 1024
// Enough of the tail to reach the last assistant turn past a big tool result.
const TAIL_BYTES = 64 * 1024
// A live pid alone means little: the desktop app keeps idle sessions warm. "Running" also
// needs the transcript to have moved recently.
const ACTIVE_WINDOW_MS = 30 * 60 * 1000
// A prompt travels inside a URL handed to the OS; Windows' ShellExecute caps those near 2k chars.
export const PROMPT_MAX = 1800
const LIVE_STATUSES = new Set(['busy', 'shell', 'idle', 'waiting'])

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
  let lastTranscripts = new Map() // uuid → { file, size, mtime } from the latest scan
  const convoCache = new Map() // file → { key, messages }; a few at most, they can be large
  const changeCache = new Map() // file → { key, log }; same idea, keyed on mtime+size

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

  /**
   * Live processes, and what each says it is doing. Claude Code keeps `status` current in its own
   * record: `busy` or `shell` while working, `idle` between turns, and `waiting` whenever it needs
   * the person — a question dialog, a permission prompt — with `waitingFor` saying which. That is
   * the only reliable way to see a pending question: the transcript just ends in a tool call.
   * One session can have several records (VS Code and the desktop app); the freshest wins.
   * @returns {Map<string, { status: string, waitingFor: string, at: number }>}
   */
  async function scanLive() {
    const live = new Map()
    for (const f of await listFiles(cli.sessions, (n) => n.endsWith('.json'))) {
      const r = await readJson(path.join(cli.sessions, f))
      if (!r || !isCliId(r.sessionId) || !isAlive(num(r.pid))) continue
      const at = num(r.statusUpdatedAt) || num(r.updatedAt)
      const prev = live.get(r.sessionId)
      if (prev && prev.at >= at) continue
      live.set(r.sessionId, {
        status: LIVE_STATUSES.has(r.status) ? r.status : '',
        waitingFor: typeof r.waitingFor === 'string' ? r.waitingFor.slice(0, 60) : '',
        at,
      })
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
      const tail = jsonLines(await readTail(t.file, TAIL_BYTES))
      hit.waiting = awaitingReply(tail)
      hit.asking = pendingQuestion(tail)
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
      prNumber: Number.isInteger(s.prNumber) ? s.prNumber : 0,
      prUrl: typeof s.prUrl === 'string' && /^https:\/\/github\.com\//.test(s.prUrl) ? s.prUrl : '',
      archived: s.isArchived === true || s.isArchived === 'True',
      source: 'desktop',
    })
    return e
  }

  async function scanThreads() {
    const [desktop, transcripts, live] = await Promise.all([scanDesktop(), scanTranscripts(), scanLive()])
    lastTranscripts = transcripts
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
      const proc = e.cliSessionId ? live.get(e.cliSessionId) : null
      e.live = Boolean(proc)
      if (tr) {
        e.hasTranscript = true
        e.sizeBytes = tr.size
        e.lastActivityAt = Math.max(e.lastActivityAt, tr.mtime)
        const fresh = t - e.lastActivityAt < ACTIVE_WINDOW_MS
        // Read the tail for any live session: a question can sit unanswered for hours.
        const info = await transcriptInfo(tr, e.live)
        const m = info.meta
        e.title = e.title || m.customTitle || m.summary
        e.preview = m.firstPrompt
        e.cwd = e.cwd || m.cwd || decodeProjectDir(tr.dirName)
        e.gitBranch = m.gitBranch
        e.model = e.model || m.model
        e.createdAt = e.createdAt || m.startedAt || tr.mtime
        e.prState = e.prState || m.prState
        e.prNumber = e.prNumber || m.prNumber
        e.prUrl = e.prUrl || m.prUrl
        e.waiting = Boolean(info.waiting) && e.live && fresh
        e.asking = Boolean(info.asking) && e.live
      }
      if (isBookkeepingOnly(e, t)) continue
      const fresh = t - e.lastActivityAt < ACTIVE_WINDOW_MS
      // Terminal-only threads have no focus history, so "unread" is unknowable, not true —
      // unless the transcript itself says the model is waiting for a reply.
      e.unread = e.desktopSessionIds.length > 0 && e.recordActivityAt > e.lastFocusedAt
      e.running = e.live && fresh && !e.waiting
      if (e.waiting) e.unread = true
      // The process's own word beats anything guessed from the transcript.
      if (proc?.status === 'waiting' || e.asking) {
        e.running = false
        e.unread = true
        e.needsInput = proc?.waitingFor || (e.asking ? 'question' : 'input needed')
      } else if (proc?.status === 'busy' || proc?.status === 'shell') {
        e.running = true
      } else if (proc?.status === 'idle') {
        e.running = false
      }
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
      return { ok: true, where: 'VS Code', url: session, urls: folder ? [vscodeFolderUrl(folder), session] : [session] }
    }
    // Navigating the desktop app to a thread it already has is preferred. `resume` imports the
    // transcript as a second session, so it is only for threads that exist only as a CLI file.
    if (isDesktopId(r.desktopSessionId)) {
      return { ok: true, where: 'the Claude app', url: `claude://claude.ai/epitaxy/${r.desktopSessionId}` }
    }
    if (isCliId(r.cliSessionId)) {
      return { ok: true, where: 'the Claude app', url: `claude://resume?${new URLSearchParams({ session: r.cliSessionId })}` }
    }
    return { ok: false, error: 'This thread has no id Claude can open.' }
  }

  /**
   * The transcript file of one thread, found by its CLI session id among the ones the scan already
   * listed — the page never names a file — with a fresh stat for the cache key.
   * @returns {Promise<{ ok: true, file: string, st: object, key: string } | { ok: false, error: string }>}
   */
  async function locateTranscript(ref) {
    const id = ref && typeof ref === 'object' ? ref.cliSessionId : null
    if (!isCliId(id)) return { ok: false, error: 'This thread has no transcript on this machine.' }
    let t = lastTranscripts.get(id)
    if (!t) {
      lastTranscripts = await scanTranscripts()
      t = lastTranscripts.get(id)
    }
    if (!t) return { ok: false, error: 'Transcript not found.' }
    try {
      const st = await fsp.stat(t.file)
      return { ok: true, file: t.file, st, key: `${st.mtimeMs}:${st.size}` }
    } catch {
      return { ok: false, error: 'Transcript not found.' }
    }
  }

  /** Keep a cache small enough that a handful of big transcripts can't sit in memory forever. */
  function remember(cache, file, hit) {
    cache.delete(file)
    cache.set(file, hit)
    while (cache.size > 6) cache.delete(cache.keys().next().value)
  }

  /** The conversation of one thread, newest `limit` messages. */
  async function readTranscript(ref, { limit = 300 } = {}) {
    const found = await locateTranscript(ref)
    if (!found.ok) return found
    const { file, st, key } = found
    let hit = convoCache.get(file)
    if (!hit || hit.key !== key) {
      hit = { key, messages: transcriptMessages(jsonLines(await fsp.readFile(file, 'utf8'))) }
      remember(convoCache, file, hit)
    }
    const n = Math.max(1, Math.min(2000, Number(limit) || 300))
    return { ok: true, messages: hit.messages.slice(-n), total: hit.messages.length, updatedAt: st.mtimeMs, sizeBytes: st.size }
  }

  /**
   * What this session changed on disk, read from the tool calls in its own transcript. The repo is
   * never run and never read: `changes.mjs` works from the transcript alone.
   *
   * Paths come out relative to the folder the thread worked in, which the adapter takes from the
   * ref rather than from anything the page chose, so a file is only ever called "inside the repo"
   * because the session itself said it was working there.
   */
  async function readChanges(ref, { detail = false } = {}) {
    const found = await locateTranscript(ref)
    if (!found.ok) return found
    const { file, st, key } = found
    const root = ref && typeof ref.cwd === 'string' && path.isAbsolute(ref.cwd) ? ref.cwd : ''
    let hit = changeCache.get(file)
    if (!hit || hit.key !== key || hit.root !== root) {
      hit = { key, root, log: changeLog(jsonLines(await fsp.readFile(file, 'utf8')), { root }) }
      remember(changeCache, file, hit)
    }
    const { files, more } = filesTouched(hit.log.entries)
    return {
      ok: true,
      root,
      files,
      more: more + hit.log.dropped,
      // The entry-by-entry log is only for the room inside a building; a card asks without it.
      ...(detail ? { entries: hit.log.entries, commits: hit.log.commits, dropped: hit.log.dropped } : {}),
      updatedAt: st.mtimeMs,
    }
  }

  /**
   * @param {string} dir
   * @param {{ target?: 'app'|'vscode'|'terminal', prompt?: string, model?: string, effort?: string }} [opts]
   *        VS Code: `prompt` is prefilled, never sent; the person still presses enter. The Claude
   *        app's link takes no prompt. Terminal runs the CLI with `--model`, `--effort` and the prompt.
   */
  async function newSession(dir, { target = 'app', prompt = '', model = '', effort = '' } = {}) {
    if (typeof dir !== 'string' || !path.isAbsolute(dir)) return { ok: false, error: 'Not an absolute folder.' }
    if (target === 'terminal') {
      // The one way to choose the model: the CLI's own --model flag, in a terminal window.
      if (model && !isModel(model)) return { ok: false, error: 'Unknown model.' }
      if (effort && !isEffort(effort)) return { ok: false, error: 'Unknown effort level.' }
      const exe = opts.claudePath ?? (await findClaude({ home, env, platform }))
      if (!exe) return { ok: false, error: "Couldn't find the claude command. Install Claude Code's CLI to start sessions in a terminal." }
      const text = typeof prompt === 'string' ? prompt.trim().slice(0, 20000) : ''
      const args = [...(model ? ['--model', model] : []), ...(effort ? ['--effort', effort] : [])]
      return { ok: true, where: 'a terminal', terminal: { exe, args, cwd: dir, prompt: text } }
    }
    if (target === 'vscode') {
      const text = typeof prompt === 'string' ? prompt.trim().slice(0, PROMPT_MAX) : ''
      const open = `vscode://anthropic.claude-code/open${text ? `?${new URLSearchParams({ prompt: text })}` : ''}`
      return { ok: true, where: 'VS Code', promptPassed: Boolean(text), url: open, urls: [vscodeFolderUrl(dir), open] }
    }
    return { ok: true, where: 'the Claude app', url: `claude://code/new?${new URLSearchParams({ folder: dir })}` }
  }

  /**
   * Hand an existing thread one more prompt: the CLI resumes it by id, in its own folder, in a
   * terminal. Only the CLI takes a prompt with a session id; the app and VS Code links take one or
   * the other. So a thread the CLI can't resume (desktop-only, or no CLI installed) is refused,
   * and the caller starts a fresh session with the prompt instead.
   * @param {object} ref
   * @param {{ prompt?: string }} [opts]
   */
  async function continueThread(ref, { prompt = '' } = {}) {
    const r = ref && typeof ref === 'object' ? ref : {}
    if (!isCliId(r.cliSessionId)) return { ok: false, error: 'This thread has no CLI session to resume.' }
    // The CLI files a session under the folder it ran in, and resumes only from there.
    if (typeof r.cwd !== 'string' || !path.isAbsolute(r.cwd)) return { ok: false, error: 'This thread has no folder to resume in.' }
    const text = typeof prompt === 'string' ? prompt.trim().slice(0, 20000) : ''
    if (!text) return { ok: false, error: 'Nothing to send.' }
    const exe = opts.claudePath ?? (await findClaude({ home, env, platform }))
    if (!exe) return { ok: false, error: "Couldn't find the claude command." }
    return { ok: true, where: 'a terminal', terminal: { exe, args: ['--resume', r.cliSessionId], cwd: r.cwd, prompt: text } }
  }

  /**
   * Where a new session can start on this machine. The terminal needs the CLI and the app needs
   * the app, so each is offered only once it is found. VS Code is always offered: its extension
   * keeps nothing we could look for until it has run once.
   */
  async function targets() {
    const out = [{
      id: 'vscode',
      label: 'VS Code',
      note: 'Opens in VS Code with the prompt typed in — press Enter there to send it. VS Code uses your default model and effort; change them in its menus, or choose Terminal here.',
    }]
    if (opts.claudePath ?? (await findClaude({ home, env, platform }))) {
      out.push({
        id: 'terminal',
        label: 'Terminal',
        note: `Opens a terminal in the folder running Claude Code${platform === 'win32' ? '; your prompt goes on the clipboard' : ', starting on your prompt'}.`,
        models: MODEL_CHOICES,
        efforts: EFFORT_CHOICES,
      })
    }
    const root = await desktopRoot()
    if (root && (await exists(root))) {
      out.push({ id: 'app', label: 'Claude app', note: 'Opens the Claude app in the folder with your default model and effort; your prompt goes on the clipboard.' })
    }
    return out
  }

  return { id: HARNESS_ID, name: NAME, detect, scanThreads, openThread, newSession, continueThread, targets, readTranscript, readChanges, paths: { ...cli } }
}

/** `vscode://file/<path>/`: opens the folder in VS Code, or focuses the window that has it. */
export const vscodeFolderUrl = (dir) => folderUrl('vscode', dir)

export default createClaudeCodeAdapter()
