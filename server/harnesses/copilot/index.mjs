// The GitHub Copilot adapter. Two stores, both read-only:
//   VS Code chats   <VS Code user dir>/workspaceStorage/<hash>/chatSessions/<id>.jsonl (or .json),
//                   titled by the `chat.ChatSessionStore.index` key of that workspace's state.vscdb
//   CLI sessions    ~/.copilot/session-state/<id>/events.jsonl — the `copilot` CLI, and VS Code's
//                   background agents, which run it
import os from 'node:os'
import path from 'node:path'
import fsp from 'node:fs/promises'
import { exists, jsonLines, listDirs, listFiles, num, readHead, readJson, readTail } from '../../lib/fsutil.mjs'
import { readItem } from '../../lib/sqlite.mjs'
import { findExe } from '../../lib/which.mjs'
import { editorUserDir, editorWorkspaces, folderUrl } from '../vscode-family.mjs'
import { basename, makeThread } from '../thread.mjs'
import { STATE, chatMessages, foldChatLog, headMeta, lastTurn } from './chatlog.mjs'
import { eventMessages, eventsHeadMeta, eventsTail, yamlScalars } from './events.mjs'

export const HARNESS_ID = 'copilot'
const NAME = 'GitHub Copilot'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isId = (v) => typeof v === 'string' && UUID_RE.test(v)

/** The editors Copilot Chat lives in. The scheme is also the new-session target id. */
export const EDITORS = [
  { app: 'Code', scheme: 'vscode', label: 'VS Code' },
  { app: 'Code - Insiders', scheme: 'vscode-insiders', label: 'VS Code Insiders' },
]
const editorByScheme = (s) => EDITORS.find((e) => e.scheme === s) || null

// Enough of the head to reach the first request's text past the session's opening fields.
const HEAD_BYTES = 64 * 1024
// Enough of the tail to reach the newest request's state past a run of streamed response parts.
const TAIL_BYTES = 64 * 1024
// A response streams an op every few seconds, but one long tool call (a build, a test run) can go
// quiet for minutes. Past this, a request still marked pending was cut off, not working.
const RUNNING_WINDOW_MS = 10 * 60 * 1000
// VS Code rewrites "needs input" to complete when it next loads the chat, so a stored one is only
// trustworthy while the window may still be open on it. Half a day covers a question left over lunch.
const ASKING_WINDOW_MS = 12 * 60 * 60 * 1000
// A failed request is worth flagging the day it happens, not for ever after.
const ERROR_WINDOW_MS = 24 * 60 * 60 * 1000
const TRANSCRIPT_MAX_BYTES = 64 * 1024 * 1024

/**
 * @param {{ home?: string, env?: object, platform?: string, now?: () => number, copilotPath?: string|null }} [opts]
 */
export function createCopilotAdapter(opts = {}) {
  const home = opts.home ?? os.homedir()
  const env = opts.env ?? process.env
  const platform = opts.platform ?? process.platform
  const now = opts.now ?? Date.now
  const stateDir = path.join(home, '.copilot', 'session-state')
  const editors = EDITORS.map((e) => ({ ...e, userDir: editorUserDir(e.app, { home, env, platform }) })).filter((e) => e.userDir)

  const fileCache = new Map() // file → { key, info }
  const indexCache = new Map() // state.vscdb → { key, entries }
  const convoCache = new Map() // file → { key, messages }
  let lastFiles = new Map() // session id → { file, kind: 'chat'|'cli' } from the latest scan

  const copilotExe = () => (opts.copilotPath !== undefined ? opts.copilotPath : findExe('copilot', { home, env, platform, dirs: [path.join(home, '.local', 'bin')] }))

  /** Editors with Copilot Chat's own storage folder: installed, and Copilot has run in them. */
  async function editorsWithCopilot() {
    const out = []
    for (const e of editors) if (await exists(path.join(e.userDir, 'globalStorage', 'github.copilot-chat'))) out.push(e)
    return out
  }

  async function detect() {
    return (await editorsWithCopilot()).length > 0 || (await exists(stateDir))
  }

  async function statKey(file) {
    try {
      const st = await fsp.stat(file)
      return { key: `${st.mtimeMs}:${st.size}`, mtime: st.mtimeMs, size: st.size }
    } catch {
      return null
    }
  }

  /** A workspace's chat index, re-read only when its database (or the WAL beside it) changed. */
  async function chatIndex(wsDir) {
    const db = path.join(wsDir, 'state.vscdb')
    const [a, b] = await Promise.all([statKey(db), statKey(`${db}-wal`)])
    if (!a) return {}
    const key = `${a.key}|${b?.key || ''}`
    const hit = indexCache.get(db)
    if (hit?.key === key) return hit.entries
    const value = await readItem(db, 'chat.ChatSessionStore.index')
    // A locked database reads as null: keep the last good index rather than forgetting titles.
    if (value === null && hit) return hit.entries
    const entries = value && typeof value.entries === 'object' && value.entries ? value.entries : {}
    indexCache.set(db, { key, entries })
    return entries
  }

  async function chatFileInfo(file, st) {
    const hit = fileCache.get(file)
    if (hit?.key === st.key) return hit.info
    const legacy = file.endsWith('.json')
    const head = headMeta(await readHead(file, HEAD_BYTES))
    // The old whole-object `.json` files predate 2026 and are never live; their head is enough.
    const turn = legacy ? null : lastTurn(jsonLines(await readTail(file, TAIL_BYTES)))
    const info = { head, turn, legacy }
    fileCache.set(file, { key: st.key, info })
    return info
  }

  async function scanChats(files) {
    const out = []
    const t = now()
    for (const ed of await editorsWithCopilot()) {
      for (const ws of await editorWorkspaces(ed.userDir)) {
        const dir = path.join(ws.dir, 'chatSessions')
        const names = await listFiles(dir, (n) => n.endsWith('.jsonl') || n.endsWith('.json'))
        if (!names.length) continue
        const index = await chatIndex(ws.dir)
        for (const n of names) {
          const id = n.replace(/\.jsonl?$/, '')
          if (!isId(id)) continue
          const file = path.join(dir, n)
          const st = await statKey(file)
          if (!st) continue
          const idx = index[id] && typeof index[id] === 'object' ? index[id] : null
          if (idx?.isEmpty === true) continue
          const info = await chatFileInfo(file, st)
          // A chat panel opened and never used: no index entry, no prompt, no request.
          if (!idx && !info.head.firstPrompt && !info.turn) continue
          // A .jsonl and a leftover .json of one session: the newer file wins.
          const prev = files.get(id)
          if (prev && prev.mtime >= st.mtime) continue
          files.set(id, { file, kind: 'chat', mtime: st.mtime })

          const state = info.turn?.state ?? (Number.isInteger(idx?.lastResponseState) ? idx.lastResponseState : info.legacy ? STATE.COMPLETE : null)
          let activity = Math.max(num(idx?.lastMessageDate), num(idx?.timing?.lastRequestEnded), info.turn?.at || 0)
          // Typing in the input box rewrites the file too; that is not the agent doing anything.
          if (!activity || state === STATE.PENDING) activity = Math.max(activity, st.mtime)
          const sinceWrite = t - st.mtime
          const running = state === STATE.PENDING && sinceWrite < RUNNING_WINDOW_MS
          const needsInput = state === STATE.NEEDS_INPUT && sinceWrite < ASKING_WINDOW_MS ? (info.turn?.asking ? 'question' : 'permission prompt') : ''
          out.push(thread({
            sessionId: id,
            title: (typeof idx?.title === 'string' && idx.title.trim()) || info.turn?.title || info.head.firstPrompt,
            preview: info.head.firstPrompt,
            projectPath: ws.folder,
            cwd: typeof idx?.workingDirectory === 'string' && path.isAbsolute(idx.workingDirectory) ? idx.workingDirectory : ws.folder,
            model: info.turn?.model || info.head.model,
            createdAt: num(idx?.timing?.created) || info.head.createdAt || st.mtime,
            lastActivityAt: activity,
            running,
            needsInput,
            // Finished its turn: ready for review until you mark it seen.
            unread: Boolean(needsInput) || state === STATE.COMPLETE,
            hasError: state === STATE.FAILED && t - activity < ERROR_WINDOW_MS,
            sizeBytes: st.size,
            source: ed.scheme,
            opensIn: ed.label,
            ref: { kind: 'chat', sessionId: id, editor: ed.scheme, folder: ws.folder },
          }))
        }
      }
    }
    return out
  }

  async function cliInfo(dir, file, st) {
    const hit = fileCache.get(file)
    if (hit?.key === st.key) return hit.info
    const [head, tail, meta, yaml] = await Promise.all([
      readHead(file, HEAD_BYTES).then((s) => eventsHeadMeta(jsonLines(s))),
      readTail(file, TAIL_BYTES).then((s) => eventsTail(jsonLines(s))),
      readJson(path.join(dir, 'vscode.metadata.json')),
      fsp.readFile(path.join(dir, 'workspace.yaml'), 'utf8').then(yamlScalars, () => ({})),
    ])
    const info = { head, tail, worktree: meta?.worktreeProperties && typeof meta.worktreeProperties === 'object' ? meta.worktreeProperties : null, yaml }
    fileCache.set(file, { key: st.key, info })
    return info
  }

  async function scanCli(files, exe) {
    const out = []
    const t = now()
    for (const id of await listDirs(stateDir)) {
      if (!isId(id)) continue
      const dir = path.join(stateDir, id)
      const file = path.join(dir, 'events.jsonl')
      const st = await statKey(file)
      if (!st) continue
      const { head, tail, worktree, yaml } = await cliInfo(dir, file, st)
      const str = (v) => (typeof v === 'string' && v ? v : '')
      const cwd = str(worktree?.worktreePath) || str(yaml.cwd) || head.cwd
      const repo = str(worktree?.repositoryPath) || str(yaml.git_root) || head.gitRoot || cwd
      if (!cwd || !path.isAbsolute(cwd)) continue
      // Launched and left before the first prompt: nothing happened here.
      if (!head.firstPrompt && t - st.mtime > RUNNING_WINDOW_MS) continue
      files.set(id, { file, kind: 'cli', mtime: st.mtime })
      const running = Boolean(tail && !tail.turnOver) && t - st.mtime < RUNNING_WINDOW_MS
      const fromVsCode = Boolean(worktree)
      out.push(thread({
        sessionId: id,
        title: str(yaml.summary) || str(yaml.name) || head.firstPrompt,
        preview: head.firstPrompt,
        projectPath: repo,
        cwd,
        worktree: worktree?.worktreePath ? basename(worktree.worktreePath) : '',
        gitBranch: str(worktree?.branchName) || tail?.branch || str(yaml.branch) || head.branch,
        model: head.model,
        createdAt: head.createdAt || st.mtime,
        lastActivityAt: Math.max(tail?.at || 0, st.mtime),
        running,
        needsInput: '',
        unread: Boolean(tail?.finished),
        hasError: false,
        sizeBytes: st.size,
        source: fromVsCode ? 'vscode-agent' : 'cli',
        opensIn: exe ? 'Terminal' : fromVsCode ? 'VS Code' : '',
        ref: { kind: 'cli', sessionId: id, cwd },
      }))
    }
    return out
  }

  const thread = (f) => makeThread(HARNESS_ID, NAME, f)

  async function scanThreads() {
    const files = new Map()
    const exe = await copilotExe()
    const [chats, cli] = [await scanChats(files), await scanCli(files, exe)]
    lastFiles = files
    return [...chats, ...cli]
  }

  /**
   * VS Code has no link to one chat, so the folder opens and the chat is in its history. A CLI
   * session resumes in a terminal when the CLI is installed; a background agent without it
   * opens its worktree in VS Code, where the Agent Sessions view lists it.
   */
  async function openThread(ref) {
    const r = ref && typeof ref === 'object' ? ref : {}
    if (r.kind === 'chat') {
      const ed = editorByScheme(r.editor)
      if (!ed || typeof r.folder !== 'string' || !path.isAbsolute(r.folder)) return { ok: false, error: 'This chat has no folder to open.' }
      return { ok: true, where: ed.label, url: folderUrl(ed.scheme, r.folder), note: `Opening the folder in ${ed.label}. The chat is in Copilot's chat history there.` }
    }
    if (r.kind === 'cli' && isId(r.sessionId) && typeof r.cwd === 'string' && path.isAbsolute(r.cwd)) {
      const exe = await copilotExe()
      if (exe) return { ok: true, where: 'a terminal', terminal: { exe, args: [`--resume=${r.sessionId}`], cwd: r.cwd } }
      const ed = (await editorsWithCopilot())[0]
      if (ed) return { ok: true, where: ed.label, url: folderUrl(ed.scheme, r.cwd), note: `Opening the worktree in ${ed.label}. The session is in its Agent Sessions view.` }
      return { ok: false, error: 'Install the Copilot CLI to resume this session.' }
    }
    return { ok: false, error: 'This thread has nothing Copilot can open.' }
  }

  /** The conversation of one thread, found among the files the scan listed — the page never names a file. */
  async function readTranscript(ref, { limit = 300 } = {}) {
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
      const text = await fsp.readFile(f.file, 'utf8')
      let messages
      if (f.kind === 'cli') messages = eventMessages(jsonLines(text))
      else if (f.file.endsWith('.json')) {
        let session = null
        try {
          session = JSON.parse(text)
        } catch {
          // Half-written; shows as empty until the next save.
        }
        messages = chatMessages(session)
      } else messages = chatMessages(foldChatLog(jsonLines(text)))
      hit = { key: st.key, messages }
      convoCache.delete(f.file)
      convoCache.set(f.file, hit)
      while (convoCache.size > 6) convoCache.delete(convoCache.keys().next().value)
    }
    const n = Math.max(1, Math.min(2000, Number(limit) || 300))
    return { ok: true, messages: hit.messages.slice(-n), total: hit.messages.length, updatedAt: st.mtime, sizeBytes: st.size }
  }

  /**
   * Where a new session can start here: each VS Code that has Copilot Chat, and a terminal when
   * the `copilot` CLI is installed. VS Code has no link that starts a chat, so there the folder
   * opens and the prompt goes on the clipboard.
   */
  async function targets() {
    const out = (await editorsWithCopilot()).map((e) => ({
      id: e.scheme,
      label: e.label,
      note: `Opens the folder in ${e.label}; your prompt goes on the clipboard to paste into Copilot Chat.`,
    }))
    if (await copilotExe()) {
      out.push({ id: 'terminal', label: 'Terminal', note: `Opens a terminal in the folder running the Copilot CLI${platform === 'win32' ? '; your prompt goes on the clipboard' : ', starting on your prompt'}.` })
    }
    return out
  }

  async function newSession(dir, { target = '', prompt = '' } = {}) {
    if (typeof dir !== 'string' || !path.isAbsolute(dir)) return { ok: false, error: 'Not an absolute folder.' }
    if (target === 'terminal') {
      const exe = await copilotExe()
      if (!exe) return { ok: false, error: "Couldn't find the copilot command." }
      const text = typeof prompt === 'string' ? prompt.trim().slice(0, 20000) : ''
      // `-i <prompt>` starts the interactive CLI already working on it.
      return { ok: true, where: 'a terminal', terminal: { exe, args: [], promptArgs: ['-i'], cwd: dir, prompt: text } }
    }
    const ed = editorByScheme(target)
    if (!ed) return { ok: false, error: 'Unknown place to start a session.' }
    return { ok: true, where: ed.label, url: folderUrl(ed.scheme, dir) }
  }

  return { id: HARNESS_ID, name: NAME, detect, scanThreads, openThread, newSession, targets, readTranscript }
}

export default createCopilotAdapter()
