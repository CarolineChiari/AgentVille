// AgentVille's own version, and whether a published release is newer than it. Nothing here
// touches the network: the comparison is pure and the only read is the app's own package.json.
import fsp from 'node:fs/promises'
import path from 'node:path'
import { REPO_ROOT } from './paths.mjs'

/**
 * `[major, minor, patch]` from a version or a release tag (`v0.39.0`), else null.
 * Only a plain numeric release parses. A pre-release tag (`0.40.0-rc.1`) deliberately doesn't:
 * unparsable means "no news", which is the safe way for a notice nobody asked for to fail.
 */
export function parseVersion(v) {
  if (typeof v !== 'string') return null
  const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(v.trim())
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null
}

/** The plain `x.y.z` inside a version or tag, or '' when there isn't one. */
export function versionOf(v) {
  const p = parseVersion(v)
  return p ? p.join('.') : ''
}

/** Is `latest` a later release than `current`? False whenever either one can't be read. */
export function isNewerVersion(latest, current) {
  const a = parseVersion(latest)
  const b = parseVersion(current)
  if (!a || !b) return false
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i]
  return false
}

/** The running app's version, from the package.json beside it; '' if it can't be read. */
export async function appVersion(root = REPO_ROOT) {
  try {
    return versionOf(JSON.parse(await fsp.readFile(path.join(root, 'package.json'), 'utf8')).version)
  } catch {
    return ''
  }
}
