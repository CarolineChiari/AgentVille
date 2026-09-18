// The Cursor adapter, read-only. Cursor keeps every chat ("composer") in one SQLite database,
// `<Cursor user dir>/globalStorage/state.vscdb`, table `cursorDiskKV`:
//   composerData:<composerId>             the chat: name, times, status, model, message order
//   bubbleId:<composerId>:<bubbleId>      one message each
// Which folder a chat belongs to has moved between releases, so all four places are read:
//   ≥ 3.12   `workspaceIdentifier.uri.fsPath` inside composerData, and the `composerHeaders` table
//   3.0–3.11 the global ItemTable key `composer.composerHeaders`
//   ≤ 2.6    each workspace's ItemTable key `composer.composerData`, listing its chats
// A chat with no folder has no plot to stand on and is left out.
// The formats come from Cursor's published exporters (specstory's CURSORIDE-FORMAT.md,
// cursaves); this machine had no Cursor to check them against.
import os from 'node:os'
import path from 'node:path'
import fsp from 'node:fs/promises'
import { exists, num } from '../../lib/fsutil.mjs'
import { queryAll, readItem } from '../../lib/sqlite.mjs'
import { findExe } from '../../lib/which.mjs'
import { editorUserDir, editorWorkspaces, fileUriToPath, folderUrl } from '../vscode-family.mjs'
import { makeThread } from '../thread.mjs'

export const HARNESS_ID = 'cursor'
const NAME = 'Cursor'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isId = (v) => typeof v === 'string' && UUID_RE.test(v)

// Cursor's `unfinishedRunAt` is never cleared and a crashed run leaves `generatingBubbleIds`
// behind, so "generating" only counts while the chat has moved this recently.
const RUNNING_WINDOW_MS = 15 * 60 * 1000
// A prompt travels inside a URL handed to the OS; Windows' ShellExecute caps those near 2k chars.
export const PROMPT_MAX = 1800
const TEXT_MAX = 8000
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s)
const str = (v) => (typeof v === 'string' ? v : '')

/**
 * The fields of every chat, pulled out by SQLite so a multi-megabyte record is never handed to
 * JavaScript whole. `json_valid` first: one malformed row would otherwise fail the whole query.
 * The `;` bound is the character after `:`, so the range is exactly the `composerData:` keys.
 * Records from before 2025 hold their messages inline as `conversation`, hence the COALESCE.
 */
const COMPOSERS_SQL = `
  SELECT substr(key, 14) AS id,
    json_extract(v, '$.name') AS name,
    json_extract(v, '$.createdAt') AS createdAt,
    json_extract(v, '$.lastUpdatedAt') AS lastUpdatedAt,
    json_extract(v, '$.conversationCheckpointLastUpdatedAt') AS checkpointAt,
    json_extract(v, '$.status') AS status,
    json_extract(v, '$.modelConfig.modelName') AS model,
    json_extract(v, '$.isArchived') AS archived,
    json_extract(v, '$.subagentInfo.parentComposerId') AS parent,
    json_extract(v, '$.workspaceIdentifier.uri.fsPath') AS folder,
    json_array_length(v, '$.generatingBubbleIds') AS generating,
    json_extract(v, '$.fullConversationHeadersOnly[0].bubbleId') AS firstBubble,
    COALESCE(json_array_length(v, '$.fullConversationHeadersOnly'), json_array_length(v, '$.conversation')) AS bubbles
  FROM (SELECT key, CAST(value AS TEXT) AS v FROM cursorDiskKV WHERE key >= 'composerData:' AND key < 'composerData;')
  WHERE json_valid(v)`

/**
 * @param {{ home?: string, env?: object, platform?: string, now?: () => number, agentPath?: string|null }} [opts]
 */
export function createCursorAdapter(opts = {}) {
  const home = opts.home ?? os.homedir()
  const env = opts.env ?? process.env
  const platform = opts.platform ?? process.platform
  const now = opts.now ?? Date.now
  const userDir = editorUserDir('Cursor', { home, env, platform })
  const globalDb = userDir ? path.join(userDir, 'globalStorage', 'state.vscdb') : null

  let cache = null // { key, threads }
  const previews = new Map() // composerId → first prompt; a first message never changes
  const folders = new Map() // workspace db → { key, ids: string[] }

  const agentExe = () => (opts.agentPath !== undefined ? opts.agentPath : findExe('cursor-agent', { home, env, platform, dirs: [path.join(home, '.local', 'bin')] }))

  async function ideInstalled() {
    return Boolean(globalDb) && (await exists(globalDb))
  }

  async function detect() {
    return (await ideInstalled()) || Boolean(await agentExe())
  }

  async function mtimeKey(file) {
    try {
      const st = await fsp.stat(file)
      return `${st.mtimeMs}:${st.size}`
    } catch {
      return ''
    }
  }

  /** composerId → folder, from every place a Cursor release has kept it. Newest wins. */
  async function composerFolders() {
    const map = new Map()
    // ≤ 2.6: a workspace lists its own chats.
    for (const ws of await editorWorkspaces(userDir)) {
      const db = path.join(ws.dir, 'state.vscdb')
      const key = await mtimeKey(db)
      if (!key) continue
      let hit = folders.get(db)
      if (hit?.key !== key) {
        const data = await readItem(db, 'composer.composerData')
        const ids = (Array.isArray(data?.allComposers) ? data.allComposers : []).map((c) => c?.composerId).filter(isId)
        hit = { key, ids }
        folders.set(db, hit)
      }
      for (const id of hit.ids) map.set(id, ws.folder)
    }
    // 3.0–3.11: one index for all of them.
    const headers = await readItem(globalDb, 'composer.composerHeaders')
    for (const c of Array.isArray(headers?.allComposers) ? headers.allComposers : []) {
      const f = headerFolder(c?.workspaceIdentifier)
      if (isId(c?.composerId) && f) map.set(c.composerId, f)
    }
    // ≥ 3.12: the same index as a table. Absent before then, which reads as null.
    const rows = await queryAll(globalDb, `SELECT composerId AS id, json_extract(value, '$.workspaceIdentifier') AS ws FROM composerHeaders WHERE json_valid(value)`)
    for (const r of rows || []) {
      let w = null
      try {
        w = JSON.parse(r.ws)
      } catch {
        // No workspace recorded.
      }
      const f = headerFolder(w)
      if (isId(r.id) && f) map.set(r.id, f)
    }
    return map
  }

  async function firstPrompts(rows) {
    const want = rows.filter((r) => !previews.has(r.id) && typeof r.firstBubble === 'string' && r.firstBubble.length < 80)
    if (!want.length) return
    const keys = want.map((r) => `bubbleId:${r.id}:${r.firstBubble}`)
    // SQLite caps a statement's parameters; 500 at a time stays well inside every build's limit.
    for (let i = 0; i < keys.length; i += 500) {
      const chunk = keys.slice(i, i + 500)
      const got = await queryAll(globalDb, `SELECT key, json_extract(v, '$.text') AS text FROM (SELECT key, CAST(value AS TEXT) AS v FROM cursorDiskKV WHERE key IN (${chunk.map(() => '?').join(',')})) WHERE json_valid(v)`, chunk)
      for (const g of got || []) {
        const id = String(g.key).split(':')[1]
        previews.set(id, str(g.text).replace(/\s+/g, ' ').trim().slice(0, 300))
      }
    }
    for (const r of want) if (!previews.has(r.id)) previews.set(r.id, '')
  }

  async function scanThreads() {
    if (!(await ideInstalled())) return []
    const key = `${await mtimeKey(globalDb)}|${await mtimeKey(`${globalDb}-wal`)}`
    if (cache?.key === key) return refresh(cache.threads)
    const rows = await queryAll(globalDb, COMPOSERS_SQL)
    // Locked mid-write: the last good scan stands.
    if (rows === null) return cache ? refresh(cache.threads) : []
    const where = await composerFolders()
    const live = rows.filter((r) => isId(r.id) && !r.parent && num(r.bubbles) > 0)
    await firstPrompts(live)
    const threads = []
    for (const r of live) {
      const folder = pathOf(r.folder) || where.get(r.id)
      if (!folder) continue
      const lastAt = Math.max(num(r.lastUpdatedAt), num(r.checkpointAt)) || num(r.createdAt)
      threads.push({
        raw: { generating: num(r.generating) > 0 || r.status === 'generating', status: str(r.status) },
        thread: {
          sessionId: r.id,
          title: str(r.name).trim(),
          preview: previews.get(r.id) || '',
          projectPath: folder,
          model: str(r.model),
          createdAt: num(r.createdAt) || lastAt,
          lastActivityAt: lastAt,
          archived: r.archived === 1 || r.archived === true,
          source: 'ide',
          opensIn: 'Cursor',
          ref: { composerId: r.id, folder },
        },
      })
    }
    cache = { key, threads }
    return refresh(threads)
  }

  /** Running depends on the clock as well as the file, so it is worked out on every scan. */
  function refresh(list) {
    const t = now()
    return list.map(({ raw, thread }) => {
      const running = raw.generating && t - thread.lastActivityAt < RUNNING_WINDOW_MS
      return makeThread(HARNESS_ID, NAME, { ...thread, running, unread: raw.status === 'completed' })
    })
  }

  /** Cursor has no link to one chat; the folder's window brings back the chats it had open. */
  function openThread(ref) {
    const r = ref && typeof ref === 'object' ? ref : {}
    if (!isId(r.composerId) || typeof r.folder !== 'string' || !path.isAbsolute(r.folder)) return { ok: false, error: 'This chat has no folder to open.' }
    return { ok: true, where: 'Cursor', url: folderUrl('cursor', r.folder), note: "Opening the folder in Cursor. The chat is in Cursor's chat history there." }
  }

  async function readTranscript(ref, { limit = 300 } = {}) {
    const id = ref && typeof ref === 'object' ? ref.composerId : null
    if (!isId(id) || !(await ideInstalled())) return { ok: false, error: 'This chat has no transcript on this machine.' }
    const head = await queryAll(globalDb, `SELECT json_extract(v, '$.fullConversationHeadersOnly') AS h FROM (SELECT CAST(value AS TEXT) AS v FROM cursorDiskKV WHERE key = ?) WHERE json_valid(v)`, [`composerData:${id}`])
    let order = []
    try {
      order = JSON.parse(head?.[0]?.h || '[]').map((b) => b?.bubbleId).filter((b) => typeof b === 'string')
    } catch {
      // No message order recorded.
    }
    const rows = await queryAll(globalDb, `SELECT key, CAST(value AS TEXT) AS v FROM cursorDiskKV WHERE key >= ? AND key < ?`, [`bubbleId:${id}:`, `bubbleId:${id};`])
    if (!rows) return { ok: false, error: "Cursor's database is busy; try again in a moment." }
    const byId = new Map()
    for (const r of rows) {
      try {
        byId.set(String(r.key).slice(`bubbleId:${id}:`.length), JSON.parse(r.v))
      } catch {
        // Half-written message.
      }
    }
    const ids = order.length ? order : [...byId.keys()]
    const messages = bubbleMessages(ids.map((b) => byId.get(b)).filter(Boolean))
    const n = Math.max(1, Math.min(2000, Number(limit) || 300))
    return { ok: true, messages: messages.slice(-n), total: messages.length }
  }

  async function targets() {
    const out = []
    if (await ideInstalled()) out.push({ id: 'cursor', label: 'Cursor', note: 'Opens the folder in Cursor and fills in your prompt; Cursor asks you to confirm it before sending.' })
    if (await agentExe()) out.push({ id: 'terminal', label: 'Terminal', note: `Opens a terminal in the folder running the Cursor Agent CLI${platform === 'win32' ? '; your prompt goes on the clipboard' : ', starting on your prompt'}.` })
    return out
  }

  async function newSession(dir, { target = '', prompt = '' } = {}) {
    if (typeof dir !== 'string' || !path.isAbsolute(dir)) return { ok: false, error: 'Not an absolute folder.' }
    if (target === 'terminal') {
      const exe = await agentExe()
      if (!exe) return { ok: false, error: "Couldn't find the cursor-agent command." }
      const text = typeof prompt === 'string' ? prompt.trim().slice(0, 20000) : ''
      return { ok: true, where: 'a terminal', terminal: { exe, args: [], cwd: dir, prompt: text } }
    }
    if (target !== 'cursor') return { ok: false, error: 'Unknown place to start a session.' }
    const text = typeof prompt === 'string' ? prompt.trim().slice(0, PROMPT_MAX) : ''
    const folder = folderUrl('cursor', dir)
    if (!text) return { ok: true, where: 'Cursor', url: folder }
    // Cursor's documented prompt link: it fills the chat box and asks before sending.
    const ask = `cursor://anysphere.cursor-deeplink/prompt?${new URLSearchParams({ text })}`
    return { ok: true, where: 'Cursor', promptPassed: true, url: ask, urls: [folder, ask] }
  }

  return { id: HARNESS_ID, name: NAME, detect, scanThreads, openThread, newSession, targets, readTranscript }
}

/** `workspaceIdentifier` → folder. Cursor records `uri.fsPath`, and sometimes only `uri.external`. */
function headerFolder(w) {
  if (!w || typeof w !== 'object') return ''
  return pathOf(w.uri?.fsPath) || fileUriToPath(w.uri?.external) || ''
}

const pathOf = (p) => (typeof p === 'string' && (path.isAbsolute(p) || /^[A-Za-z]:[\\/]/.test(p)) ? p : '')

/**
 * Messages in the transcript panel's shape. `type` 1 is you, 2 is Cursor; a tool call rides on
 * an assistant bubble as `toolFormerData`.
 */
export function bubbleMessages(bubbles) {
  const out = []
  for (const b of bubbles) {
    if (!b || typeof b !== 'object') continue
    const at = num(b.createdAt) || Date.parse(b.createdAt) || 0
    const text = str(b.text).trim()
    if (b.type === 1) {
      if (text) out.push({ role: 'user', text: clip(text, TEXT_MAX), at })
      continue
    }
    if (b.toolFormerData && typeof b.toolFormerData === 'object') {
      const t = b.toolFormerData
      let detail = ''
      try {
        const p = typeof t.params === 'string' ? JSON.parse(t.params) : t.params || {}
        detail = str(p.command ?? p.targetFile ?? p.relativeWorkspacePath ?? p.query ?? p.pattern ?? '')
      } catch {
        // Unparsed parameters; the name alone will do.
      }
      out.push({ role: 'tool', name: str(t.name) || 'tool', detail: clip(detail.replace(/\s+/g, ' ').trim(), 240), at })
    }
    if (text) out.push({ role: 'assistant', text: clip(text, TEXT_MAX), at })
  }
  return out
}

export default createCursorAdapter()
