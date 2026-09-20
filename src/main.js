// Boot: settings → sprites → renderer → world → village → UI → poll loop.
import { World } from './sim/world.js'
import { CELL_TILES } from './sim/constants.js'
import { Camera } from './render/camera.js'
import { Canvas2dRenderer } from './render/renderer.js'
import { sprites } from './render/sprites/registry.js'
import { TILE_PX } from './render/sprites/palette.js'
import { dayFactor, duskFactor, hourNow } from './render/daynight.js'
import { Village } from './game/village.js'
import { loadSettings, saveSettings } from './ui/settings.js'
import { createHud } from './ui/hud.js'
import { createCard } from './ui/card.js'
import { createToasts } from './ui/toast.js'
import { createNotices } from './ui/notices.js'
import { createTranscript } from './ui/transcript.js'
import { createRoomPanel } from './ui/room.js'
import { createNewSession } from './ui/newsession.js'
import { createTaskEditor } from './ui/taskeditor.js'
import { heading, isMoveKey } from './ui/move.js'
import { roomFrame } from './sim/room.js'

// Often enough that a question from Claude shows up within seconds; a scan costs well under a second.
const POLL_MS = 8_000
const DRAG_THRESHOLD = 5 // CSS px before a press becomes a drag rather than a click
const WHEEL_STEP = 80 // accumulated wheel delta per zoom step; trackpads send many small ones
// How long stepping through a door takes. Long enough to read as going inside, short enough that
// it never stands between you and the log you came to read.
const DOOR_FADE_S = 0.35
// How often the board re-reads the log of a session that is still working.
const LOG_REFRESH_MS = 3000
// Lines of log one notch of the wheel moves. Three is the usual step for a list this dense.
const BOARD_SCROLL_LINES = 3
// Room the bar of buttons above a room needs, in CSS pixels, so it never sits over the board.
const ROOM_BAR_PX = 56

const canvas = document.getElementById('world')
const hudRoot = document.getElementById('hud')
const query = new URLSearchParams(location.search)
const demo = query.has('demo')
/** ?theme=<id>&sub=<id>: look at a theme, and one sub-theme on every folder, without saving either. */
const preview = query.get('theme') ? { theme: query.get('theme'), sub: query.get('sub') } : null

const settings = loadSettings()
const toast = createToasts(hudRoot)
const world = new World()
const camera = new Camera()
const renderer = new Canvas2dRenderer(canvas, camera)
let hovered = null
let hoverPlot = null

const notices = createNotices({
  settings,
  onOpen(id) {
    if (!village.thread(id)) return
    village.select(id)
    fly({ villager: id })
  },
})
const village = new Village({ world, settings, demo, toast, onChange: () => ui.changed(), notify: notices.show, preview })
const transcript = createTranscript(hudRoot, village)
const roomPanel = createRoomPanel(hudRoot, village, {
  // The conversation reads in its own panel, out in the village: both would want the same edge
  // of the screen, so asking for one steps back outside first.
  onTranscript: (id) => {
    village.leave()
    transcript.open(id)
  },
})
// Where the camera was standing when you went in, so leaving puts you back exactly there.
let outside = null
let doorFade = 0 // 0 outside, 1 all the way inside
let room = null // the RoomFrame being drawn, rebuilt each frame from the thread and its log
let roomLog = null // what the focused session changed: its shelves, and the board on its wall
// Which page of the board is up: which view, how far down it is scrolled, and the one file
// unfolded into its own edits. Reset on the way in, kept while you are in there.
let board = { view: 'files', scroll: 0, open: '' }
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
  canNotify: notices.supported,
  onSettings(key) {
    if (key === 'notify' && settings.notify) enableNotices()
    // Choosing a theme ends a preview of one.
    if (key === 'theme' || key === 'everywhere') village.preview = null
    saveSettings(settings)
    village.apply()
    applyTheme()
    if (settings.prGardens) village.pollPrs()
    if (settings.issueBoards) village.pollIssues()
    if (settings.repoLines) village.pollRepos()
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
    roomPanel.sync()
    syncFocus()
  },
}

/**
 * Going in and coming out. Entering remembers where the camera stood and flies it to the door;
 * leaving puts it back, with the same thread still selected, so the village is where you left it.
 */
function syncFocus() {
  const inside = Boolean(village.focused)
  document.body.classList.toggle('inside', inside)
  if (inside && !outside) {
    outside = { x: camera.x, y: camera.y, scale: camera.scale }
    transcript.close()
    const v = world.villager(village.focused)
    const b = v?.building
    if (b) camera.flyTo((b.x + b.w / 2) * TILE_PX, (b.y + b.h) * TILE_PX)
    roomLog = null
    board = { view: 'files', scroll: 0, open: '' }
    readLog()
  } else if (!inside && outside) {
    camera.scale = outside.scale
    camera.flyTo(outside.x, outside.y)
    outside = null
  }
}

/**
 * Read what the focused session changed, for its shelves and the board on its wall. Read again
 * every few seconds while it is still going, so the board fills up as the work lands.
 */
let logTimer = null
async function readLog() {
  clearTimeout(logTimer)
  const id = village.focused
  if (!id) return
  const r = await village.changes(id, true)
  if (village.focused !== id) return
  roomLog = r
  const t = village.thread(id)
  const live = t && (t.status === 'working' || t.status === 'waiting' || t.status === 'blocked')
  if (live) logTimer = setTimeout(readLog, LOG_REFRESH_MS)
}

/** Notifications were just turned on: ask for permission now, from that click, and turn them back off if refused. */
async function enableNotices() {
  if (await notices.enable()) return toast('AgentVille will let you know when a villager needs you while it’s in the background.')
  settings.notify = false
  saveSettings(settings)
  hud.render()
  toast('Notifications are blocked for this page. Allow them in the browser’s site settings, then turn this on again.', 'error')
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

/** The room of the thread you are inside, rebuilt each frame so it follows what the session does. */
function roomOf(night) {
  const t = village.thread(village.focused)
  const bits = village.roomOf(village.focused)
  if (!t || !bits) return null
  const next = roomFrame(t, { ...bits, log: roomLog, board, night })
  // logRows clamps the scroll to what there is to read, so the wheel can't run off the end.
  if (next.board.scroll !== board.scroll) board = { ...board, scroll: next.board.scroll }
  return next
}

function home() {
  camera.scale = camera.defaultScale()
  camera.flyTo(world.gate.x * TILE_PX, world.gate.y * TILE_PX)
}

/** The page's own nod to the village's theme; see styles.css. */
function applyTheme() {
  document.body.dataset.theme = village.theme
}

function applyUiVisible() {
  document.body.classList.toggle('hud-hidden', !settings.uiVisible)
  camera.insetRight = sidebarWidth() * camera.dpr
}

// ---------- pointer ----------

let press = null
canvas.addEventListener('pointerdown', (e) => {
  if (village.focused) return // a room fills the canvas; there is nothing to drag it over
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
  if (village.focused) {
    const hit = room && renderer.pickInRoom(room, e.clientX, e.clientY)
    renderer.roomHover = hit
    canvas.classList.toggle('pointing', Boolean(hit?.act))
    return
  }
  const hit = renderer.pick(e.clientX, e.clientY, lastFrame)
  hovered = hit?.villager || hit?.building || hit?.flower || hit?.board || (hit?.landmark ? `landmark:${hit.landmark}` : null)
  hoverPlot = hit?.villager || hit?.building ? world.villager(hit.villager || hit.building)?.building?.plot
    : hit?.flower ? world.flower(hit.flower)?.plot
    : hit?.board ? world.board(hit.board)?.plot
    : hit?.landmark || hit?.plot || null
  canvas.classList.toggle('pointing', Boolean(hovered))
})
canvas.addEventListener('pointerup', (e) => {
  const was = press
  press = null
  canvas.classList.remove('dragging')
  if (!was || was.dragging) return
  if (village.focused) {
    // Inside, the room is the interface: the board's lines and tabs, and the door.
    const hit = room && renderer.pickInRoom(room, e.clientX, e.clientY)
    if (hit?.act === 'leave') village.leave()
    else if (hit?.act === 'tab') board = { ...board, view: hit.tab, scroll: 0 }
    else if (hit?.act === 'fold') board = { ...board, open: board.open === hit.line.path ? '' : hit.line.path }
    else if (hit?.act === 'open') village.openFile(village.focused, hit.line.path)
    return
  }
  const hit = renderer.pick(e.clientX, e.clientY, lastFrame)
  if (hit?.building) village.enter(hit.building)
  else if (hit?.villager) village.select(hit.villager)
  else if (hit?.flower) village.select(hit.flower)
  else if (hit?.board) village.select(hit.board)
  else if (hit?.landmark) {
    // A landmark stands for its whole plot: its panel says how it got there and what comes next.
    village.select(null)
    village.selectPlot(hit.landmark)
  } else if (hit?.plot) village.selectPlot(hit.plot)
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
    if (village.focused) {
      // Over the board the wheel reads the log; anywhere else in a room it does nothing, because
      // there is nothing behind the room to zoom into.
      if (room && renderer.overRoomBoard(room, e.clientX, e.clientY)) {
        const lines = Math.sign(e.deltaY) * BOARD_SCROLL_LINES * (e.deltaMode === 1 ? 3 : 1)
        board = { ...board, scroll: Math.max(0, board.scroll + lines) }
      }
      return
    }
    wheelAcc += e.deltaY * (e.deltaMode === 1 ? 30 : 1)
    while (Math.abs(wheelAcc) >= WHEEL_STEP) {
      camera.zoomAt(e.clientX, e.clientY, wheelAcc > 0 ? -1 : 1)
      wheelAcc -= Math.sign(wheelAcc) * WHEEL_STEP
    }
  },
  { passive: false },
)

// ---------- keyboard ----------

const held = new Set() // movement keys down right now, by `code`
let hurry = false // Shift

addEventListener('keydown', (e) => {
  hurry = e.shiftKey
  if (e.target.closest?.('input, select, textarea')) return
  // Ctrl on Windows, where the OS keeps the Windows key's shortcuts for itself.
  if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
    settings.uiVisible = !settings.uiVisible
    saveSettings(settings)
    applyUiVisible()
    return
  }
  // macOS sends no keyup for a key let go while ⌘ is down, so a held key would drive on forever.
  if (e.metaKey || e.ctrlKey || e.altKey) return held.clear()
  if (isMoveKey(e.code)) {
    held.add(e.code)
    e.preventDefault()
    return
  }
  const centerX = (camera.width + camera.insetLeft - camera.insetRight) / 2 / camera.dpr
  const centerY = camera.height / 2 / camera.dpr
  switch (e.key) {
    case 'n': case 'N': { const id = village.nextWaiting(); if (id) fly({ villager: id }); break }
    case 'r': case 'R': { const id = village.nextDone(); if (id) fly({ villager: id }); break }
    case 'p': case 'P': { const id = village.nextOpenPr(); if (id) fly({ villager: id }); break }
    case 'i': case 'I': { const id = village.nextIssueBoard(); if (id) fly({ villager: id }); break }
    case 'Enter': village.open(); break
    case 'v': case 'V': village.viewed(); break
    // Well away from WASD, so a slip while moving never archives anything.
    case 'Backspace': case 'Delete': village.archive(); break
    case 'c': case 'C': newSession.open(); break
    case 'b': case 'B':
      if (village.focused) village.leave()
      else if (!village.enter()) toast('Pick a villager first — B steps inside its building.')
      break
    case 't': case 'T': {
      const id0 = village.focused
      if (id0) {
        village.leave()
        transcript.open(id0)
        break
      }
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
    case ',': hud.showSheet('settings'); break
    case '?': hud.showSheet('help'); break
    case 'Escape':
      if (hud.sheetOpen) hud.closeSheet()
      else if (village.focused) village.leave()
      else if (transcript.openId) transcript.close()
      else if (village.selected) village.select(null)
      else village.selectPlot(null)
      break
    case '+': case '=': camera.zoomAt(centerX, centerY, 1); break
    case '-': case '_': camera.zoomAt(centerX, centerY, -1); break
    case '0': home(); break
    default: return
  }
  e.preventDefault()
})
// Always, even over a text box: a key let go there was still pressed on the map.
addEventListener('keyup', (e) => {
  hurry = e.shiftKey
  held.delete(e.code)
})
// A key let go in another window never sends its keyup here.
addEventListener('blur', () => held.clear())

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
  camera.steer(heading(held), hurry, dt)
  camera.update(dt)
  lastFrame = world.snapshot({ selected: village.selected, hovered, selectedPlot: village.selectedPlot })
  const hour = settings.timeMode === 'manual' ? settings.hour : hourNow()
  const night = 1 - dayFactor(hour)
  renderer.render(lastFrame, {
    night,
    dusk: duskFactor(hour),
    hoverPlot,
    selectedPlot: village.selectedPlot,
    allNames: !settings.quietNames,
  })
  // Inside: the village is still drawn underneath, and the room fades up over it on the way in
  // and back down on the way out, so a door is something you walk through rather than a cut.
  doorFade = Math.max(0, Math.min(1, doorFade + (village.focused ? dt : -dt) / DOOR_FADE_S))
  room = village.focused ? roomOf(night) : doorFade > 0 ? room : null
  if (room && doorFade > 0) {
    renderer.renderRoom(room, {
      alpha: doorFade,
      time: lastFrame.time,
      // The room has the window to itself; only the sidebar and the room's own bar take space.
      insetLeft: 0,
      insetRight: camera.insetRight,
      insetTop: ROOM_BAR_PX * camera.dpr,
    })
  }
  const sel = village.selected
  const board = sel && world.board(sel)
  const v = sel && (world.villager(sel) || world.flower(sel) || board)
  const isFlower = Boolean(v && !v.look)
  const panelEdge = innerWidth > 720 ? transcript.rightEdge : 0
  camera.insetLeft = panelEdge * camera.dpr
  // Above a flower, so it never covers the garden it is about. Beside a board, like a villager:
  // its card lists issues and is too tall to fit above.
  const above = isFlower && !board
  card.place(v && !village.focused ? camera.toScreen(v.x * TILE_PX, (v.y - (above ? 0.6 : 1)) * TILE_PX) : null, innerWidth - sidebarWidth(), innerWidth <= 720, above, panelEdge)
  requestAnimationFrame(loop)
}

// ---------- boot ----------

async function boot() {
  renderer.resize()
  applyUiVisible()
  applyTheme()
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
