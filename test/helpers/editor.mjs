// Builders for a fake VS Code-family user directory: workspaces, their state.vscdb, chat files.
import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'

/** `<home>/Library/Application Support/<app>/User`, as a darwin adapter looks for it. */
export function userDir(home, app) {
  const dir = path.join(home, 'Library', 'Application Support', app, 'User')
  fs.mkdirSync(path.join(dir, 'globalStorage'), { recursive: true })
  return dir
}

/** A workspace storage folder opened on `folder`, with ItemTable rows from `items`. */
export function workspace(user, hash, folder, items = {}) {
  const dir = path.join(user, 'workspaceStorage', hash)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'workspace.json'), JSON.stringify({ folder: `file://${folder.split('/').map(encodeURIComponent).join('/')}` }))
  writeItems(path.join(dir, 'state.vscdb'), items)
  return dir
}

export function writeItems(file, items, table = 'ItemTable') {
  const db = new DatabaseSync(file)
  db.exec(`CREATE TABLE IF NOT EXISTS ${table} (key TEXT UNIQUE ON CONFLICT REPLACE, value BLOB)`)
  const put = db.prepare(`INSERT INTO ${table} (key, value) VALUES (?, ?)`)
  for (const [k, v] of Object.entries(items)) put.run(k, typeof v === 'string' ? v : JSON.stringify(v))
  db.close()
}

export function writeFile(file, text, mtime) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, text)
  if (mtime) fs.utimesSync(file, mtime / 1000, mtime / 1000)
}

export const jsonl = (records) => records.map((r) => JSON.stringify(r)).join('\n') + '\n'
