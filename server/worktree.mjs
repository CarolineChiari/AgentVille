// A git worktree stands on its repo's plot. Claude Code's own `.claude/worktrees/<name>` are
// recognised from the path alone (harnesses/claude-code/project.mjs), but `git worktree add
// ../app-feature` can put one anywhere, and its folder name says nothing about the repo. So the
// scan follows what git itself left in the folder: `.git` is a file, `gitdir:` points at the
// worktree's own git dir, and that dir's `commondir` leads to the shared one, whose parent is the
// main checkout. Only small text files are read (the pointers and the shared config's `[core]`);
// git is never run.
import nodeFsp from 'node:fs/promises'
import path from 'node:path'
import { basename } from './harnesses/thread.mjs'

/**
 * The main checkout a worktree folder belongs to, or null when `dir` is not a linked worktree:
 * a repo's own checkout (`.git` is a folder), a submodule (its `.git` file points at a git dir with
 * no `commondir`), a worktree of a bare repository (there is no checkout to stand on), even one kept
 * in a folder named `.git`, or anything unreadable, including a shared git dir with no config.
 * @param {string} dir  an absolute path
 */
export async function mainCheckoutOf(dir, fsp = nodeFsp) {
  if (typeof dir !== 'string' || !path.isAbsolute(dir)) return null
  try {
    const dotGit = path.join(dir, '.git')
    if (!(await fsp.stat(dotGit)).isFile()) return null
    const m = /^gitdir:\s*(.+)$/m.exec(await fsp.readFile(dotGit, 'utf8'))
    if (!m) return null
    const gitDir = path.resolve(dir, m[1].trim())
    const common = path.resolve(gitDir, (await fsp.readFile(path.join(gitDir, 'commondir'), 'utf8')).trim())
    // A bare repository's dir is the common dir itself (`app.git`), with no files beside it.
    if (path.basename(common) !== '.git') return null
    const main = path.dirname(common)
    if (path.resolve(main) === path.resolve(dir)) return null
    // Only a checkout that is still there: a stale pointer must not move a plot somewhere empty.
    if (!(await fsp.stat(common)).isDirectory()) return null
    // A bare repository can be kept in a folder named `.git` too (`git clone --bare url app/.git`),
    // and then `app` holds no checkout. Its config says so.
    if (isBare(await fsp.readFile(path.join(common, 'config'), 'utf8'))) return null
    return main
  } catch {
    return null
  }
}

/** Does a git config's `[core]` section say `bare = true`? Section and key names ignore case, as git's do. */
export function isBare(config) {
  const core = /^\s*\[core\]([^[]*)/im.exec(String(config || ''))
  // A key with no value is true to git.
  const m = core && /^\s*bare\s*(?:=\s*([^\s#;]*))?\s*(?:[#;].*)?$/im.exec(core[1])
  return Boolean(m) && (m[1] === undefined || /^(true|yes|on|1)$/i.test(m[1]))
}

/**
 * Move every thread whose folder is a linked worktree onto its main checkout's plot: `projectPath`
 * and `project` become the main repo's, `worktree` the worktree folder's name, and `cwd` keeps the
 * folder the session really ran in. Each folder is looked at once per scan.
 * @param {object[]} threads
 */
export async function resolveWorktrees(threads, { fsp = nodeFsp } = {}) {
  const mains = new Map() // projectPath → its main checkout, or null
  await Promise.all(
    [...new Set(threads.map((t) => t.projectPath).filter(Boolean))].map(async (p) => {
      mains.set(p, await mainCheckoutOf(p, fsp))
    }),
  )
  return threads.map((t) => {
    const main = t.projectPath && mains.get(t.projectPath)
    if (!main) return t
    // A name the harness chose itself (not the folder's) is kept, as unifyPaths in scan.mjs does.
    const named = !t.project || String(t.project).toLowerCase() === basename(t.projectPath).toLowerCase()
    return {
      ...t,
      projectPath: main,
      project: named ? basename(main) : t.project,
      worktree: t.worktree || basename(t.projectPath),
      cwd: t.cwd || t.projectPath,
    }
  })
}
