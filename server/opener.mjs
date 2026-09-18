// Handing a URL or a folder to the OS. This is the only place AgentVille starts a process.
import { spawn as nodeSpawn } from 'node:child_process'
import fsp from 'node:fs/promises'
import path from 'node:path'

/**
 * Windows goes through ShellExecute via rundll32. Two tempting alternatives are both broken:
 * `explorer.exe <url>` silently drops URLs with a query string (so `code/new?folder=…` never
 * arrives), and `cmd /c start` expands the `%3A%5C` escapes in that same link.
 */
const URL_OPENERS = {
  darwin: ['open'],
  win32: ['rundll32', 'url.dll,FileProtocolHandler'],
  linux: ['xdg-open'],
}
const FOLDER_OPENERS = {
  darwin: ['open'],
  win32: ['explorer'],
  linux: ['xdg-open'],
}

export function commandFor(kind, target, platform = process.platform) {
  const table = kind === 'folder' ? FOLDER_OPENERS : URL_OPENERS
  const base = table[platform]
  if (!base) return null
  return { cmd: base[0], args: [...base.slice(1), target] }
}

/**
 * @param {{ spawn?: Function, platform?: string }} [opts] injectable for tests
 */
export function createOpener({ spawn = nodeSpawn, platform = process.platform } = {}) {
  function run(kind, target) {
    const c = commandFor(kind, target, platform)
    if (!c) return { ok: false, error: `Opening things is not supported on ${platform}.` }
    try {
      // An argv array and no shell: nothing in `target` is ever interpreted.
      const child = spawn(c.cmd, c.args, { shell: false, detached: true, stdio: 'ignore', windowsHide: true })
      // An unhandled 'error' event on a child would take the whole server down.
      child.on?.('error', () => {})
      child.unref?.()
      return { ok: true }
    } catch (err) {
      return { ok: false, error: String(err?.message || err) }
    }
  }
  return {
    platform,
    launch: (url) => run('url', url),
    reveal: (dir) => run('folder', dir),
  }
}

/**
 * The page's scan may be minutes old. A folder that has moved or gone fails here, not at the OS.
 * `path.isAbsolute`, not a leading '/', because no Windows path has one.
 */
export async function resolveFolder(folder) {
  if (typeof folder !== 'string' || !folder || !path.isAbsolute(folder)) return null
  const dir = path.resolve(folder)
  try {
    return (await fsp.stat(dir)).isDirectory() ? dir : null
  } catch {
    return null
  }
}
