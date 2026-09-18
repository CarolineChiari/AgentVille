/**
 * The contract between a harness adapter and everything else. `server/scan.mjs`, `server/api.mjs`
 * and the whole of `src/` are written against these shapes and never against a harness.
 *
 * @typedef {object} Thread
 * @property {string}  id              Unique across every harness: `<harness>:<session id>`
 * @property {string}  harness         Adapter id
 * @property {string}  harnessName     Adapter display name
 * @property {string}  title           `'Untitled'` when the harness has none
 * @property {string}  preview         First prompt, trimmed
 * @property {string}  project         Repo/folder *name*. This is what claims a plot
 * @property {string}  projectPath     Absolute path to the repo root
 * @property {string}  worktree        Worktree name, or `''`
 * @property {string}  cwd             Where the thread is actually working
 * @property {string}  gitBranch
 * @property {string}  model
 * @property {string}  effort
 * @property {number}  createdAt       Epoch ms
 * @property {number}  lastActivityAt  Epoch ms. Sorts the village, drives the "asleep" state
 * @property {number}  lastFocusedAt   Epoch ms, 0 if unknowable
 * @property {boolean} running         Working right now
 * @property {boolean} unread          Moved on since you last looked
 * @property {string}  needsInput      Stopped on the person right now: 'dialog open', 'permission prompt', … or ''
 * @property {boolean} hasError
 * @property {string}  prState         `'MERGED'` triggers the celebration
 * @property {number}  prNumber        The PR this thread opened or linked, 0 if none
 * @property {string}  prUrl           Its https://github.com/… URL, or ''
 * @property {boolean} archived        Archived in the harness's own records (read-only)
 * @property {number}  sizeBytes       Transcript size in bytes
 * @property {string}  source          Free-form bookkeeping (`'desktop'` / `'cli'`)
 * @property {boolean} canOpen
 * @property {string}  opensIn         Where Open always goes ('VS Code', 'Cursor'), or '' when it
 *                                     follows the person's Open-in setting
 * @property {object}  ref             Opaque; handed straight back on open
 *
 * @typedef {object} HarnessAdapter
 * @property {string} id                                   Stable kebab-case key
 * @property {string} name                                 Shown in the UI
 * @property {() => Promise<boolean>} detect               Cheap: runs on every scan
 * @property {() => Promise<Thread[]>} scanThreads         Throwing costs only this harness's threads
 * @property {(ref: object, opts?: { target?: 'app' | 'vscode' }) => OpenResult | Promise<OpenResult>} openThread
 *           `target` is the person's Open-in preference; a harness with only one place ignores it.
 * @property {(dir: string, opts?: { target?: string, prompt?: string, model?: string, effort?: string }) => OpenResult | Promise<OpenResult>} newSession
 * @property {() => Promise<Target[]>} targets             Where a new session can start *on this machine*
 *
 * @property {(ref: object, opts?: { limit?: number }) => Promise<{ ok: boolean, messages?: object[], error?: string }>} [readTranscript]
 *           Optional: the conversation, for the transcript panel.
 *
 * One way to start a session. `models` / `efforts`, when present, are `[value, label]` menus the
 * form offers for this target only; '' means the harness's own default.
 * @typedef {{ id: string, label: string, note: string, models?: string[][], efforts?: string[][] }} Target
 *
 * `urls`, when present, are opened in order with a short pause between them. `terminal` instead
 * asks for a terminal window running `exe` (see server/terminal.mjs). `where` finishes the
 * sentence "Opening … in"; `promptPassed` says the prompt travelled with it, so the page need
 * not put it on the clipboard.
 * @typedef {{ ok: true, url?: string, urls?: string[], terminal?: object, where?: string, promptPassed?: boolean, note?: string } | { ok: false, error: string }} OpenResult
 */

export const THREAD_FIELDS = [
  'id', 'harness', 'harnessName', 'title', 'preview', 'project', 'projectPath', 'worktree', 'cwd',
  'gitBranch', 'model', 'effort', 'createdAt', 'lastActivityAt', 'lastFocusedAt', 'running', 'unread',
  'hasError', 'prState', 'prNumber', 'prUrl', 'archived', 'sizeBytes', 'source', 'canOpen', 'opensIn', 'ref',
]
