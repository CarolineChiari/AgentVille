// Boot: settings → sprites → renderer → world → village → UI → poll loop.
import { World } from './sim/world.js'
import { CELL_TILES } from './sim/constants.js'
import { Camera } from './render/camera.js'
import { Canvas2dRenderer } from './render/renderer.js'
import { sprites } from './render/sprites/registry.js'
import { TILE_PX } from './render/sprites/palette.js'
import { dayFactor, hourNow } from './render/daynight.js'
import { Village } from './game/village.js'
import { loadSettings, saveSettings } from './ui/settings.js'
import { createHud } from './ui/hud.js'
import { createCard } from './ui/card.js'
import { createToasts } from './ui/toast.js'
import { createTranscript } from './ui/transcript.js'
import { createNewSession } from './ui/newsession.js'
import { createTaskEditor } from './ui/taskeditor.js'

// Often enough that a question from Claude shows up within seconds; a scan costs well under a second.
const POLL_MS = 8_000
const DRAG_THRESHOLD = 5 // CSS px before a press becomes a drag rather than a click
const WHEEL_STEP = 80 // accumulated wheel delta per zoom step; trackpads send many small ones

const canvas = document.getElementById('world')
const hudRoot = document.getElementById('hud')
const demo = new URLSearchParams(location.search).has('demo')

const settings = loadSettings()
const toast = createToasts(hudRoot)
const world = new World()
const camera = new Camera()
const renderer = new Canvas2dRenderer(canvas, camera)
let hovered = null
let hoverPlot = null

const village = new Village({ world, settings, demo, toast, onChange: () => ui.changed() })
const transcript = createTranscript(hudRoot, village)
const newSession = createNewSession(hudRoot, village, { onRemember: () => saveSettings(settings) })
const taskEditor = createTaskEditor(hudRoot, village)
const card = createCard(hudRoot, village, {
  onEditTasks: (project) => taskEditor.open(project),
  onRecruit: (project, prompt) => newSession.open(project, { prompt }),
  onTranscript: (id) => {
    transcript.toggle(id)
    // Bring the villager (or flower) into the part of the map the panel leaves visible.
    requestAnimationFrame(() => fly({ villager: village.selected }))
  },
})
const hud = createHud(hudRoot, {
  village,
  settings,
  onSettings() {
    saveSettings(settings)
    village.apply()
    if (settings.prGardens) village.pollPrs()
    if (settings.issueBoards) village.pollIssues()
  },
  onFly: fly,
  onNewSession: (repo) => newSession.open(repo),
  onEditTasks: (repo) => taskEditor.open(repo),
})
const ui = {
  changed() {
    hud.render()
    card.update()
    transcript.refresh()
  },
}

// ---------- camera helpers ----------

function sidebarWidth() {
  if (!settings.uiVisible || innerWidth <= 720) return 0
  return 300 + 24
}

function fly(target) {
  if (target.villager) {
    const v = world.villager(target.villager) || world.flower(target.villager) || world.board(target.villager)
    if (v) camera.flyTo(v.x * TILE_PX, v.y * TILE_PX - 12)
  } else if (target.plot) {
    const p = world.plots.get(target.plot)
    if (!p) return
    const xs = p.cells.map((c) => c[0])
    const ys = p.cells.map((c) => c[1])
    const cx = ((Math.min(...xs) + Math.max(...xs) + 1) / 2) * CELL_TILES * TILE_PX
    const cy = ((Math.min(...ys) + Math.max(...ys) + 1) / 2) * CELL_TILES * TILE_PX
    camera.flyTo(cx, cy)
  }
}

function home() {
  camera.scale = camera.defaultScale()
  camera.flyTo(world.gate.x * TILE_PX, world.gate.y * TILE_PX)
}

function applyUiVisible() {
  document.body.classList.toggle('hud-hidden', !settings.uiVisible)
  camera.insetRight = sidebarWidth() * camera.dpr
}

// ---------- pointer ----------

let press = null
canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId)
  press = { x: e.clientX, y: e.clientY, world: camera.toWorld(e.clientX, e.clientY), dragging: false }
})
canvas.addEventListener('pointermove', (e) => {
  if (press) {
    if (!press.dragging && Math.hypot(e.clientX - press.x, e.clientY - press.y) > DRAG_THRESHOLD) {
      press.dragging = true
      canvas.classList.add('dragging')
    }
    if (press.dragging) camera.pin(press.world, e.clientX, e.clientY)
    return
  }
  const hit = renderer.pick(e.clientX, e.clientY, lastFrame)
  hovered = hit?.villager || hit?.flower || hit?.board || null
  hoverPlot = hit?.villager ? world.villager(hit.villager)?.building?.plot
    : hit?.flower ? world.flower(hit.flower)?.plot
    : hit?.board ? world.board(hit.board)?.plot
    : hit?.plot || null
  canvas.classList.toggle('pointing', Boolean(hovered))
})
canvas.addEventListener('pointerup', (e) => {
  const was = press
  press = null
  canvas.classList.remove('dragging')
  if (!was || was.dragging) return
  const hit = renderer.pick(e.clientX, e.clientY, lastFrame)
  if (hit?.villager) village.select(hit.villager)
  else if (hit?.flower) village.select(hit.flower)
  else if (hit?.board) village.select(hit.board)
  else if (hit?.plot) village.selectPlot(hit.plot)
  else {
    village.select(null)
    village.selectPlot(null)
  }
})
canvas.addEventListener('pointerleave', () => {
  hovered = null
  hoverPlot = null
})

let wheelAcc = 0
canvas.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault()
    wheelAcc += e.deltaY * (e.deltaMode === 1 ? 30 : 1)
    while (Math.abs(wheelAcc) >= WHEEL_STEP) {
      camera.zoomAt(e.clientX, e.clientY, wheelAcc > 0 ? -1 : 1)
      wheelAcc -= Math.sign(wheelAcc) * WHEEL_STEP
    }
  },
  { passive: false },
)

// ---------- keyboard ----------

addEventListener('keydown', (e) => {
  if (e.target.closest?.('input, select, textarea')) return
  // Ctrl on Windows, where the OS keeps the Windows key's shortcuts for itself.
  if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
    settings.uiVisible = !settings.uiVisible
    saveSettings(settings)
    applyUiVisible()
    return
  }
  if (e.metaKey || e.ctrlKey || e.altKey) return
  const pan = 48 / camera.scale
  const centerX = (camera.width + camera.insetLeft - camera.insetRight) / 2 / camera.dpr
  const centerY = camera.height / 2 / camera.dpr
  switch (e.key) {
    case 'n': case 'N': { const id = village.nextWaiting(); if (id) fly({ villager: id }); break }
    case 'r': case 'R': { const id = village.nextDone(); if (id) fly({ villager: id }); break }
    case 'p': case 'P': { const id = village.nextOpenPr(); if (id) fly({ villager: id }); break }
    case 'i': case 'I': { const id = village.nextIssueBoard(); if (id) fly({ villager: id }); break }
    case 'Enter': village.open(); break
    case 'v': case 'V': village.viewed(); break
    case 'a': case 'A': village.archive(); break
    case 'c': case 'C': newSession.open(); break
    case 't': case 'T': {
      const f = village.flower(village.selected)
      // A notice board has no transcript; a PR's is its thread's, if one opened it.
      const id = f?.pr ? f.threadId : village.board(village.selected) ? null : village.selected
      if (id) {
        transcript.toggle(id)
        requestAnimationFrame(() => fly({ villager: village.selected }))
      }
      else if (transcript.openId) transcript.close()
      break
    }
    case 'h': case 'H':
      settings.uiVisible = !settings.uiVisible
      saveSettings(settings)
      applyUiVisible()
      break
    case 's': case 'S': hud.showSheet('settings'); break
    case '?': hud.showSheet('help'); break
    case 'Escape':
      if (hud.sheetOpen) hud.closeSheet()
      else if (transcript.openId) transcript.close()
      else if (village.selected) village.select(null)
      else village.selectPlot(null)
      break
    case '+': case '=': camera.zoomAt(centerX, centerY, 1); break
    case '-': case '_': camera.zoomAt(centerX, centerY, -1); break
    case '0': home(); break
    case 'ArrowLeft': camera.panBy(pan * 4, 0); break
    case 'ArrowRight': camera.panBy(-pan * 4, 0); break
    case 'ArrowUp': camera.panBy(0, pan * 4); break
    case 'ArrowDown': camera.panBy(0, -pan * 4); break
    default: return
  }
  e.preventDefault()
})

// ---------- polling ----------

let polling = false
async function poll() {
  if (polling) return
  polling = true
  try {
    await village.poll()
  } finally {
    polling = false
  }
}
addEventListener('focus', poll)
document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && poll())

// ---------- loop ----------

let lastFrame = world.snapshot()
let last = performance.now()
function loop(now) {
  const dt = Math.min(0.1, (now - last) / 1000)
  last = now
  world.tick(dt)
  camera.update(dt)
  lastFrame = world.snapshot({ selected: village.selected, hovered })
  const hour = settings.timeMode === 'manual' ? settings.hour : hourNow()
  renderer.render(lastFrame, {
    night: 1 - dayFactor(hour),
    hoverPlot,
    selectedPlot: village.selectedPlot,
    allNames: !settings.quietNames,
  })
  const sel = village.selected
  const board = sel && world.board(sel)
  const v = sel && (world.villager(sel) || world.flower(sel) || board)
  const isFlower = Boolean(v && !v.look)
  const panelEdge = innerWidth > 720 ? transcript.rightEdge : 0
  camera.insetLeft = panelEdge * camera.dpr
  // Above a flower, so it never covers the garden it is about. Beside a board, like a villager:
  // its card lists issues and is too tall to fit above.
  const above = isFlower && !board
  card.place(v ? camera.toScreen(v.x * TILE_PX, (v.y - (above ? 0.6 : 1)) * TILE_PX) : null, innerWidth - sidebarWidth(), innerWidth <= 720, above, panelEdge)
  requestAnimationFrame(loop)
}

// ---------- boot ----------

async function boot() {
  renderer.resize()
  applyUiVisible()
  addEventListener('resize', () => {
    renderer.resize()
    applyUiVisible()
  })
  home()
  camera.x = camera.target.x
  camera.y = camera.target.y
  camera.target = null
  hud.render()
  requestAnimationFrame(loop)
  await sprites.init()
  try {
    await village.load()
  } catch (err) {
    toast(`Couldn't reach the AgentVille server: ${err.message}`, 'error')
  }
  await poll()
  setInterval(poll, POLL_MS)
  if (!settings.seenHelp) {
    settings.seenHelp = true
    saveSettings(settings)
    toast('Press ? for keys. Villagers with a ? over their heads are waiting on you.')
  }
}
// A handle for poking at the running village from devtools; stripped from production builds.
if (import.meta.env?.DEV) window.__agentville = { world, camera, village, settings, renderer }

boot()
