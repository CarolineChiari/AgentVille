// The Google Antigravity adapter, read-only. Antigravity ships as three apps with separate
// histories, each under its own folder in ~/.gemini:
//   antigravity-cli/   the `agy` CLI
//   antigravity-ide/   Antigravity IDE (the VS Code fork, `antigravity-ide://`)
//   antigravity/       the Antigravity desktop app
// The conversations themselves are encrypted protobuf, but each app also keeps
// `conversation_summaries.db` (SQLite): title, first prompt, workspace, last change, and
// whether it is idle. That is what the village is built from. The CLI also writes a readable
// transcript per conversation, `brain/<id>/.system_generated/logs/transcript_full.jsonl`.
// The formats come from published exporters (specstory's ANTIGRAVITY-FORMAT.md, FailproofAI);
// this machine had no Antigravity to check them against.
import os from 'node:os'
import path from 'node:path'
import fsp from 'node:fs/promises'
import { exists, jsonLines, num } from '../../lib/fsutil.mjs'
import { queryAll } from '../../lib/sqlite.mjs'
import { findExe } from '../../lib/which.mjs'
import { editorUserDir, fileUriToPath, folderUrl } from '../vscode-family.mjs'
import { makeThread } from '../thread.mjs'

export const HARNESS_ID = 'antigravity'
const NAME = 'Antigravity'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isId = (v) => typeof v === 'string' && UUID_RE.test(v)

/** The three apps' data folders under ~/.gemini. `source` is also what a thread records. */
export const SURFACES = [
  { dir: 'antigravity-cli', source: 'cli' },
  { dir: 'antigravity-ide', source: 'ide' },
  { dir: 'antigravity', source: 'desktop' },
]
const surfaceBySource = (s) => SURFACES.find((x) => x.source === s) || null

// `not_fully_idle` is left set when an app quits mid-run, so it only means "working" this soon.
const RUNNING_WINDOW_MS = 15 * 60 * 1000
const TEXT_MAX = 8000
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s)
const str = (v) => (typeof v === 'string' ? v : '')

/**
 * A timestamp in whatever unit a summary row uses: seconds, milliseconds, microseconds, or text.
 * Anything under 1e11 is seconds (1e11 ms is 1973); anything over 1e14 is microseconds.
 */
export function epochMs(v) {
  const n = typeof v === 'string' && !/^\d+(\.\d+)?$/.test(v) ? Date.parse(v) : num(v)
  if (!Number.isFinite(n) || n <= 0) return 0
  if (n < 1e11) return Math.round(n * 1000)
  if (n > 1e14) return Math.round(n / 1000)
  return n
}

/** The first local folder in a summary's `workspace_uris`, a JSON array of `file://` URIs. */
export function workspaceOf(raw) {
  let list = raw
  if (typeof raw === 'string') {
    try {
      list = JSON.parse(raw)
    } catch {
      list = [raw]
    }
  }
  for (const u of Array.isArray(list) ? list : []) {
    const p = fileUriToPath(typeof u === 'string' ? u : u?.uri)
    if (p) return p
  }
  return ''
}

/**
 * @param {{ home?: string, env?: object, platform?: string, now?: () => number, agyPath?: string|null }} [opts]
 */
export function createAntigravityAdapter(opts = {}) {
  const home = opts.home ?? os.homedir()
  const env = opts.env ?? process.env
  const platform = opts.platform ?? process.platform
  const now = opts.now ?? Date.now
  const gemini = path.join(home, '.gemini')
  const ideUserDir = editorUserDir('Antigravity IDE', { home, env, platform })
  const cache = new Map() // summaries db → { key, rows }

  const agyExe = () => (opts.agyPath !== undefined ? opts.agyPath : findExe('agy', { home, env, platform, dirs: [path.join(home, '.local', 'bin')] }))
  const ideInstalled = async () => Boolean(ideUserDir) && (await exists(ideUserDir))

  async function detect() {
    for (const s of SURFACES) if (await exists(path.join(gemini, s.dir))) return true
    return (await ideInstalled()) || Boolean(await agyExe())
  }

  async function mtimeKey(file) {
    try {
      const st = await fsp.stat(file)
      return `${st.mtimeMs}:${st.size}`
    } catch {
      return ''
    }
  }

  /** Every summary row of one app, re-read only when the database (or its WAL) changed. */
  async function summaries(root) {
    const db = path.join(root, 'conversation_summaries.db')
    const key = `${await mtimeKey(db)}|${await mtimeKey(`${db}-wal`)}`
    if (key.startsWith('|')) return []
    const hit = cache.get(db)
    if (hit?.key === key) return hit.rows
    const rows = await queryAll(db, 'SELECT * FROM conversation_summaries')
    if (rows === null) return hit?.rows || []
    cache.set(db, { key, rows })
    return rows
  }

  async function scanThreads() {
    const t = now()
    const [ide, agy] = [await ideInstalled(), await agyExe()]
    const out = []
    for (const s of SURFACES) {
      for (const r of await summaries(path.join(gemini, s.dir))) {
        const id = r.conversation_id
        if (!isId(id)) continue
        // A subagent's conversation belongs to its parent's villager.
        if (num(r.nesting_depth) > 0) continue
        const folder = workspaceOf(r.workspace_uris)
        if (!folder) continue
        const at = epochMs(r.last_modified_time)
        const idle = !num(r.not_fully_idle) || Boolean(num(r.killed))
        const running = !idle && t - at < RUNNING_WINDOW_MS
        // Only the CLI resumes a conversation by id; the apps' histories aren't shared with it.
        const opensIn = s.source === 'cli' && agy ? 'Terminal' : ide ? 'Antigravity IDE' : ''
        out.push(makeThread(HARNESS_ID, NAME, {
          sessionId: id,
          title: str(r.title).trim(),
          preview: str(r.preview).replace(/\s+/g, ' ').trim().slice(0, 300),
          projectPath: folder,
          createdAt: epochMs(r.created_time) || at,
          lastActivityAt: at,
          running,
          unread: num(r.step_count) > 0 && idle && !num(r.killed),
          source: s.source,
          opensIn,
          ref: { conversationId: id, source: s.source, folder },
        }))
      }
    }
    return out
  }

  async function openThread(ref) {
    const r = ref && typeof ref === 'object' ? ref : {}
    if (!isId(r.conversationId) || !surfaceBySource(r.source) || typeof r.folder !== 'string' || !path.isAbsolute(r.folder)) {
      return { ok: false, error: 'This conversation has nothing Antigravity can open.' }
    }
    const exe = r.source === 'cli' ? await agyExe() : null
    if (exe) return { ok: true, where: 'a terminal', terminal: { exe, args: ['--conversation', r.conversationId], cwd: r.folder } }
    if (await ideInstalled()) {
      return { ok: true, where: 'Antigravity IDE', url: folderUrl('antigravity-ide', r.folder), note: 'Opening the folder in Antigravity IDE. The conversation is in its Agent Manager.' }
    }
    return { ok: false, error: 'Install Antigravity IDE or the agy CLI to open this conversation.' }
  }

  /** Only the CLI keeps a readable transcript; the apps' conversations are encrypted. */
  async function readTranscript(ref, { limit = 300 } = {}) {
    const r = ref && typeof ref === 'object' ? ref : {}
    const s = surfaceBySource(r.source)
    if (!isId(r.conversationId) || !s) return { ok: false, error: 'This conversation has no transcript on this machine.' }
    const logs = path.join(gemini, s.dir, 'brain', r.conversationId, '.system_generated', 'logs')
    let text = null
    for (const f of ['transcript_full.jsonl', 'transcript.jsonl']) {
      text = await fsp.readFile(path.join(logs, f), 'utf8').catch(() => null)
      if (text !== null) break
    }
    if (text === null) return { ok: false, error: "Antigravity keeps this conversation encrypted, so there's no transcript to show." }
    const messages = stepMessages(jsonLines(text))
    const n = Math.max(1, Math.min(2000, Number(limit) || 300))
    return { ok: true, messages: messages.slice(-n), total: messages.length }
  }

  async function targets() {
    const out = []
    if (await ideInstalled()) out.push({ id: 'ide', label: 'Antigravity IDE', note: 'Opens the folder in Antigravity IDE; your prompt goes on the clipboard to paste into the agent.' })
    if (await agyExe()) out.push({ id: 'terminal', label: 'Terminal', note: `Opens a terminal in the folder running agy${platform === 'win32' ? '; your prompt goes on the clipboard' : ', starting on your prompt'}.` })
    return out
  }

  async function newSession(dir, { target = '', prompt = '' } = {}) {
    if (typeof dir !== 'string' || !path.isAbsolute(dir)) return { ok: false, error: 'Not an absolute folder.' }
    if (target === 'terminal') {
      const exe = await agyExe()
      if (!exe) return { ok: false, error: "Couldn't find the agy command." }
      const text = typeof prompt === 'string' ? prompt.trim().slice(0, 20000) : ''
      // `-i <prompt>` starts the interactive CLI already working on it.
      return { ok: true, where: 'a terminal', terminal: { exe, args: [], promptArgs: ['-i'], cwd: dir, prompt: text } }
    }
    if (target === 'ide') return { ok: true, where: 'Antigravity IDE', url: folderUrl('antigravity-ide', dir) }
    return { ok: false, error: 'Unknown place to start a session.' }
  }

  return { id: HARNESS_ID, name: NAME, detect, scanThreads, openThread, newSession, targets, readTranscript }
}

// Steps that are bookkeeping rather than conversation.
const HIDDEN_STEPS = new Set(['CONVERSATION_HISTORY', 'SYSTEM_MESSAGE', 'CHECKPOINT'])

/** The CLI transcript's steps in the transcript panel's shape. Your prompt is wrapped in `<USER_REQUEST>`. */
export function stepMessages(steps) {
  const out = []
  for (const s of steps) {
    if (!s || typeof s !== 'object' || HIDDEN_STEPS.has(s.type)) continue
    const at = Date.parse(s.created_at) || 0
    const content = str(s.content)
    if (s.type === 'USER_INPUT') {
      const m = /<USER_REQUEST>([\s\S]*?)<\/USER_REQUEST>/.exec(content)
      const text = (m ? m[1] : content).trim()
      if (text) out.push({ role: 'user', text: clip(text, TEXT_MAX), at })
    } else if (s.type === 'PLANNER_RESPONSE') {
      if (content.trim()) out.push({ role: 'assistant', text: clip(content.trim(), TEXT_MAX), at })
    } else if (typeof s.type === 'string' && s.type) {
      const detail = content.split('\n').find((l) => l.trim()) || ''
      out.push({ role: 'tool', name: s.type.toLowerCase().replace(/_/g, ' '), detail: clip(detail.trim(), 240), at })
    }
  }
  return out
}

export default createAntigravityAdapter()
