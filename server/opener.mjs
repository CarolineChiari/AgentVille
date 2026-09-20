// Handing a URL or a folder to the OS. This is the only place AgentVille starts a process.
import { spawn as nodeSpawn } from 'node:child_process'
import fsp from 'node:fs/promises'
import path from 'node:path'

/**
 * Windows goes through ShellExecute via rundll32. Two tempting alternatives are both broken:
 * `explorer.exe <url>` silently drops URLs with a query string (so `code/new?folder=…` never
 * arrives), and `cmd /c start` expands the `%3A%5C` escapes in that same link.
 */
const URL_OPENERS = {
  darwin: ['open'],
  win32: ['rundll32', 'url.dll,FileProtocolHandler'],
  linux: ['xdg-open'],
}
const FOLDER_OPENERS = {
  darwin: ['open'],
  win32: ['explorer'],
  linux: ['xdg-open'],
}

/**
 * How long to wait before handing over the next link. Windows has to start Code.exe, then the
 * extension host, then activate the Claude Code extension before the session link has anyone to
 * handle it; 1.8s is enough for a warm Mac and not for a cold Windows, where the link would
 * arrive before the extension existed and the chat never opened.
 */
const LINK_GAP_MS = 1800
const WIN_LINK_GAP_MS = 5000

export const linkGapMs = (platform = process.platform) => (platform === 'win32' ? WIN_LINK_GAP_MS : LINK_GAP_MS)

export function commandFor(kind, target, platform = process.platform) {
  const table = kind === 'folder' ? FOLDER_OPENERS : URL_OPENERS
  const base = table[platform]
  if (!base) return null
  return { cmd: base[0], args: [...base.slice(1), target] }
}

/**
 * Several links in order, a pause between each: the second link must land in the window the
 * first one opened, and a cold VS Code takes a moment to become the focused window.
 */
async function launchEach(launch, urls, gapMs) {
  for (let i = 0; i < urls.length; i++) {
    if (i) await new Promise((r) => setTimeout(r, gapMs))
    const r = await launch(urls[i])
    if (!r.ok) return r
  }
  return { ok: true }
}

/**
 * @param {{ spawn?: Function, platform?: string }} [opts] injectable for tests
 */
export function createOpener({ spawn = nodeSpawn, platform = process.platform } = {}) {
  function run(kind, target) {
    const c = commandFor(kind, target, platform)
    if (!c) return { ok: false, error: `Opening things is not supported on ${platform}.` }
    try {
      // An argv array and no shell: nothing in `target` is ever interpreted.
      // windowsHide stays off. libuv turns it into STARTF_USESHOWWINDOW with SW_HIDE in the
      // child's startup info; ShellExecute passes that show command on to whatever it launches,
      // and Windows obeys the launcher's show command for a process's *first* window — so a cold
      // VS Code (or Explorer) came up with no window at all. rundll32 is a GUI program with no
      // console to hide, so the flag never bought anything here.
      const child = spawn(c.cmd, c.args, { shell: false, detached: true, stdio: 'ignore', windowsHide: false })
      // An unhandled 'error' event on a child would take the whole server down.
      child.on?.('error', () => {})
      child.unref?.()
      return { ok: true }
    } catch (err) {
      return { ok: false, error: String(err?.message || err) }
    }
  }
  const launch = (url) => run('url', url)
  return {
    platform,
    launch,
    launchAll: (urls, gapMs = linkGapMs(platform)) => launchEach(launch, urls, gapMs),
    reveal: (dir) => run('folder', dir),
  }
}

/**
 * The desktop app's opener: Electron's shell rather than a spawned process. Windows only lets the
 * foreground process hand focus to a window it opens; a link opened by the server, which is a
 * background process, leaves VS Code's window flashing in the taskbar instead of focused, and the
 * session link that follows then lands in whichever VS Code window *was* focused, whose extension
 * knows nothing of that session. Electron's main process is the foreground one when you click, so
 * the hand-off is allowed. Still a URL the OS resolves, as CLAUDE.md requires.
 *
 * `openExternal` and `openPath` are passed in, so this file imports nothing from Electron.
 */
export function createShellOpener({ openExternal, openPath, platform = process.platform } = {}) {
  const attempt = async (fn) => {
    try {
      // openPath resolves to '' when it worked and to a message when it didn't; openExternal
      // resolves to undefined and rejects instead.
      const failure = await fn()
      return failure ? { ok: false, error: String(failure) } : { ok: true }
    } catch (err) {
      return { ok: false, error: String(err?.message || err) }
    }
  }
  const launch = (url) => attempt(() => openExternal(url))
  return {
    platform,
    launch,
    launchAll: (urls, gapMs = linkGapMs(platform)) => launchEach(launch, urls, gapMs),
    reveal: (dir) => attempt(() => openPath(dir)),
  }
}

/**
 * The page's scan may be minutes old. A folder that has moved or gone fails here, not at the OS.
 * `path.isAbsolute`, not a leading '/', because no Windows path has one.
 */
export async function resolveFolder(folder) {
  if (typeof folder !== 'string' || !folder || !path.isAbsolute(folder)) return null
  const dir = path.resolve(folder)
  try {
    return (await fsp.stat(dir)).isDirectory() ? dir : null
  } catch {
    return null
  }
}
