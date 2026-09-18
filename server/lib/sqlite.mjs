// Read-only SQLite through Node's own driver, so reading an editor's state database costs no
// dependency. Every open is read-only and short: the editor that owns the file is writing to it.
let Driver // undefined = not tried yet, null = this Node has no node:sqlite

/**
 * Loaded on first use rather than imported at the top: Node before 22.13 only has it behind a
 * flag, and a failed static import would take the whole server down instead of one harness.
 */
async function driver() {
  if (Driver === undefined) {
    try {
      Driver = (await import('node:sqlite')).DatabaseSync
    } catch {
      Driver = null
    }
  }
  return Driver
}

export async function sqliteAvailable() {
  return Boolean(await driver())
}

/**
 * Every row of one query, or null when the file can't be read right now (missing, locked
 * mid-checkpoint, not a database). Callers treat null as "keep what you had".
 * @param {string} file
 * @param {string} sql
 * @param {Array<string|number>} [params]
 * @returns {Promise<object[] | null>}
 */
export async function queryAll(file, sql, params = []) {
  const Db = await driver()
  if (!Db) return null
  let db
  try {
    db = new Db(file, { readOnly: true })
    return db.prepare(sql).all(...params)
  } catch {
    return null
  } finally {
    try {
      db?.close()
    } catch {
      // Already closed or never opened.
    }
  }
}

/**
 * One key of a VS Code-style `ItemTable`, parsed as JSON. Every VS Code fork keeps its UI state
 * in this one two-column table.
 */
export async function readItem(file, key, table = 'ItemTable') {
  const rows = await queryAll(file, `SELECT value FROM ${table} WHERE key = ?`, [key])
  const raw = rows?.[0]?.value
  if (raw == null) return null
  try {
    return JSON.parse(typeof raw === 'string' ? raw : Buffer.from(raw).toString('utf8'))
  } catch {
    return null
  }
}
