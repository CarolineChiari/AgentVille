// Finding a command-line tool the person installed. Only ever a file under their own profile, a
// standard bin directory, or on PATH — never something inside another application's bundle.
import path from 'node:path'
import { exists } from './fsutil.mjs'

/**
 * @param {string} name        bare command name, e.g. 'copilot'
 * @param {{ home: string, env?: object, platform: string, dirs?: string[] }} opts
 *        `dirs` are checked before the standard ones: where that tool's own installer puts it.
 * @returns {Promise<string|null>} absolute path, or null
 */
export async function findExe(name, { home, env = {}, platform, dirs = [] }) {
  const win = platform === 'win32'
  const names = win ? [`${name}.exe`, `${name}.cmd`] : [name]
  const all = [...dirs]
  if (!win) all.push(path.join(home, '.local', 'bin'), '/opt/homebrew/bin', '/usr/local/bin', '/usr/bin')
  for (const d of String(env.PATH || env.Path || '').split(win ? ';' : ':')) if (d && path.isAbsolute(d)) all.push(d)
  for (const d of all) {
    for (const n of names) {
      const p = path.join(d, n)
      if (await exists(p)) return p
    }
  }
  return null
}
