// Running a task with no window: `claude -p --resume <id> <prompt>`, detached, its output in a log
// under data/runs/ (the only place AgentVille writes). Nothing is run through a shell, and the
// prompt is one argv entry. A headless run cannot answer a permission prompt, so it stops at the
// first one; the transcript still updates, which is how the village sees it work.
import { spawn as nodeSpawn } from 'node:child_process'
import crypto from 'node:crypto'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { promptArg } from './terminal.mjs'

// Sessions with a run still going, so one conversation never has two processes answering it. The
// client's own check reads a scan that can be seconds old.
const running = new Set()

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
  // A .cmd/.bat launcher can't be executed without a shell, and no shell may see the prompt.
  if (platform === 'win32' && /\.(cmd|bat)$/i.test(exe)) return { ok: false, error: 'Background tasks need claude.exe; this install only has a .cmd launcher. Choose a terminal instead.' }
  const key = args.join(' ')
  if (running.has(key)) return { ok: false, error: 'A background task is already running in this conversation.' }
  const dir = path.join(dataDir, 'runs')
  await fsp.mkdir(dir, { recursive: true })
  const old = (await fsp.readdir(dir).catch(() => [])).filter((f) => f.endsWith('.log')).sort()
  for (const f of old.slice(0, Math.max(0, old.length - KEEP_LOGS + 1))) await fsp.rm(path.join(dir, f), { force: true })
  const log = path.join(dir, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}.log`)
  const fd = await fsp.open(log, 'a', 0o600)
  running.add(key)
  try {
    // The prompt is the last argument; `-p` is print mode, which exits when the reply is done.
    const child = spawn(exe, ['-p', ...args, promptArg(prompt)], { shell: false, detached: true, cwd, stdio: ['ignore', fd.fd, fd.fd], windowsHide: true })
    // Spawn failures (a missing binary, a bad folder) arrive as an event, after this returns.
    const started = await new Promise((resolve) => {
      if (typeof child.once !== 'function') return resolve(null)
      child.once('error', (err) => resolve(err))
      child.once('spawn', () => resolve(null))
    })
    if (started) {
      running.delete(key)
      return { ok: false, error: `Couldn't start Claude in the background: ${started.code || started.message}.` }
    }
    child.once?.('exit', () => running.delete(key))
    child.once?.('error', () => running.delete(key))
    child.unref?.()
  } catch (err) {
    running.delete(key)
    return { ok: false, error: `Couldn't start Claude in the background: ${err.message}.` }
  } finally {
    await fd.close()
  }
  return { ok: true, promptPassed: true, log }
}
