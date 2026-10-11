// Running a task with no window: `claude -p --resume <id> <prompt>`, detached, its output in a log
// under data/runs/ (the only place AgentVille writes). Nothing is run through a shell, and the
// prompt is one argv entry. A headless run cannot answer a permission prompt, so it stops at the
// first one; the transcript still updates, which is how the village sees it work.
import { spawn as nodeSpawn } from 'node:child_process'
import crypto from 'node:crypto'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { promptArg } from './terminal.mjs'

// Old logs are swept on each run so the folder can't grow without bound.
const KEEP_LOGS = 20

/**
 * @param {{ exe: string, args: string[], cwd: string, prompt: string }} spec
 * @param {{ dataDir: string, platform?: string, spawn?: Function }} opts
 * @returns {Promise<{ ok: true, promptPassed: true, log: string } | { ok: false, error: string }>}
 */
export async function runInBackground(spec, { dataDir, platform = process.platform, spawn = nodeSpawn }) {
  const { exe, args, cwd } = spec
  const prompt = typeof spec.prompt === 'string' ? spec.prompt : ''
  const P = platform === 'win32' ? path.win32 : path.posix
  if (!prompt.trim()) return { ok: false, error: 'Nothing to send.' }
  if (!P.isAbsolute(exe) || !P.isAbsolute(cwd)) return { ok: false, error: 'Needs absolute paths.' }
  const dir = path.join(dataDir, 'runs')
  await fsp.mkdir(dir, { recursive: true })
  const old = (await fsp.readdir(dir).catch(() => [])).filter((f) => f.endsWith('.log')).sort()
  for (const f of old.slice(0, Math.max(0, old.length - KEEP_LOGS + 1))) await fsp.rm(path.join(dir, f), { force: true })
  const log = path.join(dir, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}.log`)
  const fd = await fsp.open(log, 'a', 0o600)
  try {
    // The prompt is the last argument; `-p` is print mode, which exits when the reply is done.
    const child = spawn(exe, ['-p', ...args, promptArg(prompt)], { shell: false, detached: true, cwd, stdio: ['ignore', fd.fd, fd.fd], windowsHide: true })
    child.on?.('error', () => {})
    child.unref?.()
  } finally {
    await fd.close()
  }
  return { ok: true, promptPassed: true, log }
}
