// The desktop app: the same server `npm start` runs, started inside Electron's main process, and
// one window pointed at it. The page is the ordinary web build; it gets no Node and no preload.
import { app, BrowserWindow, nativeImage, shell } from 'electron'
import os from 'node:os'
import path from 'node:path'
import { APP_PORT, augmentedPath, badgeBitmap, badgeCount, isAppUrl } from './env.mjs'
import { createServer } from '../server/index.mjs'
import { createShellOpener } from '../server/opener.mjs'
import { APP_BG } from '../src/render/sprites/palette.js'

// Two copies would fight over the port and over data/village.json.
if (!app.requestSingleInstanceLock()) app.quit()

process.env.PATH = augmentedPath(process.env, { home: os.homedir(), platform: process.platform })

let win = null
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

function createWindow() {
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 720,
    minHeight: 480,
    title: 'AgentVille',
    backgroundColor: APP_BG, // so the window doesn't flash white before the page paints
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false },
  })
  // Links the page opens go through the server's opener already; nothing gets a new window.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-navigate', (e, target) => {
    if (!isAppUrl(target, appUrl)) e.preventDefault()
  })
  // The page puts the count in its title, `(2) AgentVille`; it has no other way to reach us.
  win.on('page-title-updated', (e, title) => showCount(badgeCount(title)))
  win.on('closed', () => (win = null))
  win.loadURL(appUrl)
}

app.on('second-instance', () => {
  if (!win) return
  if (win.isMinimized()) win.restore()
  win.focus()
})

app.whenReady().then(async () => {
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
