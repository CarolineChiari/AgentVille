// The desktop app: the same server `npm start` runs, started inside Electron's main process, and
// one window pointed at it. The page is the ordinary web build; it gets no Node and no preload.
import { app, BrowserWindow, nativeImage, screen, session, shell } from 'electron'
import os from 'node:os'
import fs from 'node:fs'
import path from 'node:path'
import { APP_PORT, DEFAULT_BOUNDS, augmentedPath, badgeBitmap, badgeCount, clampBounds, isAppUrl, parseBounds, showDisplays, showSeed, showUrl } from './env.mjs'
import { createServer } from '../server/index.mjs'
import { HEADERS } from '../server/headers.mjs'
import { createShellOpener } from '../server/opener.mjs'
import { APP_BG } from '../src/render/sprites/palette.js'

// The server already sends these on every response; this covers the window even if a future
// change to the server ever drops them, since http.createServer has no default CSP of its own.
function enforceSecurityHeaders() {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = { ...details.responseHeaders }
    for (const [name, value] of Object.entries(HEADERS)) responseHeaders[name] = [value]
    callback({ responseHeaders })
  })
}

// Two copies would fight over the port and over data/village.json.
if (!app.requestSingleInstanceLock()) app.quit()

process.env.PATH = augmentedPath(process.env, { home: os.homedir(), platform: process.platform })

let win = null
// Hacker mode on your other screens: one window per display while the village's show runs.
let shows = []
let showing = ''
let appUrl = null
let server = null

/** Inside the app bundle the repo's `data/` is read-only (and wiped by updates), so it lives in userData. */
const dataDir = () => path.join(app.getPath('userData'), 'data')

async function startServer() {
  // Opening links through the main process, not a spawned launcher: on Windows only the
  // foreground process may hand focus to the window it opens, and when you click it is this one.
  const opener = createShellOpener({ openExternal: (url) => shell.openExternal(url), openPath: (dir) => shell.openPath(dir) })
  const opts = { host: '127.0.0.1', dataDir: dataDir(), log: null, opener }
  let s = createServer({ port: APP_PORT, ...opts })
  try {
    return { s, url: await s.ready }
  } catch (err) {
    if (err.code !== 'EADDRINUSE') throw err
    // Something else has the usual port. Any free one still works; only Settings start fresh.
    s = createServer({ port: 0, ...opts })
    return { s, url: await s.ready }
  }
}

/**
 * How many villagers need you, on the dock icon (macOS, and Linux's Unity launcher) or, since
 * Windows has no badge count, as an overlay on the taskbar button.
 */
function showCount(n) {
  if (process.platform !== 'win32') return app.setBadgeCount(n)
  if (!n) return win?.setOverlayIcon(null, '')
  const img = nativeImage.createEmpty()
  for (const scale of [1, 2]) {
    const { width, height, data } = badgeBitmap(n, scale)
    img.addRepresentation({ scaleFactor: scale, width, height, buffer: data })
  }
  win?.setOverlayIcon(img, n === 1 ? '1 villager needs you' : `${n} villagers need you`)
}

const boundsFile = () => path.join(dataDir(), 'window.json')

/** Where the window was last, pulled onto a display that still exists; null the first time. */
function savedBounds() {
  try {
    const saved = parseBounds(JSON.parse(fs.readFileSync(boundsFile(), 'utf8')))
    if (!saved) return null
    const areas = screen.getAllDisplays().map((d) => d.workArea)
    const primary = screen.getPrimaryDisplay().workArea
    const ordered = [primary, ...areas.filter((a) => a !== primary)]
    return { ...clampBounds(saved, ordered), maximized: saved.maximized }
  } catch {
    return null // no file yet, or one we can't read: open in the default place
  }
}

/** Remember the window's place. Debounced, since resizing fires a stream of events. */
function rememberBounds(w) {
  let timer = null
  const save = () => {
    timer = null
    if (w.isDestroyed()) return
    // Maximized, minimized and full-screen windows report the screen's bounds (or nothing useful);
    // the normal ones are what to restore to, and getNormalBounds is the same as getBounds otherwise.
    const maximized = w.isMaximized()
    const b = w.getNormalBounds()
    try {
      fs.mkdirSync(dataDir(), { recursive: true })
      fs.writeFileSync(boundsFile(), JSON.stringify({ ...b, maximized }))
    } catch {
      // Losing the window's place is not worth a crash.
    }
  }
  const later = () => {
    clearTimeout(timer)
    timer = setTimeout(save, 500)
  }
  for (const ev of ['resize', 'move', 'maximize', 'unmaximize']) w.on(ev, later)
  w.on('close', () => {
    clearTimeout(timer)
    save()
  })
}

const WEB = { contextIsolation: true, sandbox: true, nodeIntegration: false }

/** Same rules as the village's window: nothing opens a window, nothing navigates off the app. */
function lockDown(w) {
  w.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  w.webContents.on('will-navigate', (e, target) => {
    if (!isAppUrl(target, appUrl)) e.preventDefault()
  })
}

function closeShows() {
  for (const w of shows) if (!w.isDestroyed()) w.destroy()
  shows = []
}

/**
 * Follow the village's show: when one starts, cover every other screen with a show of its own;
 * when it stops (from any screen: they tell the village, and it retitles), take them all down.
 */
function syncShows(seed) {
  if (seed === showing) return
  closeShows()
  showing = seed
  if (!seed || !win) return
  const here = screen.getDisplayMatching(win.getBounds()).id
  showDisplays(screen.getAllDisplays(), here).forEach((d, k) => {
    const w = new BrowserWindow({
      ...d.bounds,
      frame: false,
      fullscreen: true,
      skipTaskbar: true,
      show: false,
      backgroundColor: APP_BG,
      autoHideMenuBar: true,
      webPreferences: WEB,
    })
    lockDown(w)
    // Shown without taking the focus: the keyboard stays with the village's screen.
    w.once('ready-to-show', () => w.showInactive())
    w.on('closed', () => (shows = shows.filter((x) => x !== w)))
    w.loadURL(showUrl(appUrl, seed, k + 1))
    shows.push(w)
  })
}

function createWindow() {
  const saved = savedBounds()
  win = new BrowserWindow({
    ...DEFAULT_BOUNDS,
    ...(saved && { x: saved.x, y: saved.y, width: saved.width, height: saved.height }),
    minWidth: 720,
    minHeight: 480,
    title: 'AgentVille',
    backgroundColor: APP_BG, // so the window doesn't flash white before the page paints
    autoHideMenuBar: true,
    webPreferences: WEB,
  })
  // Links the page opens go through the server's opener already; nothing gets a new window.
  if (saved?.maximized) win.maximize()
  rememberBounds(win)
  lockDown(win)
  // The page puts the count in its title, `(2) AgentVille`, and a running hacker-mode show's seed
  // after it; it has no other way to reach us.
  win.on('page-title-updated', (e, title) => {
    showCount(badgeCount(title))
    syncShows(showSeed(title))
  })
  win.on('closed', () => {
    win = null
    closeShows()
  })
  win.loadURL(appUrl)
}

app.on('second-instance', () => {
  if (!win) return
  if (win.isMinimized()) win.restore()
  win.focus()
})

app.whenReady().then(async () => {
  enforceSecurityHeaders()
  const started = await startServer()
  server = started.s
  appUrl = started.url
  createWindow()
  app.on('activate', () => {
    if (!win) createWindow()
  })
}).catch((err) => {
  console.error(err)
  app.exit(1)
})

// The village is the whole app, so closing it quits, on macOS too.
app.on('window-all-closed', () => app.quit())
app.on('before-quit', () => server?.close())
