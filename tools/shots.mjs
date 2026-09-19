// The README's screenshots, taken from the demo village in headless Chrome. Only ever the demo:
// the page is served by a Vite server without the API, so nothing of yours can end up in a shot.
//
//   npm run shots -- [name ...]
//
// Writes docs/screenshots/<name>.png. Finds Chrome, Chromium or Edge where they usually install;
// CHROME=/path/to/browser picks another.
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'docs', 'screenshots')
const PROFILE = path.join(ROOT, 'data', 'shots-profile')
const VIEW = { width: 1440, height: 900, deviceScaleFactor: 2 }
// Long enough for the sprites to be generated and the first villagers to walk out of the portal.
const SETTLE_MS = 6000

// Settings as the page reads them from localStorage: no help sheet, and a fixed late morning so a
// shot taken at night isn't dark.
const SETTINGS = { seenHelp: true, timeMode: 'manual', hour: 11 }

const SCENES = [
  { name: 'village' },
  { name: 'needs-you', keys: ['n'] },
  { name: 'issues', keys: ['i'] },
  { name: 'construction', query: 'theme=construction' },
  { name: 'elvish', query: 'theme=elvish' },
  // A plot's landmark and its panel: what the work there has raised, and where the points came from.
  {
    name: 'landmark',
    script: `const { village, world, camera } = window.__agentville
      village.selectPlot('lighthouse')
      const l = world.landmark('lighthouse')
      camera.scale = 3 * camera.dpr
      camera.flyTo((l.x + l.w / 2) * 16, (l.y - 1) * 16)`,
  },
]

const BROWSERS = {
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ],
  win32: [
    path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
  ],
  linux: ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'],
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function findBrowser() {
  const found = [process.env.CHROME, ...(BROWSERS[process.platform] || [])].find((p) => p && fs.existsSync(p))
  if (!found) throw new Error('No Chrome, Chromium or Edge found; set CHROME=/path/to/browser')
  return found
}

/** Port 0 lets Chrome pick a free one; it writes the one it picked into the profile. */
async function devtoolsUrl() {
  const file = path.join(PROFILE, 'DevToolsActivePort')
  for (let i = 0; i < 100; i++) {
    try {
      const [port, route] = fs.readFileSync(file, 'utf8').split('\n')
      if (port && route) return `ws://127.0.0.1:${port}${route}`
    } catch {
      // Not written yet.
    }
    await sleep(100)
  }
  throw new Error('The browser never opened its DevTools port')
}

/** A DevTools protocol connection: `send` resolves with each command's result. */
async function connect(url) {
  const ws = new WebSocket(url)
  await new Promise((resolve, reject) => {
    ws.onopen = resolve
    ws.onerror = () => reject(new Error(`Could not connect to ${url}`))
  })
  const pending = new Map()
  let seq = 0
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data)
    const p = pending.get(m.id)
    if (!p) return
    pending.delete(m.id)
    if (m.error) p.reject(new Error(m.error.message))
    else p.resolve(m.result)
  }
  const send = (method, params = {}, sessionId) => {
    const id = ++seq
    ws.send(JSON.stringify({ id, method, params, sessionId }))
    return new Promise((resolve, reject) => pending.set(id, { resolve, reject }))
  }
  return { send, close: () => ws.close() }
}

async function shoot(cdp, base, { name, query = '', keys = [], script = '' }) {
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' })
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true })
  const send = (method, params) => cdp.send(method, params, sessionId)
  await send('Page.enable')
  await send('Emulation.setDeviceMetricsOverride', { ...VIEW, mobile: false })
  const settings = JSON.stringify(JSON.stringify(SETTINGS))
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `try { localStorage.setItem('agentville.settings', ${settings}) } catch {}`,
  })
  await send('Page.navigate', { url: `${base}?demo=1${query ? `&${query}` : ''}` })
  await sleep(SETTLE_MS)
  for (const key of keys) {
    const code = `Key${key.toUpperCase()}`
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, text: key })
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code })
    // The camera's flight to whatever the key picked.
    await sleep(2500)
  }
  if (script) {
    // The dev server's page keeps a handle on the village (see src/main.js) for a scene to steer.
    await send('Runtime.evaluate', { expression: script })
    await sleep(2500)
  }
  const { data } = await send('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync(path.join(OUT, `${name}.png`), Buffer.from(data, 'base64'))
  console.log(`docs/screenshots/${name}.png`)
  await cdp.send('Target.closeTarget', { targetId })
}

const only = process.argv.slice(2)
const scenes = SCENES.filter((s) => !only.length || only.includes(s.name))
if (!scenes.length) throw new Error(`No such scene; there are ${SCENES.map((s) => s.name).join(', ')}`)

fs.mkdirSync(OUT, { recursive: true })
fs.rmSync(PROFILE, { recursive: true, force: true })
// configFile: false leaves out vite.config.js and with it the API, so the page can only be the demo.
const vite = await createServer({ configFile: false, root: ROOT, logLevel: 'error', server: { host: '127.0.0.1', port: 0 } })
await vite.listen()
const browser = spawn(findBrowser(), [
  '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${PROFILE}`,
  '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--mute-audio', 'about:blank',
], { stdio: 'ignore', shell: false })
let cdp
try {
  cdp = await connect(await devtoolsUrl())
  for (const scene of scenes) await shoot(cdp, vite.resolvedUrls.local[0], scene)
} finally {
  cdp?.close()
  browser.kill()
  await vite.close()
  // Chrome may still hold the profile for a moment after it is told to quit.
  await sleep(500)
  fs.rmSync(PROFILE, { recursive: true, force: true })
}
