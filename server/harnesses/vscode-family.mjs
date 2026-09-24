// What VS Code and its forks (Cursor, Antigravity) share: where each keeps its user data, how a
// workspace's storage folder names its folder, and the `<scheme>://file/…` link that opens one.
// The harness adapters built on these editors import this; nothing else should.
import path from 'node:path'
import { listDirs, readJson } from '../lib/fsutil.mjs'

/**
 * `<userData>/User` for an editor whose data folder is called `appFolder` ('Code', 'Cursor', …).
 * @returns {string|null}
 */
export function editorUserDir(appFolder, { home, env = {}, platform }) {
  if (platform === 'darwin') return path.join(home, 'Library', 'Application Support', appFolder, 'User')
  if (platform === 'win32') return env.APPDATA ? path.join(env.APPDATA, appFolder, 'User') : null
  return path.join(env.XDG_CONFIG_HOME || path.join(home, '.config'), appFolder, 'User')
}

/**
 * `file:///Users/me/app` → `/Users/me/app`, `file:///c%3A/code/app` → `C:/code/app`. Anything
 * that is not a local file URI (an SSH remote, a dev container) is ''.
 * Parsed by hand, not with `fileURLToPath`, so a Windows URI decodes the same on a Mac.
 */
export function fileUriToPath(uri) {
  if (typeof uri !== 'string' || !uri.startsWith('file://')) return ''
  let rest = uri.slice('file://'.length)
  if (!rest.startsWith('/')) return '' // file://server/share: a UNC host, not handled
  try {
    rest = decodeURIComponent(rest)
  } catch {
    return ''
  }
  const drive = /^\/([A-Za-z]):(\/.*)?$/.exec(rest)
  if (drive) return `${drive[1].toUpperCase()}:${drive[2] || '/'}`
  return rest.length > 1 ? rest.replace(/\/+$/, '') : rest
}

/**
 * Every workspace an editor has storage for, with the folder it was opened on. The storage
 * folder's name is a hash, so `workspace.json` is the only way back to the folder. Multi-root
 * workspaces and remote folders are skipped: neither is one folder on this machine.
 * @returns {Promise<{ hash: string, dir: string, folder: string }[]>}
 */
export async function editorWorkspaces(userDir) {
  if (!userDir) return []
  const root = path.join(userDir, 'workspaceStorage')
  const out = []
  for (const hash of await listDirs(root)) {
    const dir = path.join(root, hash)
    const ws = await readJson(path.join(dir, 'workspace.json'))
    const folder = fileUriToPath(ws?.folder)
    if (folder) out.push({ hash, dir, folder })
  }
  return out
}

/**
 * `vscode://file/<path>/?windowId=_blank` opens a folder in VS Code, or focuses the window that
 * already has it; every fork answers the same link on its own scheme. Windows paths go
 * forward-slashed (`vscode://file/C:/code/app/`); each segment is escaped.
 *
 * `windowId=_blank` because a bare link to a folder no window has yet is loaded into the last
 * active window, replacing its project and stopping whatever agent was running there. That is the
 * editor's rule for every link, on every OS: only `code <folder>` and opening from Finder or the
 * Dock prefer a new window, whatever the default of `window.openFoldersInNewWindow` says. With the
 * parameter the editor still looks for a window already on the folder first, and opens a new one
 * only when there is none. An editor too old to know it ignores the query and behaves as before.
 */
export function folderUrl(scheme, dir) {
  return `${pathUrl(scheme, dir)}/?windowId=_blank`
}

/**
 * `vscode://file/<path>` opens one file in the editor, in the window that already has its folder.
 * The same link as `folderUrl` without the trailing slash, which is what tells the editor it was
 * handed a folder, and without `windowId`: a file belongs in the window that has its folder.
 */
export function fileUrl(scheme, file) {
  return pathUrl(scheme, file)
}

/** `<scheme>://file/<path>`, no trailing slash, no query. */
function pathUrl(scheme, target) {
  const parts = String(target).split(/[\\/]/).filter(Boolean)
  const drive = /^[A-Za-z]:$/.test(parts[0] || '') ? parts.shift() + '/' : ''
  return `${scheme}://file/${drive}${parts.map(encodeURIComponent).join('/')}`
}

/** The editors that answer a `<scheme>://file/…` link. Anything else never reaches the OS. */
export const FILE_URL_SCHEMES = new Set(['vscode', 'cursor', 'antigravity-ide'])
