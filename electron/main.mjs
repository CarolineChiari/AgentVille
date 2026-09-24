// The desktop app: the same server `npm start` runs, started inside Electron's main process, and
// one window pointed at it. The page is the ordinary web build; it gets no Node and no preload.
import { app, BrowserWindow, nativeImage, shell } from 'electron'
import os from 'node:os'
import path from 'node:path'
import { APP_PORT, augmentedPath, badgeBitmap, badgeCount, isAppUrl, relaunchPlan, replaceTarget, updateKind } from './env.mjs'
import { createServer } from '../server/index.mjs'
import { createShellOpener } from '../server/opener.mjs'
import { createUpdater, replaceFile } from '../server/update.mjs'
import { APP_BG } from '../src/render/sprites/palette.js'

// Two copies would fight over the port and over data/village.json.
if (!app.requestSingleInstanceLock()) app.quit()

process.env.PATH = augmentedPath(process.env, { home: os.homedir(), platform: process.platform })

let win = null
let appUrl = null
let server = null

/** Inside the app bundle the repo's `data/` is read-only (and wiped by updates), so it lives in userData. */
const dataDir = () => path.join(app.getPath('userData'), 'data')

/** The .exe the user started, when this is the portable build; the running app is a copy unpacked from it. */
const portableFile = process.env.PORTABLE_EXECUTABLE_FILE || ''

/**
 * Restart as the downloaded build. The page's request is answered first, then this process quits,
 * and Electron starts the plan only once it has exited, so the new copy never meets the old one's
 * single-instance lock or its port.
 */
function installUpdate({ kind, file }) {
  const plan = relaunchPlan({ kind, file, portableFile })
  if (!plan) return { ok: false, error: 'Nothing to restart into.' }
  setTimeout(() => {
    app.relaunch(plan)
    app.quit()
  }, 500)
  return { ok: true }
}

function createAppUpdater() {
  const kind = updateKind({ platform: process.platform, packaged: app.isPackaged, env: process.env })
  const updater = createUpdater({ dataDir: dataDir(), kind, install: installUpdate })
  const target = replaceTarget(process.argv)
  if (kind === 'portable' && target && path.resolve(target) !== path.resolve(portableFile)) {
    // Started by an update: put this build where the user keeps theirs. The old one is still
    // closing, so this waits for it; the download it came from is removed on a later launch.
    replaceFile(portableFile, target).catch(() => {})
  } else {
    updater.cleanup(portableFile).catch(() => {})
  }
  return updater
}

async function startServer() {
  // Opening links through the main process, not a spawned launcher: on Windows only the
  // foreground process may hand focus to the window it opens, and when you click it is this one.
  const opener = createShellOpener({ openExternal: (url) => shell.openExternal(url), openPath: (dir) => shell.openPath(dir) })
  const opts = { host: '127.0.0.1', dataDir: dataDir(), log: null, opener, updater: createAppUpdater() }
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
