// Pure: what the desktop wrapper needs to decide before it starts the server. Imports nothing
// from Electron, so it runs under `node --test`.
import path from 'node:path'

/**
 * The port the app tries first. Not 5274: that is `npm run dev`'s, and the two should be able to
 * run side by side. It is fixed rather than 0 because Settings live in localStorage, which is
 * keyed by origin, so a new port on every launch would forget them.
 */
export const APP_PORT = 5275

/**
 * PATH with the directories command-line tools are usually installed in appended. A Mac app
 * started from Finder or the Dock inherits launchd's PATH (`/usr/bin:/bin:/usr/sbin:/sbin`), not
 * the shell's, so `gh` from Homebrew would never be found and the PR gardens would stay empty.
 * Appended, not prepended, so whatever the environment already chose still wins. Windows apps
 * get the full user PATH from Explorer, so there it is left alone.
 * @param {{ PATH?: string }} env
 * @param {{ home: string, platform: string }} opts
 */
export function augmentedPath(env, { home, platform }) {
  const current = String(env.PATH || '')
  if (platform === 'win32') return current
  const have = current.split(':').filter(Boolean)
  const extra = ['/opt/homebrew/bin', '/usr/local/bin', path.posix.join(home, '.local', 'bin'), '/usr/bin', '/bin', '/usr/sbin', '/sbin']
  return [...have, ...extra.filter((d) => !have.includes(d))].join(':')
}

/**
 * Whether a navigation may happen inside the window. Only the app's own origin; anything else
 * (a stray link, a redirect) would otherwise load a remote page next to a server that can read
 * transcripts and open things.
 * @param {string} target
 * @param {string} appUrl
 */
export function isAppUrl(target, appUrl) {
  if (typeof target !== 'string' || typeof appUrl !== 'string') return false
  try {
    return new URL(target).origin === new URL(appUrl).origin
  } catch {
    return false
  }
}
