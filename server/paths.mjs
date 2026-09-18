// Repo-relative locations, derived from this file rather than process.cwd() so the server works
// wherever it is launched from — including from inside an Electron main process later.
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const DEFAULT_DATA_DIR = process.env.AGENTVILLE_DATA || path.join(REPO_ROOT, 'data')
export const DEFAULT_DIST_DIR = path.join(REPO_ROOT, 'dist')
