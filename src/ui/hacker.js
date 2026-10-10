// Hollywood hacker mode: ⌘⇧H (Ctrl+Shift+H) fills the screen with a film's idea of a hack, and
// the same keys end it; ⌘⇧⌥H arms it to start in a minute, one more for each press. It is only a
// show. It runs nothing, reads nothing, sends nothing and saves nothing: every word is made up in
// src/sim/hacker-text.js, and the village carries on underneath, untouched.
//
// What is on screen when is decided in src/sim/hacker.js from the show's seed and the time; this
// file owns the overlay, the one ticker, the keyboard and mouse, full screen and arming.
import * as H from '../sim/hacker.js'
import { BUTTONS, CONSOLE_BANNER, EGGS } from '../sim/hacker-text.js'
import { VILLAGER_NAMES } from '../sim/names.js'
import { mulberry32, hashString } from '../sim/rng.js'
import { HACKER } from '../render/sprites/palette.js'
import { RENDERERS, createRain } from './hacker-windows.js'

const MOOD = { green: HACKER.green, amber: HACKER.amber, cyan: HACKER.cyan, red: HACKER.red, pink: HACKER.pink }
// Left alone this long, the console types by itself, so the show never looks abandoned.
const AUTOPILOT_IDLE_MS = 4_000
// How long a red alert and a corner notice stay up.
const ALERT_MS = 2_600
const NOTE_MS = 4_500
// Sizes, in percent of the screen, of the windows eggs and buttons open.
const EXTRA_SIZE = { cracker: [36, 22], feed: [36, 42], dossier: [24, 36], ttt: [24, 40], unix: [26, 40], train: [56, 26], popup: [26, 18], progress: [32, 26], tracer: [38, 40], cipher: [44, 20] }
const EXTRA_TITLE = { cracker: 'PASSWORD CRACKER', feed: 'ENHANCE', dossier: 'DOSSIER', ttt: 'W.O.P.R.', unix: 'FSN — 3D FILE SYSTEM', train: 'sl', popup: 'MESSAGE', progress: 'COUNTERMEASURES', tracer: 'COUNTER-TRACE', cipher: 'ENCRYPTING' }

/**
 * @param {HTMLElement} root the HUD, which the overlay covers
 * @param {object} opts
 * @param {{ villagers: Map }} [opts.world] whose villagers the live feed follows
 * @param {{ get: Function }} opts.sprites to draw them, and a dossier's photo
 * @param {(text: string) => void} [opts.announce] the screen reader's live region
 * @param {(text: string) => void} [opts.toast]
 * @param {() => boolean} [opts.reducedMotion]
 * @param {() => string[]} [opts.names] who the show may name: villager names, never anything real
 * @param {() => string[]} [opts.repos] what it may claim to breach: made-up repos
 * @param {() => Date} [opts.clock]
 * @param {() => void} [opts.onStart] for the page to tidy up (a tip left showing)
 * @param {() => void} [opts.onStop] for the page to take the keyboard back
 */
export function createHacker(root, { world, sprites, swap = null, announce = () => {}, toast = () => {}, reducedMotion = () => false, names = () => VILLAGER_NAMES, repos = () => [], clock = () => new Date(), onStart = () => {}, onStop = () => {} } = {}) {
  const platform = globalThis.navigator?.platform || ''
  const label = H.comboLabel(platform)
  const armLabel = H.comboLabel(platform, true)

  let on = false
  let box = null
  let desk = null
  let fx = null
  let notes = null
  let status = null
  let rain = null
  let rainCanvas = null
  let raf = 0
  let pools = H.DEFAULT_POOLS
  let seed = ''
  let started = 0
  let offset = 0
  let frozen = false
  let lastFrame = 0
  let lastTick = -1
  let painted = -1 // the console version last put on screen
  let loopIndex = -1
  let schedule = null
  let events = []
  let lastT = 0
  let scene = null
  const mounted = new Map() // id → { el, body, win, state, r, extra }
  const moved = new Map() // id → { x, y } where the person dragged it, or a nudge pushed it
  const raised = new Map() // id → z-index, for windows clicked to the front
  const closed = new Set() // scene windows the person closed; they stay closed for the scene
  let extras = []
  let extraCount = 0
  let zTop = 100

  // The console, and what has been typed.
  let stream = ''
  let cursor = 0
  let lines = []
  let current = ''
  let version = 0
  let typedLine = ''
  let buffer = ''
  let enters = 0
  let eggCount = 0
  let konami = 0
  const down = new Set()
  let keyTimes = []
  let lastKeyAt = 0
  let lastChordAt = -Infinity
  let lastWpmAt = -Infinity
  let solvedAt = null
  let rainBoostUntil = 0
  const presses = {}

  // Full screen and arming.
  let entered = false
  let rearm = false
  let armPresses = 0
  let armedAt = 0
  let fireAt = 0
  let armTimer = 0

  const elapsed = () => (frozen ? offset : offset + (performance.now() - started))
  const ctx = { pools, sprites, world, console: null, reduced: false, elapsed: 0, solvedAt: null, fg: HACKER.green }

  // ---------- full screen ----------

  // The page can only ask for full screen while handling a key or a click, so it is asked for
  // there: at the toggle, at the arm keys (the village waits full screen for the show), and again
  // on the next key or click after Esc took it away.
  function goFullscreen() {
    const d = globalThis.document?.documentElement
    if (!d?.requestFullscreen || document.fullscreenElement) return
    entered = true
    d.requestFullscreen().catch(() => {
      entered = false
    })
  }

  function leaveFullscreen() {
    if (entered && document.fullscreenElement) document.exitFullscreen().catch(() => {})
    entered = false
  }

  function onFullscreenChange() {
    if (document.fullscreenElement) return
    entered = false
    // Esc leaves full screen, not the show: the next key or click puts it back.
    if (on) rearm = true
  }

  function regesture() {
    if (!rearm) return
    rearm = false
    goFullscreen()
  }

  // ---------- arming ----------

  function arm() {
    if (on) return
    if (!armPresses) armedAt = Date.now()
    armPresses++
    fireAt = armedAt + H.armDelay(armPresses)
    clearTimeout(armTimer)
    armTimer = setTimeout(fire, Math.max(0, fireAt - Date.now()))
    goFullscreen()
    const mins = Math.round(H.armDelay(armPresses) / 60_000)
    const text = `Hacker mode in ${mins} min. ${armLabel} adds a minute; ${label} cancels.`
    toast(text)
    announce(text)
  }

  function fire() {
    if (!fireAt || on) return
    const late = Math.max(0, Date.now() - fireAt)
    armPresses = 0
    fireAt = 0
    clearTimeout(armTimer)
    // A timer is no key press, so full screen was taken when it was armed; if it has been lost
    // since, the next key or click brings it back. Started late (a throttled timer), the hack is
    // already that far in.
    start({ offset: late, fullscreen: false })
    if (!document.fullscreenElement) rearm = true
  }

  function disarm(say) {
    if (!fireAt) return false
    clearTimeout(armTimer)
    armPresses = 0
    fireAt = 0
    leaveFullscreen()
    if (say) {
      toast('Hacker mode disarmed.')
      announce('Hacker mode disarmed.')
    }
    return true
  }

  function onVisible() {
    if (document.visibilityState === 'visible' && fireAt && Date.now() >= fireAt) fire()
    if (document.visibilityState === 'hidden') forgetKeys()
  }

  function forgetKeys() {
    down.clear()
    buffer = ''
    konami = 0
  }

  document.addEventListener('visibilitychange', onVisible)
  document.addEventListener('fullscreenchange', onFullscreenChange)

  // ---------- the console ----------

  function pushLine(l) {
    lines.push(l)
    if (lines.length > H.TERM_LINES) lines = lines.slice(-H.TERM_LINES)
    version++
  }

  function say(ls) {
    if (current) {
      pushLine({ tone: '', text: current })
      current = ''
    }
    for (const l of ls) pushLine(l)
    version++
  }

  function typeChunk() {
    const c = H.typerChunk(stream, cursor)
    cursor = c.next
    const parts = (current + c.text).split('\n')
    current = parts.pop()
    for (const p of parts) pushLine({ tone: '', text: p })
    version++
  }

  // ---------- windows ----------

  function geometry(entry) {
    const w = entry.win
    const at = moved.get(w.id) || w
    const s = entry.el.style
    s.left = `${at.x}%`
    s.top = `${at.y}%`
    s.width = `${w.w}%`
    s.height = `${w.h}%`
    s.zIndex = String(raised.get(w.id) ?? w.z)
  }

  function mount(win, extra = false) {
    const el = document.createElement('section')
    el.className = `hk-win hk-${win.kind}`
    el.dataset.id = win.id
    const bar = document.createElement('header')
    bar.className = 'hk-title'
    bar.append(document.createElement('i'), document.createElement('i'), document.createElement('i'))
    const title = document.createElement('span')
    title.textContent = win.title
    const x = document.createElement('button')
    x.type = 'button'
    x.tabIndex = -1
    x.textContent = '✕'
    x.dataset.act = 'close'
    bar.append(title, x)
    const body = document.createElement('div')
    body.className = 'hk-body'
    el.append(bar, body)
    const r = RENDERERS[win.kind] || RENDERERS.popup
    const entry = { el, body, title, win, r, extra, state: null }
    entry.state = r.mount(body, win, ctx)
    geometry(entry)
    desk.appendChild(el)
    mounted.set(win.id, entry)
    return entry
  }

  function unmount(id) {
    const entry = mounted.get(id)
    if (!entry) return
    mounted.delete(id)
    if (ctx.reduced) return entry.el.remove()
    entry.el.classList.add('closing')
    setTimeout(() => entry.el.remove(), 260)
  }

  function openExtra(kind, opts = {}) {
    const id = `x${++extraCount}`
    const rand = mulberry32(hashString(`${seed}:${id}`))
    const [w, h] = [opts.w || EXTRA_SIZE[kind]?.[0] || 28, opts.h || EXTRA_SIZE[kind]?.[1] || 28]
    const now = elapsed()
    const win = {
      kind,
      act: scene?.act || 'recon',
      seed: `${seed}:${id}`,
      title: EXTRA_TITLE[kind] || kind.toUpperCase(),
      cadenceMs: 200,
      ...opts,
      id,
      w,
      h,
      x: Math.round(opts.x ?? 4 + rand() * (92 - w)),
      y: Math.round(opts.y ?? 8 + rand() * (80 - h)),
      z: ++zTop,
      born: now,
      closesAt: now + (opts.life || H.EXTRA_LIFE_MS),
    }
    extras.push(win)
    mount(win, true)
    return win
  }

  function localT(entry, show) {
    return entry.extra ? elapsed() - entry.win.born : show.t - entry.win.opensAt
  }

  function sync(show) {
    const at = H.sceneAt(schedule, show.t)
    if (at.scene !== scene) {
      scene = at.scene
      box.dataset.mood = scene.mood
      ctx.fg = MOOD[scene.mood] || HACKER.green
      closed.clear()
      // The console glides to its place in the new scene, wherever it was dragged.
      moved.delete('console')
      status.act.textContent = scene.label
    }
    const now = elapsed()
    // A frozen show (a screenshot) keeps whatever it opened.
    extras = extras.filter((w) => frozen || now < w.closesAt)
    const want = new Map()
    for (const w of at.open) if (!closed.has(w.id)) want.set(w.id, w)
    for (const w of extras) want.set(w.id, w)
    for (const id of [...mounted.keys()]) if (!want.has(id)) unmount(id)
    for (const [id, w] of want) {
      const entry = mounted.get(id)
      if (!entry) mount(w, Boolean(w.born !== undefined))
      else if (entry.win !== w) {
        // The console, carried over into the next scene under the same id.
        entry.win = w
        entry.title.textContent = w.title
        geometry(entry)
      }
    }
  }

  // ---------- events and eggs ----------

  function cls(name, ms = 600) {
    if (ctx.reduced || !box) return
    box.classList.remove(name)
    void box.offsetWidth
    box.classList.add(name)
    setTimeout(() => box?.classList.remove(name), ms)
  }

  function alert(text, tone = 'err') {
    for (const old of fx.querySelectorAll('.hk-alert')) old.remove()
    const a = document.createElement('div')
    a.className = `hk-alert ${tone === 'ok' ? 'ok' : ''}`
    a.textContent = text
    fx.appendChild(a)
    setTimeout(() => a.remove(), ALERT_MS)
  }

  function note(text) {
    const n = document.createElement('div')
    n.className = 'hk-note'
    n.textContent = text
    notes.appendChild(n)
    while (notes.children.length > 3) notes.firstChild.remove()
    setTimeout(() => n.remove(), NOTE_MS)
  }

  function cover(text, ms, kind = '') {
    const c = document.createElement('div')
    c.className = `hk-cover ${kind}`
    c.textContent = text
    fx.appendChild(c)
    setTimeout(() => c.remove(), ms)
  }

  function nudge(rand) {
    const list = [...mounted.values()]
    if (!list.length) return
    const entry = list[Math.floor(rand() * list.length)]
    moved.set(entry.win.id, H.nudged(entry.win, rand))
    geometry(entry)
  }

  function fireEvent(ev) {
    const c = H.eventContent(ev, pools)
    const rand = mulberry32(hashString(ev.seed))
    if (ev.kind === 'alert') {
      alert(c.text)
      cls('shake')
    } else if (ev.kind === 'popup') openExtra('popup', { title: c.title, text: c.text, life: 8_000 })
    else if (ev.kind === 'notify') note(c.text)
    else if (ev.kind === 'nudge') nudge(rand)
    else if (ev.kind === 'glitch') cls('glitch', 400)
    else if (ev.kind === 'flash') cls('flash', 300)
    else if (ev.kind === 'blackout') cover('SIGNAL LOST', 2_500)
    else if (ev.kind === 'panic') cover(c.lines.join('\n'), 4_500, 'panic')
  }

  function dossierStorm() {
    const list = pools.names
    for (let k = 0; k < 5; k++) openExtra('dossier', { name: list[(eggCount * 7 + k * 13) % list.length], x: 6 + k * 15, y: 12 + k * 7 })
  }

  function egg(id, vars = {}) {
    const n = eggCount++
    say(H.eggLines(id, n, pools, { uptime: H.clockOf(elapsed()), date: clock().toString(), user: 'operator', ...vars }))
    const effect = EGGS[id]?.effect
    if (effect === 'crack') {
      solvedAt = elapsed()
      if (![...mounted.values()].some((e) => e.win.kind === 'cracker')) openExtra('cracker', { life: 8_000 })
    } else if (effect === 'cheer') alert('HACK THE PLANET!', 'ok')
    else if (effect === 'rain') {
      rainBoostUntil = performance.now() + 20_000
      if (!rain && !ctx.reduced) mountRain()
    } else if (effect === 'tictactoe') openExtra('ttt', { life: 12_000 })
    else if (effect === 'enhance') openExtra('feed')
    else if (effect === 'nedry') openExtra('popup', { title: 'ACCESS DENIED', text: 'Ah ah ah!\nYou didn\'t say the magic word.\nAh ah ah!' })
    else if (effect === 'hal') alert('POD BAY DOORS: LOCKED')
    else if (effect === 'god') {
      solvedAt = elapsed()
      alert('GOD MODE · 30 LIVES', 'ok')
      dossierStorm()
    } else if (effect === 'dance') cls('dance', 6_000)
    else if (effect === 'panic') fireEvent({ kind: 'panic', seed: `${seed}:panic${n}` })
    else if (effect === 'unix') openExtra('unix')
    else if (effect === 'train') openExtra('train', { life: 8_000 })
    else if (effect === 'clear') {
      lines = []
      current = ''
      version++
    } else if (effect === 'dossier') openExtra('dossier', { name: vars.name })
    else if (effect === 'shake') cls('shake')
  }

  function press(id, btn) {
    const n = presses[id] || 0
    presses[id] = n + 1
    btn?.classList.remove('pressed')
    void btn?.offsetWidth
    btn?.classList.add('pressed')
    say(H.buttonLines(id, n, pools))
    const rand = mulberry32(hashString(`${seed}:${id}:${n}`))
    if (id === 'trace') openExtra('tracer')
    else if (id === 'isolate') {
      const list = [...mounted.values()].filter((e) => e.win.id !== 'console')
      const victim = list[Math.floor(rand() * list.length)]
      if (victim) {
        if (victim.extra) extras = extras.filter((w) => w.id !== victim.win.id)
        else closed.add(victim.win.id)
        unmount(victim.win.id)
      }
      note('NODE ISOLATED')
    } else if (id === 'counter') {
      openExtra('progress', { act: 'countermeasures' })
      cls('glitch', 400)
    } else if (id === 'reroute') for (let k = 0; k < mounted.size; k++) nudge(rand)
    else if (id === 'encrypt') openExtra('cipher')
    else if (id === 'panic') {
      alert('PANIC MODE ENGAGED')
      cls('shake')
    } else if (id === 'nope') {
      if (H.isStorm(n)) dossierStorm()
      else cls('shake')
    }
  }

  // ---------- keys and the mouse ----------

  function onKeyDown(e) {
    const combo = H.comboOf(e)
    if (combo) {
      e.preventDefault()
      e.stopPropagation()
      if (combo === 'toggle') stop()
      return
    }
    // ⌘Q, ⌘W, ⌘Tab and the rest stay the system's.
    if (e.metaKey || e.ctrlKey) return
    e.stopPropagation()
    // A dock button with the focus is pressed the usual way, and Tab walks the dock.
    if (e.target?.closest?.('.hk-btn') && (e.key === 'Enter' || e.key === ' ')) return
    if (e.key === 'Tab') return tabWithin(e)
    e.preventDefault()
    regesture()
    const now = performance.now()
    lastKeyAt = now
    down.add(e.code)
    if (down.size >= H.TWO_KEYBOARDS_KEYS && now - lastChordAt > 60_000) {
      lastChordAt = now
      egg('twoKeyboards')
    }
    konami = H.konamiStep(konami, e)
    if (konami === H.KONAMI.length) {
      konami = 0
      egg('god')
    }
    if (e.key === 'Enter') return enter()
    if (e.key === 'Backspace') {
      current = current.slice(0, -1)
      typedLine = typedLine.slice(0, -1)
      // A typo fixed is fixed for the eggs too: swordfiss, ⌫, h is swordfish.
      buffer = buffer.slice(0, -1)
      version++
      return
    }
    if (e.key === 'Escape') return egg('exit')
    const key = String(e.key || '')
    if (key.length !== 1) return
    buffer = (buffer + key.toLowerCase()).slice(-32)
    typedLine = (typedLine + key).slice(-64)
    typeChunk()
    keyTimes = keyTimes.filter((t) => t > now - 10_000)
    keyTimes.push(now)
    const wpm = H.wpmOf(keyTimes, now)
    // A burst of typing a person could never keep up earns a remark, once a minute at most.
    if (wpm >= 150 && keyTimes.length >= 30 && now - lastWpmAt > 60_000) {
      lastWpmAt = now
      egg('fast', { wpm })
    }
    const secret = H.secretIn(buffer)
    if (secret) {
      buffer = ''
      typedLine = ''
      egg(secret)
    }
  }

  function onKeyUp(e) {
    down.delete(e.code)
  }

  function enter() {
    const line = typedLine
    typedLine = ''
    const cmd = H.commandOf(line, pools)
    if (cmd) return egg(cmd.egg, cmd.name ? { name: cmd.name } : {})
    say([H.verdictAt(seed, enters++)])
  }

  function tabWithin(e) {
    e.preventDefault()
    const stops = [...box.querySelectorAll('.hk-btn')]
    if (!stops.length) return
    const k = stops.indexOf(document.activeElement)
    const next = k < 0 ? (e.shiftKey ? stops.length - 1 : 0) : (k + (e.shiftKey ? -1 : 1) + stops.length) % stops.length
    stops[next].focus()
  }

  let drag = null
  function onPointerDown(e) {
    regesture()
    const winEl = e.target.closest?.('.hk-win')
    const btn = e.target.closest?.('.hk-btn')
    if (btn) return
    if (!winEl) return box.focus({ preventScroll: true })
    const entry = mounted.get(winEl.dataset.id)
    if (!entry) return
    raised.set(entry.win.id, ++zTop)
    for (const other of mounted.values()) other.el.classList.toggle('focused', other === entry)
    geometry(entry)
    if (e.target.closest('[data-act="close"]')) {
      if (entry.win.id === 'console') return say([{ tone: 'err', text: 'Nice try. The console stays.' }])
      if (entry.extra) extras = extras.filter((w) => w.id !== entry.win.id)
      else closed.add(entry.win.id)
      return unmount(entry.win.id)
    }
    if (!e.target.closest('.hk-title')) return
    const rect = box.getBoundingClientRect()
    const at = moved.get(entry.win.id) || entry.win
    drag = { entry, x0: e.clientX, y0: e.clientY, at: { x: at.x, y: at.y }, w: rect.width, h: rect.height }
    entry.el.classList.add('dragging')
    e.target.setPointerCapture?.(e.pointerId)
    e.preventDefault()
  }

  function onPointerMove(e) {
    if (!drag) return
    const { entry } = drag
    const x = Math.max(-entry.win.w + 8, Math.min(92, drag.at.x + ((e.clientX - drag.x0) / drag.w) * 100))
    const y = Math.max(3, Math.min(90, drag.at.y + ((e.clientY - drag.y0) / drag.h) * 100))
    moved.set(entry.win.id, { x, y })
    geometry(entry)
  }

  function onPointerUp() {
    if (!drag) return
    drag.entry.el.classList.remove('dragging')
    drag = null
    box?.focus({ preventScroll: true })
  }

  function onClick(e) {
    const btn = e.target.closest?.('.hk-btn')
    if (!btn) return
    press(btn.dataset.id, btn)
    // Back to the console, so a space typed next doesn't press the button again.
    if (e.detail) box.focus({ preventScroll: true })
  }

  function onBlur() {
    down.clear()
  }

  // ---------- the overlay ----------

  function mountRain() {
    rainCanvas = document.createElement('canvas')
    rainCanvas.className = 'hk-matrix'
    rainCanvas.setAttribute('aria-hidden', 'true')
    box.prepend(rainCanvas)
    rain = createRain(rainCanvas, seed)
  }

  function build() {
    box = document.createElement('div')
    box.className = 'hacker'
    box.tabIndex = -1
    box.setAttribute('role', 'dialog')
    box.setAttribute('aria-modal', 'true')
    box.setAttribute('aria-label', `Pretend hacking scene. Nothing is really happening. Press ${label} to leave.`)
    status = document.createElement('div')
    status.className = 'hk-status'
    status.setAttribute('aria-hidden', 'true')
    const span = (c = '') => {
      const s = document.createElement('span')
      if (c) s.className = c
      status.appendChild(s)
      return s
    }
    status.act = span('act')
    status.rec = span('rec')
    status.rec.textContent = '● LIVE'
    status.info = span()
    span('sp')
    status.clock = span()
    desk = document.createElement('div')
    desk.className = 'hk-desk'
    desk.setAttribute('aria-hidden', 'true')
    const dock = document.createElement('div')
    dock.className = 'hk-dock'
    for (const b of BUTTONS) {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = `hk-btn${b.danger ? ' danger' : ''}`
      btn.dataset.id = b.id
      btn.textContent = b.label
      dock.appendChild(btn)
    }
    fx = document.createElement('div')
    fx.className = 'hk-fx'
    fx.setAttribute('aria-hidden', 'true')
    notes = document.createElement('div')
    notes.className = 'hk-notes'
    fx.appendChild(notes)
    const hint = document.createElement('div')
    hint.className = 'hk-hint'
    hint.textContent = `[ OPERATOR ] ${label} ends the session`
    setTimeout(() => hint.remove(), 3_300)
    box.append(desk, status, dock, fx, hint)
    if (!ctx.reduced) mountRain()
    box.addEventListener('pointerdown', onPointerDown)
    box.addEventListener('pointermove', onPointerMove)
    box.addEventListener('pointerup', onPointerUp)
    box.addEventListener('pointercancel', onPointerUp)
    box.addEventListener('click', onClick)
    root.appendChild(box)
  }

  function textTick(show) {
    ctx.elapsed = elapsed()
    ctx.solvedAt = solvedAt
    ctx.console = { lines, current, version }
    painted = version
    sync(show)
    for (const entry of mounted.values()) entry.r.update(entry.state, entry.win, localT(entry, show), ctx, entry.body)
    if (!frozen && performance.now() - lastKeyAt > AUTOPILOT_IDLE_MS && lastTick % 2 === 0) typeChunk()
    if (!frozen) {
      for (const ev of H.eventsToFire(events, lastT, show.t)) fireEvent(ev)
    }
    lastT = show.t
    const now = clock()
    // In a lockdown the clock runs backwards, as a countdown would.
    const shown = scene?.act === 'lockdown' ? new Date(now.getTime() - 2 * (show.t - scene.start)) : now
    const st = H.statusAt(ctx.elapsed)
    status.info.textContent = `UPLINK ${st.uplink} Gb/s · TRACE ${st.trace}% · LOOP ${show.loop + 1} · UP ${H.clockOf(ctx.elapsed)}`
    status.clock.textContent = shown.toLocaleTimeString('en-GB', { hour12: false })
  }

  function frame(now) {
    if (!on) return
    raf = requestAnimationFrame(frame)
    const dt = Math.min(0.1, (now - (lastFrame || now)) / 1000)
    lastFrame = now
    ctx.reduced = reducedMotion()
    const e = elapsed()
    const show = H.showAt(seed, e)
    if (show.loop !== loopIndex) {
      loopIndex = show.loop
      schedule = H.scheduleFor(show.seed, pools, swap)
      events = H.eventsFor(show.seed)
      lastT = show.t
    }
    const tick = Math.floor(e / H.TEXT_TICK_MS)
    // A key typed shows at once, not on the next tick; and in a frozen show (a screenshot), at all.
    const ticked = tick !== lastTick || version !== painted
    if (ticked) {
      lastTick = tick
      textTick(show)
    }
    // Canvases move every frame; with reduced motion, only when the text does.
    if (ctx.reduced && !ticked) return
    for (const entry of mounted.values()) entry.r.frame?.(entry.state, entry.win, localT(entry, show), ctx, dt)
    if (rain) {
      if (ctx.reduced) {
        rainCanvas.remove()
        rain = null
      } else {
        const boost = performance.now() < rainBoostUntil
        rainCanvas.classList.toggle('boost', boost)
        rain.draw(dt, ctx.fg, boost)
      }
    }
  }

  /**
   * Start the show. `seed` picks the show (a new one each time by default); `at` starts it that
   * far in; `frozen` holds it still there, for a screenshot; `fullscreen: false` stays windowed.
   */
  function start({ seed: s, at = 0, offset: off = 0, frozen: fr = false, fullscreen = true } = {}) {
    if (on) return
    disarm(false)
    on = true
    pools = { names: names()?.length ? names() : VILLAGER_NAMES, repos: repos()?.length ? repos() : H.DEFAULT_POOLS.repos }
    ctx.pools = pools
    ctx.reduced = reducedMotion()
    seed = typeof s === 'string' && s ? s : String(Date.now())
    offset = Math.max(0, Number(at) || 0) + Math.max(0, Number(off) || 0)
    frozen = Boolean(fr)
    started = performance.now()
    lastFrame = 0
    lastTick = -1
    painted = -1
    loopIndex = -1
    scene = null
    mounted.clear()
    moved.clear()
    raised.clear()
    closed.clear()
    extras = []
    zTop = 100
    stream = H.codeStream(seed, pools)
    cursor = 0
    lines = []
    current = ''
    typedLine = ''
    enters = 0
    solvedAt = null
    forgetKeys()
    lastKeyAt = 0
    // Nothing from the last show carries over, so the same seed is the same show.
    eggCount = 0
    extraCount = 0
    keyTimes = []
    lastChordAt = -Infinity
    lastWpmAt = -Infinity
    rainBoostUntil = 0
    for (const k of Object.keys(presses)) delete presses[k]
    const r = mulberry32(hashString(seed))
    say(CONSOLE_BANNER.map((l) => H.toneOf(H.fill(l, r, pools))))
    build()
    if (fullscreen) goFullscreen()
    document.addEventListener('keydown', onKeyDown, true)
    document.addEventListener('keyup', onKeyUp, true)
    addEventListener('blur', onBlur)
    onStart()
    announce(`Hacker mode: a show, nothing is really happening. Press ${label} to stop.`)
    box.focus({ preventScroll: true })
    raf = requestAnimationFrame(frame)
  }

  function stop() {
    if (!on) return
    on = false
    cancelAnimationFrame(raf)
    document.removeEventListener('keydown', onKeyDown, true)
    document.removeEventListener('keyup', onKeyUp, true)
    removeEventListener('blur', onBlur)
    box?.remove()
    box = null
    rain = null
    rainCanvas = null
    mounted.clear()
    extras = []
    drag = null
    rearm = false
    leaveFullscreen()
    announce('Hacker mode off.')
    onStop()
  }

  return {
    start,
    stop,
    arm,
    /** The toggle keys: cancel an armed show, else start or stop one. */
    toggle() {
      if (disarm(true)) return
      if (on) stop()
      else start()
    },
    get on() {
      return on
    },
    /** The running show's seed, or ''. */
    get session() {
      return on ? seed : ''
    },
    /** When an armed show will start (ms since the epoch), or 0. */
    get armedUntil() {
      return fireAt
    },
  }
}
