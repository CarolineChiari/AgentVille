// Where Claude Code keeps its files, per platform. Only paths under the user's own profile.
import path from 'node:path'
import { exists, listDirs } from '../../lib/fsutil.mjs'

/** CLI transcripts and the live-process registry. Same layout on every OS. */
export function cliDirs(home) {
  return {
    projects: path.join(home, '.claude', 'projects'),
    sessions: path.join(home, '.claude', 'sessions'),
  }
}

/**
 * The desktop app's userData directory. On Windows the Store/MSIX install lives under
 * `Packages\Claude_<publisher hash>\LocalCache\Roaming`, and the hash is not something to
 * hard-code, so it is globbed. The first candidate that actually holds session records wins;
 * failing that the conventional path is returned so `detect()` can say no.
 */
export async function desktopDataDir({ home, env = {}, platform }) {
  const candidates = []
  if (platform === 'darwin') {
    candidates.push(path.join(home, 'Library', 'Application Support', 'Claude'))
  } else if (platform === 'win32') {
    if (env.APPDATA) candidates.push(path.join(env.APPDATA, 'Claude'))
    if (env.LOCALAPPDATA) {
      const packages = path.join(env.LOCALAPPDATA, 'Packages')
      for (const name of await listDirs(packages)) {
        if (name.startsWith('Claude_')) {
          candidates.push(path.join(packages, name, 'LocalCache', 'Roaming', 'Claude'))
        }
      }
    }
  } else {
    candidates.push(path.join(env.XDG_CONFIG_HOME || path.join(home, '.config'), 'Claude'))
  }
  for (const c of candidates) {
    if (await exists(path.join(c, 'claude-code-sessions'))) return c
  }
  return candidates[0] || null
}

export const SESSIONS_SUBDIR = 'claude-code-sessions'
