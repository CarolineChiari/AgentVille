// Builders for a fake home directory holding Claude Code's three stores.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export function tmpHome() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agentville-'))
  return { home, cleanup: () => fs.rmSync(home, { recursive: true, force: true }) }
}

export const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

export function encodeCwd(cwd) {
  return cwd.replace(/[\\/:_.]/g, '-')
}

export const userRecord = (text, extra = {}) => ({
  type: 'user',
  isSidechain: false,
  message: { role: 'user', content: text },
  timestamp: '2026-09-01T10:00:00.000Z',
  cwd: '/work/repo',
  gitBranch: 'main',
  ...extra,
})

export const assistantRecord = (content, extra = {}) => ({
  type: 'assistant',
  isSidechain: false,
  message: { role: 'assistant', model: 'claude-test', content, stop_reason: 'end_turn' },
  timestamp: '2026-09-01T10:00:05.000Z',
  cwd: '/work/repo',
  ...extra,
})

export const toolUse = () => [{ type: 'tool_use', id: 't1', name: 'Bash', input: {} }]
export const text = (t) => [{ type: 'text', text: t }]

/** Write a CLI transcript and return its path. `mtime` in epoch ms. */
export function writeTranscript(home, { id, cwd = '/work/repo', records, mtime }) {
  const dir = path.join(home, '.claude', 'projects', encodeCwd(cwd))
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, `${id}.jsonl`)
  fs.writeFileSync(file, records.map((r) => JSON.stringify(r)).join('\n') + '\n')
  if (mtime) fs.utimesSync(file, mtime / 1000, mtime / 1000)
  return file
}

export function writeLive(home, { pid, sessionId, cwd = '/work/repo' }) {
  const dir = path.join(home, '.claude', 'sessions')
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, `${pid}.json`), JSON.stringify({ pid, sessionId, cwd, status: 'busy' }))
}

/** A desktop record under the macOS userData layout. */
export function writeDesktop(home, record) {
  const dir = path.join(home, 'Library', 'Application Support', 'Claude', 'claude-code-sessions', 'acct', 'org')
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, `${record.sessionId}.json`), JSON.stringify(record))
}

/** A pid that is certainly not running: spawn-and-reap would race, so use a huge one. */
export const DEAD_PID = 2 ** 22 - 3
