// The desktop app: the same server `npm start` runs, started inside Electron's main process, and
// one window pointed at it. The page is the ordinary web build; it gets no Node and no preload.
import { app, BrowserWindow } from 'electron'
import os from 'node:os'
import path from 'node:path'
import { APP_PORT, augmentedPath, isAppUrl } from './env.mjs'
import { createServer } from '../server/index.mjs'
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
  const opts = { host: '127.0.0.1', dataDir: dataDir(), log: null }
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
