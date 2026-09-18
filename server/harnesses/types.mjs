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
 * @property {boolean} hasError
 * @property {string}  prState         `'MERGED'` triggers the celebration
 * @property {boolean} archived        Archived in the harness's own records (read-only)
 * @property {number}  sizeBytes       Transcript size in bytes
 * @property {string}  source          Free-form bookkeeping (`'desktop'` / `'cli'`)
 * @property {boolean} canOpen
 * @property {object}  ref             Opaque; handed straight back on open
 *
 * @typedef {object} HarnessAdapter
 * @property {string} id                                   Stable kebab-case key
 * @property {string} name                                 Shown in the UI
 * @property {() => Promise<boolean>} detect               Cheap: runs on every scan
 * @property {() => Promise<Thread[]>} scanThreads         Throwing costs only this harness's threads
 * @property {(ref: object) => OpenResult | Promise<OpenResult>} openThread
 * @property {(dir: string) => OpenResult | Promise<OpenResult>} newSession
 *
 * @typedef {{ ok: true, url: string, note?: string } | { ok: false, error: string }} OpenResult
 */

export const THREAD_FIELDS = [
  'id', 'harness', 'harnessName', 'title', 'preview', 'project', 'projectPath', 'worktree', 'cwd',
  'gitBranch', 'model', 'effort', 'createdAt', 'lastActivityAt', 'lastFocusedAt', 'running', 'unread',
  'hasError', 'prState', 'archived', 'sizeBytes', 'source', 'canOpen', 'ref',
]
