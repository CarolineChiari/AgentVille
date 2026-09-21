// The folders inside a folder, for the new-session form's browser: a session can start anywhere,
// not only in a folder some session has already been in. Names only; nothing inside is read.
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { resolveFolder } from './opener.mjs'

// A home folder or a node_modules can hold thousands; past this many nobody is scrolling a list.
const MAX_FOLDERS = 400

/**
 * `{ ok, path, parent, folders: [{ name, path }], more }` for an absolute folder, or the home
 * folder when none is named. Dot-folders are left out: they're settings, not places to work.
 * `parent` is '' at the root. Symlinks to folders count as folders, as they do in a file picker.
 */
export async function listFolders(folder, { home = os.homedir() } = {}) {
  const dir = await resolveFolder(folder === '' || folder == null ? home : folder)
  if (!dir) return { ok: false, error: 'That folder doesn’t exist.' }
  let entries
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true })
  } catch {
    return { ok: false, error: 'That folder can’t be read.' }
  }
  const folders = []
  for (const e of entries) {
    if (e.name.startsWith('.')) continue
    const full = path.join(dir, e.name)
    if (e.isDirectory() || (e.isSymbolicLink() && (await resolveFolder(full)))) folders.push({ name: e.name, path: full })
  }
  folders.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
  const parent = path.dirname(dir)
  return { ok: true, path: dir, parent: parent === dir ? '' : parent, folders: folders.slice(0, MAX_FOLDERS), more: folders.length > MAX_FOLDERS }
}
