// Updating the desktop app in place: fetching the build for the release the daily check found,
// checking it is the file GitHub says it is, and handing it to whoever can restart the app into it
// (the Electron main process; the plain server can't, so there `kind` is null and this only says so).
// Like the release check, the download goes through the user's own `gh`: nothing here opens a
// connection itself. Everything it writes is in `dataDir/updates/`.
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { RELEASE_REPO, runGh } from './github.mjs'
import { parseVersion, versionOf } from './version.mjs'

/** The kinds of build that can replace themselves: the Windows portable .exe and the Windows installer. */
export const UPDATE_KINDS = ['portable', 'installer']

/**
 * A build is over 100MB and `gh` shows no progress, so the 30s every other `gh` call gets would
 * cut off any download slower than about 30Mbit/s. Half an hour still ends a download that hangs.
 */
export const DOWNLOAD_TIMEOUT_MS = 30 * 60 * 1000

/** A file name GitHub gives an asset: no separators, nothing a glob or a shell would read. */
const ASSET_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/
const DIGEST_RE = /^sha256:([0-9a-f]{64})$/

/** The name each kind's build is published under. GitHub turns the installer's spaces into dots. */
const ASSET_FOR = {
  portable: (v) => `AgentVille-${v}-portable.exe`,
  installer: (v) => `AgentVille.Setup.${v}.exe`,
}

/** An asset from the releases API, typed: `{ name, size, sha256 }`, or null when any part is off. */
export function normalizeAsset(a) {
  const name = typeof a?.name === 'string' ? a.name : ''
  const size = Number(a?.size)
  const digest = typeof a?.digest === 'string' ? DIGEST_RE.exec(a.digest) : null
  if (!ASSET_NAME_RE.test(name) || !Number.isInteger(size) || size <= 0) return null
  // No digest, no install: size alone would let a truncated or swapped file through.
  if (!digest) return null
  return { name, size, sha256: digest[1] }
}

/** The asset in `assets` that is `kind`'s build of `version`, or null. */
export function assetFor(assets, kind, version) {
  const v = versionOf(version)
  if (!v || !ASSET_FOR[kind] || !Array.isArray(assets)) return null
  const want = ASSET_FOR[kind](v)
  return assets.map(normalizeAsset).find((a) => a?.name === want) ?? null
}

async function sha256Of(file) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(file)) hash.update(chunk)
  return hash.digest('hex')
}

/**
 * Copy `source` over `target`, retrying while `target` is still locked. A portable .exe is held
 * open by its own launcher until the app it started has exited and been cleaned up after, which
 * can take a few seconds after the window closes, so the first tries are expected to fail. The
 * copy goes beside the target first and is renamed over it, so a failure never leaves half a file.
 * @returns {Promise<boolean>} whether the target is now the new build
 */
export async function replaceFile(source, target, { tries = 60, waitMs = 1000 } = {}) {
  const tmp = `${target}.update`
  try {
    await fsp.copyFile(source, tmp)
  } catch {
    return false
  }
  for (let i = 0; i < tries; i++) {
    try {
      await fsp.rename(tmp, target)
      return true
    } catch {
      if (i < tries - 1) await new Promise((r) => setTimeout(r, waitMs))
    }
  }
  await fsp.rm(tmp, { force: true }).catch(() => {})
  return false
}

/**
 * @param {{ dataDir: string, kind?: string|null, repo?: string,
 *           gh?: (args: string[], opts?: object) => Promise<string>,
 *           install?: (plan: { kind: string, file: string, version: string }) => Promise<{ ok: boolean, error?: string }>|{ ok: boolean, error?: string } }} opts
 */
export function createUpdater({ dataDir, kind = null, repo = RELEASE_REPO, gh = runGh, install = null }) {
  const supported = UPDATE_KINDS.includes(kind) && typeof install === 'function'
  const dir = path.join(dataDir, 'updates')
  let state = { state: 'idle', version: '', error: '', file: '' }
  let job = null

  const status = () => ({ supported, state: state.state, version: state.version, error: state.error })

  async function fetchBuild(version) {
    const tag = `v${version}`
    const meta = JSON.parse(await gh(['api', `repos/${repo}/releases/tags/${tag}`]))
    const asset = assetFor(meta?.assets, kind, version)
    if (!asset) throw new Error(`The ${version} release has no ${kind} build to update to.`)
    await fsp.mkdir(dir, { recursive: true })
    const file = path.join(dir, asset.name)
    await fsp.rm(file, { force: true })
    await gh(['release', 'download', tag, '--repo', repo, '--pattern', asset.name, '--dir', dir, '--clobber'], { timeoutMs: DOWNLOAD_TIMEOUT_MS })
    const st = await fsp.stat(file)
    if (st.size !== asset.size || (await sha256Of(file)) !== asset.sha256) {
      await fsp.rm(file, { force: true })
      throw new Error(`The ${version} download didn't match what GitHub published.`)
    }
    return file
  }

  /**
   * Fetch `version`'s build in the background. Asking again for the version already fetched or
   * on its way does nothing; one that failed is only tried again when `retry` says so, so a page
   * polling every few seconds doesn't pull a hundred megabytes on every poll.
   */
  function download(version, { retry = false } = {}) {
    const v = versionOf(version)
    if (!supported) return status()
    if (!v || !parseVersion(v)) return status()
    if (job) return status()
    if (state.version === v && (state.state === 'ready' || (state.state === 'failed' && !retry))) return status()
    state = { state: 'downloading', version: v, error: '', file: '' }
    job = fetchBuild(v)
      .then((file) => (state = { state: 'ready', version: v, error: '', file }))
      .catch((err) => (state = { state: 'failed', version: v, error: String(err?.message || err), file: '' }))
      .finally(() => (job = null))
    return status()
  }

  /** Restart into the fetched build. Only once one is ready, and only through the host's `install`. */
  async function installReady() {
    if (!supported) return { ok: false, error: `This copy of AgentVille can't update itself.` }
    if (state.state !== 'ready') return { ok: false, error: 'No update has been downloaded yet.' }
    return install({ kind, file: state.file, version: state.version })
  }

  /** Remove old downloads, except `keep` (the build this very process was started from, if it was one). */
  async function cleanup(keep = '') {
    let names
    try {
      names = await fsp.readdir(dir)
    } catch {
      return
    }
    const kept = keep ? path.resolve(keep) : ''
    for (const name of names) {
      const file = path.join(dir, name)
      if (path.resolve(file) === kept) continue
      await fsp.rm(file, { force: true, recursive: true }).catch(() => {})
    }
  }

  return { status, download, install: installReady, cleanup, settle: () => job ?? Promise.resolve(), dir }
}
