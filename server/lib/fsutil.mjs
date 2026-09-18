// Read-only filesystem helpers shared by the harness adapters. Nothing in here writes.
import fsp from 'node:fs/promises'
import path from 'node:path'

/**
 * First `bytes` of a file, minus a trailing partial line when the file is longer than that.
 * Slicing bytes can also cut a multibyte character in half; dropping the partial line drops
 * that too, so JSON.parse never sees either.
 */
export async function readHead(file, bytes) {
  const fh = await fsp.open(file, 'r')
  try {
    const stat = await fh.stat()
    const len = Math.min(bytes, stat.size)
    const buf = Buffer.allocUnsafe(len)
    const { bytesRead } = await fh.read(buf, 0, len, 0)
    let text = buf.subarray(0, bytesRead).toString('utf8')
    if (bytesRead < stat.size) {
      const nl = text.lastIndexOf('\n')
      text = nl >= 0 ? text.slice(0, nl + 1) : ''
    }
    return text
  } finally {
    await fh.close()
  }
}

/** Last `bytes` of a file, minus a leading partial line when the file is longer than that. */
export async function readTail(file, bytes) {
  const fh = await fsp.open(file, 'r')
  try {
    const stat = await fh.stat()
    const start = Math.max(0, stat.size - bytes)
    const len = stat.size - start
    const buf = Buffer.allocUnsafe(len)
    const { bytesRead } = await fh.read(buf, 0, len, start)
    let text = buf.subarray(0, bytesRead).toString('utf8')
    if (start > 0) {
      const nl = text.indexOf('\n')
      text = nl >= 0 ? text.slice(nl + 1) : ''
    }
    return text
  } finally {
    await fh.close()
  }
}

/** Parse JSONL leniently: blank, CRLF and half-written lines are skipped, never thrown on. */
export function jsonLines(text) {
  const out = []
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line) continue
    try {
      out.push(JSON.parse(line))
    } catch {
      // A record being written right now is a normal thing to trip over.
    }
  }
  return out
}

/** Names of the subdirectories of `dir`; [] when it does not exist. */
export async function listDirs(dir) {
  try {
    const entries = await fsp.readdir(dir, { withFileTypes: true })
    return entries.filter((e) => e.isDirectory()).map((e) => e.name)
  } catch {
    return []
  }
}

/** Names of the regular files in `dir`, optionally filtered; [] when it does not exist. */
export async function listFiles(dir, predicate = () => true) {
  try {
    const entries = await fsp.readdir(dir, { withFileTypes: true })
    return entries.filter((e) => e.isFile() && predicate(e.name)).map((e) => e.name)
  } catch {
    return []
  }
}

export async function exists(p) {
  try {
    await fsp.access(p)
    return true
  } catch {
    return false
  }
}

export async function readJson(file) {
  try {
    return JSON.parse(await fsp.readFile(file, 'utf8'))
  } catch {
    return null
  }
}

/** Coerce to a finite number, else `fallback`. Timestamps in session files are not always numbers. */
export function num(v, fallback = 0) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : fallback
  if (typeof v === 'string' && v.trim()) {
    const n = Number(v)
    if (Number.isFinite(n)) return n
    const t = Date.parse(v)
    if (Number.isFinite(t)) return t
  }
  return fallback
}

/**
 * Is a process with this pid alive? Signal 0 tests existence only and works on macOS, Linux and
 * Windows with no subprocess. EPERM means it exists but belongs to someone else — still alive.
 */
export function isAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (err) {
    return err?.code === 'EPERM'
  }
}

export { path }
