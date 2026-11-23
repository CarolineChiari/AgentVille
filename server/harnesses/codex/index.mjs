// The OpenAI Codex CLI adapter. One store, read-only:
//   $CODEX_HOME/sessions/YYYY/MM/DD/rollout-<timestamp>-<id>.jsonl   (CODEX_HOME is ~/.codex unless set)
//   $CODEX_HOME/archived_sessions/rollout-<timestamp>-<id>.jsonl      the ones `codex` was told to put away
// Codex's VS Code extension runs the same CLI underneath and writes the same files.
import os from 'node:os'
import path from 'node:path'
import fsp from 'node:fs/promises'
import { exists, jsonLines, listDirs, listFiles, readHead, readTail } from '../../lib/fsutil.mjs'
import { findExe } from '../../lib/which.mjs'
import { tilde } from '../../lib/tilde.mjs'
import { makeThread } from '../thread.mjs'
import { rolloutHead, rolloutMessages, rolloutTail } from './rollout.mjs'

export const HARNESS_ID = 'codex'
const NAME = 'Codex'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isId = (v) => typeof v === 'string' && UUID_RE.test(v)
// The id is the last 36 characters of the name; the timestamp before it is when it started.
const ROLLOUT_RE = /^rollout-[\dT:.-]+-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl$/i
const DIGITS = /^\d+$/

// The session_meta line carries the person's AGENTS.md as `instructions`, which can run to tens of
// kilobytes before the first prompt; 64 KB, enough for the other harnesses, cut some of those off.
const HEAD_BYTES = 256 * 1024
// Enough of the tail to reach the last message past a run of tool output and token counts.
const TAIL_BYTES = 64 * 1024
// A turn writes a line every few seconds, but one long command (a build, a test run) can go quiet
// for minutes. Past this, a turn with no answer was cut off (the terminal closed), not working.
const RUNNING_WINDOW_MS = 10 * 60 * 1000
const TRANSCRIPT_MAX_BYTES = 64 * 1024 * 1024

/**
 * @param {{ home?: string, env?: object, platform?: string, now?: () => number, codexPath?: string|null }} [opts]
 */
export function createCodexAdapter(opts = {}) {
  const home = opts.home ?? os.homedir()
  const env = opts.env ?? process.env
  const platform = opts.platform ?? process.platform
  const now = opts.now ?? Date.now
  const own = typeof env.CODEX_HOME === 'string' && path.isAbsolute(env.CODEX_HOME) ? env.CODEX_HOME : ''
  const codexHome = own || path.join(home, '.codex')
  const sessionsDir = path.join(codexHome, 'sessions')
  const archivedDir = path.join(codexHome, 'archived_sessions')

  const fileCache = new Map() // file → { key, info }
  const convoCache = new Map() // file → { key, messages }
  let lastFiles = new Map() // session id → file, from the latest scan

  const codexExe = () => (opts.codexPath !== undefined ? opts.codexPath : findExe('codex', { home, env, platform, dirs: [path.join(home, '.npm-global', 'bin')] }))

  /**
   * Either store, or the CLI itself: a fresh install has written no session yet, and its first one
   * is started from here. A few `stat`s whichever way it goes.
   */
  async function detect() {
    return (await exists(sessionsDir)) || (await exists(archivedDir)) || Boolean(await codexExe())
  }

  async function statKey(file) {
    try {
      const st = await fsp.stat(file)
      return { key: `${st.mtimeMs}:${st.size}`, mtime: st.mtimeMs, size: st.size }
    } catch {
      return null
    }
  }

  /** Every rollout file: the dated tree under sessions/, then the flat archive. */
  async function rollouts() {
    const out = []
    const add = async (dir, archived) => {
      for (const n of await listFiles(dir, (n) => ROLLOUT_RE.test(n))) out.push({ file: path.join(dir, n), id: ROLLOUT_RE.exec(n)[1], archived })
    }
    for (const y of await listDirs(sessionsDir)) {
      if (!DIGITS.test(y)) continue
      for (const m of await listDirs(path.join(sessionsDir, y))) {
        if (!DIGITS.test(m)) continue
        for (const d of await listDirs(path.join(sessionsDir, y, m))) if (DIGITS.test(d)) await add(path.join(sessionsDir, y, m, d), false)
      }
    }
    await add(archivedDir, true)
    return out
  }

  async function info(file, st) {
    const hit = fileCache.get(file)
    if (hit?.key === st.key) return hit.info
    const [head, tail] = await Promise.all([
      readHead(file, HEAD_BYTES).then((s) => rolloutHead(jsonLines(s))),
      readTail(file, TAIL_BYTES).then((s) => rolloutTail(jsonLines(s))),
    ])
    const out = { head, tail }
    fileCache.set(file, { key: st.key, info: out })
    return out
  }

  const thread = (f) => makeThread(HARNESS_ID, NAME, f)

  async function scanThreads() {
    const found = new Map() // session id → { file, mtime, thread }
    const t = now()
    const exe = await codexExe()
    for (const r of await rollouts()) {
      const st = await statKey(r.file)
      if (!st) continue
      const { head, tail } = await info(r.file, st)
      const id = isId(head.id) ? head.id : r.id
      // The earliest rollouts never said where they ran: there is no plot to put them on.
      if (!head.cwd || !path.isAbsolute(head.cwd)) continue
      // Launched and left before the first prompt: nothing happened here.
      if (!head.firstPrompt) continue
      // The same session in both places, mid-archive: the newer file wins.
      if ((found.get(id)?.mtime ?? -1) >= st.mtime) continue
      const sinceWrite = t - st.mtime
      const running = !r.archived && Boolean(tail?.inTurn) && sinceWrite < RUNNING_WINDOW_MS
      found.set(id, { file: r.file, mtime: st.mtime, thread: thread({
        sessionId: id,
        title: head.firstPrompt,
        preview: head.firstPrompt,
        projectPath: head.cwd,
        cwd: head.cwd,
        gitBranch: head.branch,
        model: tail?.model || head.model,
        effort: head.effort,
        createdAt: head.createdAt || st.mtime,
        lastActivityAt: Math.max(tail?.at || 0, st.mtime),
        running,
        needsInput: '',
        // Answered its turn: ready for review until you mark it seen.
        unread: !r.archived && Boolean(tail?.finished),
        // Never: Codex doesn't write an error to the rollout (see rolloutTail).
        hasError: false,
        archived: r.archived,
        sizeBytes: st.size,
        source: head.source,
        opensIn: exe ? 'Terminal' : '',
        ref: { sessionId: id, cwd: head.cwd },
      }) })
    }
    lastFiles = found
    return [...found.values()].map((f) => f.thread)
  }

  /** A session resumes in a terminal, in the folder it ran in: `codex resume <id>`. */
  async function openThread(ref) {
    const r = ref && typeof ref === 'object' ? ref : {}
    if (!isId(r.sessionId) || typeof r.cwd !== 'string' || !path.isAbsolute(r.cwd)) return { ok: false, error: 'This thread has nothing Codex can open.' }
    const exe = await codexExe()
    if (!exe) return { ok: false, error: 'Install the Codex CLI to resume this session.' }
    return { ok: true, where: 'a terminal', terminal: { exe, args: ['resume', r.sessionId], cwd: r.cwd } }
  }

  /**
   * The conversation of one thread, found among the files the scan listed — the page never names a
   * file. With `head`, its first `head` messages too, and a `{ role: 'gap', count }` between.
   */
  async function readTranscript(ref, { limit = 300, head = 0 } = {}) {
    const id = ref && typeof ref === 'object' ? ref.sessionId : null
    if (!isId(id)) return { ok: false, error: 'This thread has no transcript on this machine.' }
    if (!lastFiles.has(id)) await scanThreads()
    const f = lastFiles.get(id)
    if (!f) return { ok: false, error: 'Transcript not found.' }
    const st = await statKey(f.file)
    if (!st) return { ok: false, error: 'Transcript not found.' }
    if (st.size > TRANSCRIPT_MAX_BYTES) return { ok: false, error: 'This transcript is too large to show here.' }
    let hit = convoCache.get(f.file)
    if (!hit || hit.key !== st.key) {
      hit = { key: st.key, messages: rolloutMessages(jsonLines(await fsp.readFile(f.file, 'utf8'))) }
      convoCache.delete(f.file)
      convoCache.set(f.file, hit)
      while (convoCache.size > 6) convoCache.delete(convoCache.keys().next().value)
    }
    const n = Math.max(1, Math.min(2000, Number(limit) || 300))
    const h = Math.max(0, Math.min(2000, Math.floor(Number(head)) || 0))
    const all = hit.messages
    const messages = !h ? all.slice(-n) : all.length > n + h ? [...all.slice(0, h), { role: 'gap', count: all.length - n - h }, ...all.slice(-n)] : all.slice()
    return { ok: true, messages, total: all.length, updatedAt: st.mtime, sizeBytes: st.size }
  }

  /** A terminal, when the `codex` CLI is installed: the only place a Codex session starts from here. */
  async function targets() {
    if (!(await codexExe())) return []
    return [{ id: 'terminal', label: 'Terminal', note: `Opens a terminal in the folder running Codex${platform === 'win32' ? '; your prompt goes on the clipboard' : ', starting on your prompt'}.` }]
  }

  async function newSession(dir, { target = '', prompt = '' } = {}) {
    if (typeof dir !== 'string' || !path.isAbsolute(dir)) return { ok: false, error: 'Not an absolute folder.' }
    if (target !== 'terminal') return { ok: false, error: 'Unknown place to start a session.' }
    const exe = await codexExe()
    if (!exe) return { ok: false, error: "Couldn't find the codex command." }
    // `codex -- <prompt>` starts the interactive CLI already working on it. The `--` is what makes
    // it a prompt: a bare `logout` or `resume` would be read as that subcommand and run it.
    const text = typeof prompt === 'string' ? prompt.trim().slice(0, 20000) : ''
    return { ok: true, where: 'a terminal', terminal: { exe, args: [], promptArgs: ['--'], cwd: dir, prompt: text } }
  }

  return {
    id: HARNESS_ID,
    name: NAME,
    detect,
    scanThreads,
    openThread,
    newSession,
    targets,
    readTranscript,
    watchPaths: () => [sessionsDir, archivedDir],
    looked: () => [tilde(codexHome, home)],
    url: 'https://github.com/openai/codex',
  }
}

export default createCodexAdapter()
