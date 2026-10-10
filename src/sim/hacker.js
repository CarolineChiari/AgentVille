// Hollywood hacker mode, the part that decides what is on screen. Pure, and nothing from the DOM,
// so it runs under `node --test`; src/ui/hacker.js draws it.
//
// The show is a schedule of scenes, two hours long, dealt from a seed. Everything a window shows
// is a function of its seed and how long it has been open, never of how many frames were drawn:
// a tab left hidden for ten minutes comes back to the right picture, and a test can look at any
// moment without playing the rest. Only what the person types or clicks is state, and that lives
// in the UI.
import { hashString, pick, range, rngFor } from './rng.js'
import { VILLAGER_NAMES } from './names.js'
import * as T from './hacker-text.js'

/** The physical key, not the character: ⌥H types ˙ on a Mac, and AZERTY moves letters about. */
export const KEY_CODE = 'KeyH'
/** Long enough to fetch a coffee and come back to a show that is still going somewhere. */
export const LOOP_MS = 2 * 60 * 60_000
/** Text redraws at 12.5 Hz: fast enough to stream, slow enough not to cost a frame. */
export const TEXT_TICK_MS = 80
/** More than seven windows and nothing in any of them can be read. */
export const MAX_WINDOWS = 7
/** Lines a terminal keeps; more would only ever be scrolled out of sight. */
export const TERM_LINES = 40
export const HEX_ROWS = 24
export const CODE_LINES = 30
/** One press of the arm keys is a minute; each more is another, up to an hour. */
export const ARM_STEP_MS = 60_000
export const ARM_MAX_MS = 60 * 60_000
/** A window a button or an egg opened stays this long, unless the person closes it first. */
export const EXTRA_LIFE_MS = 20_000
/** A gap longer than this between two ticks means the tab was hidden: fire only the latest event. */
export const CATCH_UP_MS = 5_000
/** Mashing four keys at once is the cue for the two-keyboards gag; three happens in fast typing. */
export const TWO_KEYBOARDS_KEYS = 4

// Scenes last a few minutes: long enough for a window to get somewhere, short enough to keep moving.
const MIN_SCENE_MS = 150_000
const MAX_SCENE_MS = 330_000

export const DEFAULT_POOLS = { names: VILLAGER_NAMES, repos: T.FAKE_REPOS }
/** The BroadcastChannel the village and the show on your other screens stop each other through. */
export const SHOW_CHANNEL = 'agentville-hacker'

const TONES = { '!': 'err', '+': 'ok', '?': 'warn', '~': 'dim' }

// ---------- keys ----------

/**
 * What a keydown means to the show: 'toggle' (⌘⇧H, Ctrl+Shift+H), 'arm' (the same with ⌥/Alt),
 * or null.
 */
export function comboOf(e) {
  // A held chord repeats its keydown: one physical press must toggle once and add one minute.
  if (!e || typeof e !== 'object' || e.repeat) return null
  if (e.code !== KEY_CODE || !e.shiftKey || !(e.metaKey || e.ctrlKey)) return null
  return e.altKey ? 'arm' : 'toggle'
}

/** The keys as this keyboard writes them, for the hint and the help sheet. */
export const comboLabel = (platform = '', arm = false) =>
  /Mac|iPhone|iPad/.test(platform) ? (arm ? '⌘⇧⌥H' : '⌘⇧H') : arm ? 'Ctrl+Shift+Alt+H' : 'Ctrl+Shift+H'

/** How long until an armed show starts, after this many presses of the arm keys. */
export const armDelay = (presses) => Math.min(ARM_MAX_MS, Math.max(1, Math.floor(Number(presses) || 0)) * ARM_STEP_MS)

export const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a']

/**
 * The Konami code, one key at a time: returns how far along it is now. KONAMI.length means done.
 * Arrows by `code`, the letters by `key`, so it is B and A wherever a layout puts them.
 */
export function konamiStep(progress, e) {
  const k = String(e?.code || '').startsWith('Arrow') ? e.code : String(e?.key || '').toLowerCase()
  if (k === KONAMI[progress]) return progress + 1
  // ↑↑↑ is still two ups in a row; any other first key starts again.
  if (k === KONAMI[0]) return progress === 2 ? 2 : 1
  return 0
}

/** Words per minute, from the times keys were pressed, over the last `windowMs`. */
export function wpmOf(times, now, windowMs = 10_000) {
  const n = times.filter((t) => t > now - windowMs && t <= now).length
  return Math.round((n / 5) * (60_000 / windowMs))
}

// ---------- words ----------

const lower = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '')
const hex8 = (rand) => Math.floor(rand() * 2 ** 32).toString(16).padStart(8, '0').toUpperCase()

/** A made-up IPv4 address; with `eggs`, sometimes one no network would route (see IP_EGGS). */
export function ipOf(rand, eggs = true) {
  if (eggs && rand() < 0.05) return pick(rand, T.IP_EGGS)
  return Array.from({ length: 4 }, () => 1 + Math.floor(rand() * 254)).join('.')
}

function poolsOf(p) {
  const names = Array.isArray(p?.names) && p.names.length ? p.names : DEFAULT_POOLS.names
  const repos = Array.isArray(p?.repos) && p.repos.length ? p.repos : DEFAULT_POOLS.repos
  return { names, repos }
}

/** A villager's machine: wren-mainframe, otto-db01. */
export const hostOf = (rand, pools) => `${lower(pick(rand, poolsOf(pools).names)) || 'node'}-${pick(rand, T.HOST_SUFFIX)}`

/** Fill a template's {slots}. `vars` wins over the made-up values; unknown slots are left as they are. */
export function fill(tpl, rand, pools = DEFAULT_POOLS, vars = {}) {
  const p = poolsOf(pools)
  return String(tpl).replace(/\{(\w+)\}/g, (m, k) => {
    if (Object.hasOwn(vars, k)) return String(vars[k])
    switch (k) {
      case 'name': return pick(rand, p.names)
      case 'host': return hostOf(rand, p)
      case 'repo': return pick(rand, p.repos)
      case 'user': return pick(rand, ['root', 'operator', 'admin', 'neo'])
      case 'handle': return pick(rand, T.HANDLES)
      case 'ip': return ipOf(rand)
      case 'port': return String(pick(rand, T.PORTS))
      case 'hex': return hex8(rand)
      case 'n': return String(2 + Math.floor(rand() * 9998))
      case 'pct': return String(Math.floor(rand() * 101))
      case 'ms': return String(1 + Math.floor(rand() * 300))
      case 'file': return pick(rand, T.FILES)
      case 'city': return pick(rand, T.CITIES)[0]
      case 'tool': return pick(rand, T.TOOLS)
      case 'eta': return pick(rand, T.ETAS)
      case 'quip': return pick(rand, T.QUIPS)
      default: return m
    }
  })
}

/** A line's colour from its leading mark (see hacker-text.js), and the line without it. */
export function toneOf(line) {
  const m = /^([!+?~]) ([\s\S]*)$/.exec(String(line))
  return m ? { tone: TONES[m[1]], text: m[2] } : { tone: '', text: String(line) }
}

const filled = (tpl, rand, pools, vars) => toneOf(fill(tpl, rand, pools, vars))

/** Hours, minutes and seconds: 01:07:42. */
export function clockOf(ms) {
  const s = Math.max(0, Math.floor(ms / 1000))
  const two = (n) => String(n).padStart(2, '0')
  return `${two(Math.floor(s / 3600))}:${two(Math.floor(s / 60) % 60)}:${two(s % 60)}`
}

// ---------- the schedule ----------

export const ACT_IDS = Object.keys(T.ACTS)

/** Each loop of the show has its own seed, so the second two hours are not the first again. */
export const loopSeed = (seed, n) => `${seed}/${n}`

/** Which loop and how far into it, for a moment of the whole show. */
export function showAt(seed, elapsed) {
  const e = Math.max(0, elapsed)
  const loop = Math.floor(e / LOOP_MS)
  return { loop, seed: loopSeed(seed, loop), t: e - loop * LOOP_MS }
}

function shuffle(rand, list) {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// [width, height] in percent of the screen, before a little jitter.
const SIZES = {
  console: [44, 40], terminal: [34, 32], code: [32, 40], hex: [38, 40], cracker: [36, 20], progress: [32, 26],
  globe: [28, 40], chat: [28, 36], tracer: [38, 40], feed: [34, 40], dossier: [22, 38], cipher: [44, 20], sysmon: [26, 26],
}
// Where windows stand, in percent; each window in a scene takes a different one, so they overlap
// the way a film's do without ever stacking exactly.
const ANCHORS = [[2, 6], [35, 6], [66, 6], [2, 48], [35, 48], [66, 48], [18, 26], [50, 27]]
// The screen between the status bar at the top and the row of buttons at the bottom.
const TOP = 5
const BOTTOM = 90

/** How fast each kind of window moves, per window: a line, a character or a row every this many ms. */
function cadenceOf(kind, rand) {
  if (kind === 'chat') return Math.round(range(rand, 1600, 3400))
  if (kind === 'code') return Math.round(range(rand, 30, 70))
  if (kind === 'hex') return Math.round(range(rand, 160, 380))
  return Math.round(range(rand, 110, 420))
}

function place(kind, anchor, rand) {
  const [bw, bh] = SIZES[kind]
  const w = Math.min(96, Math.round(bw * range(rand, 0.9, 1.15)))
  const h = Math.min(BOTTOM - TOP, Math.round(bh * range(rand, 0.9, 1.15)))
  const x = Math.round(Math.max(1, Math.min(99 - w, anchor[0] + range(rand, -3, 3))))
  const y = Math.round(Math.max(TOP, Math.min(BOTTOM - h, anchor[1] + range(rand, -3, 3))))
  return { x, y, w, h }
}

function layoutScene(scene, ls, pools, swap) {
  const rand = rngFor(`scene:${ls}:${scene.i}`)
  const act = T.ACTS[scene.act]
  const may = shuffle(rand, act.may)
  const total = Math.min(MAX_WINDOWS, 1 + act.need.length + 1 + Math.floor(rand() * may.length))
  const kinds = [...act.need, ...may].slice(0, total - 1).map((k) => swap?.[k] || k)
  const anchors = shuffle(rand, ANCHORS)
  const windows = []
  let opensAt = scene.start
  kinds.forEach((kind, k) => {
    const seed = `${ls}:${scene.i}.${k}`
    const r = rngFor(seed)
    // One after another, the way a film opens them.
    opensAt += Math.round(range(rand, 300, 1200))
    windows.push({
      id: seed, kind, act: scene.act, seed,
      title: fill(pick(r, T.TITLES[kind]), r, pools),
      ...place(kind, anchors[k], r),
      z: k + 1,
      opensAt,
      // Closing a little before the scene ends lets the change read as windows going and coming.
      closesAt: Math.max(opensAt + 30_000, scene.end - Math.round(range(rand, 0, 2500))),
      cadenceMs: cadenceOf(kind, r),
    })
  })
  // The console stays open from scene to scene, under the one id, so whatever was typed into it
  // stays and it only glides to its new place.
  const cr = rngFor(`${ls}:${scene.i}.console`)
  windows.push({
    id: 'console', kind: 'console', act: scene.act, seed: `${ls}:console`,
    title: fill(T.TITLES.console[0], cr, pools),
    ...place('console', anchors[kinds.length], cr),
    z: kinds.length + 1,
    opensAt: scene.start,
    closesAt: scene.end,
    cadenceMs: 0,
  })
  return windows
}

/**
 * One loop of the show: scenes that tile [0, LOOP_MS) exactly. Acts are dealt like cards, so no
 * act follows itself and each comes round at least twice; every window kind is in some act's
 * `need`, so every kind is on screen at least twice a loop too. `swap` trades one kind for
 * another: a screen with no village behind it has no villagers for a live feed to follow.
 */
export function scheduleFor(ls, pools = DEFAULT_POOLS, swap = null) {
  const rand = rngFor(`schedule:${ls}`)
  const scenes = []
  let deck = []
  let prev = null
  let start = 0
  while (start < LOOP_MS) {
    if (!deck.length) {
      deck = shuffle(rand, ACT_IDS)
      if (deck[0] === prev) deck.push(deck.shift())
    }
    const act = deck.shift()
    let end = start + Math.round(range(rand, MIN_SCENE_MS, MAX_SCENE_MS))
    // Never leave a sliver too short to be a scene of its own at the end.
    if (LOOP_MS - end < MIN_SCENE_MS) end = LOOP_MS
    const scene = { i: scenes.length, act, mood: T.ACTS[act].mood, label: T.ACTS[act].label, start, end }
    scene.windows = layoutScene(scene, ls, pools, swap)
    scenes.push(scene)
    prev = act
    start = end
  }
  return scenes
}

/** Every window kind a schedule puts on screen. */
export const coverage = (schedule) => new Set(schedule.flatMap((s) => s.windows.map((w) => w.kind)))

/** The scene at `t` into a loop, how far into it, and which of its windows are open. */
export function sceneAt(schedule, t) {
  const scene = schedule.find((s) => t >= s.start && t < s.end) || schedule[schedule.length - 1]
  return { scene, t: t - scene.start, open: scene.windows.filter((w) => t >= w.opensAt && t < w.closesAt) }
}

/** A window pushed somewhere nearby, still on screen. */
export function nudged(win, rand) {
  return {
    x: Math.round(Math.max(1, Math.min(99 - win.w, win.x + range(rand, -8, 8)))),
    y: Math.round(Math.max(TOP, Math.min(BOTTOM - win.h, win.y + range(rand, -6, 6)))),
  }
}

// ---------- events ----------

// Twelve to a deck: the gentle ones twice, the loud ones once.
const EVENT_DECK = ['alert', 'alert', 'popup', 'popup', 'notify', 'notify', 'nudge', 'nudge', 'glitch', 'flash', 'blackout', 'panic']
export const EVENT_KINDS = [...new Set(EVENT_DECK)]

/** The loop's one-off moments, between scenes' own: a red alert, a popup, a blackout. */
export function eventsFor(ls) {
  const rand = rngFor(`events:${ls}`)
  const out = []
  let deck = []
  // A minute of calm first, so the show has started before anything shouts.
  let at = 60_000
  while (at < LOOP_MS - 10_000) {
    if (!deck.length) deck = shuffle(rand, EVENT_DECK)
    out.push({ at: Math.round(at), kind: deck.shift(), seed: `${ls}:e${out.length}` })
    at += range(rand, 35_000, 110_000)
  }
  return out
}

/** The events whose moment falls in [from, to). After a long gap only the latest: no burst. */
export function eventsToFire(events, from, to) {
  const due = events.filter((e) => e.at >= from && e.at < to)
  return to - from > CATCH_UP_MS ? due.slice(-1) : due
}

/** What an event says. */
export function eventContent(ev, pools = DEFAULT_POOLS) {
  const rand = rngFor(ev.seed)
  if (ev.kind === 'alert') return { text: fill(pick(rand, T.ALERTS), rand, pools) }
  if (ev.kind === 'popup') {
    const p = pick(rand, T.POPUPS)
    return { title: fill(p.title, rand, pools), text: fill(p.body, rand, pools) }
  }
  if (ev.kind === 'notify') return { text: fill(pick(rand, T.POPUPS).body.split('\n')[0], rand, pools) }
  if (ev.kind === 'panic') return { lines: T.PANIC_LINES.map((l) => fill(l, rand, pools)) }
  return { seed: hashString(ev.seed) }
}

// ---------- what each window shows ----------

/** One line of a streaming window: a terminal's log, or a chat. */
export function lineAt(win, i, pools = DEFAULT_POOLS) {
  const rand = rngFor(`${win.seed}:${i}`)
  if (win.kind === 'chat') {
    const who = rand() < 0.3 ? lower(pick(rand, poolsOf(pools).names)) : pick(rand, T.HANDLES)
    return { i, tone: '', who, text: fill(pick(rand, T.CHAT), rand, pools) }
  }
  // Now and then a joke slips into the log.
  if (rand() < 0.04) return { i, ...filled(pick(rand, T.EGG_LINES), rand, pools) }
  const own = T.LOGS[win.act] || T.LOGS.common
  return { i, ...filled(pick(rand, rand() < 0.3 ? T.LOGS.common : own), rand, pools) }
}

/** A streaming window's visible lines at `localT` ms after it opened: append-only, newest last. */
export function streamAt(win, localT, pools = DEFAULT_POOLS) {
  const n = Math.floor(Math.max(0, localT) / Math.max(1, win.cadenceMs))
  const lines = []
  for (let i = Math.max(0, n - TERM_LINES + 1); i <= n; i++) lines.push(lineAt(win, i, pools))
  return lines
}

/** A long run of plausible code, shuffled and filled for this seed. */
export function codeStream(seed, pools = DEFAULT_POOLS) {
  const rand = rngFor(`code:${seed}`)
  return shuffle(rand, T.CODE).map((c) => fill(c, rand, pools)).join('\n')
}

/** The last lines of the code a `code` window has "written" by `localT`. Loops round when it runs out. */
export function codeAt(stream, win, localT) {
  const chars = Math.floor(Math.max(0, localT) / Math.max(1, win.cadenceMs))
  const L = stream.length
  const text = (chars >= L ? stream : '') + stream.slice(0, chars % L)
  const lines = text.split('\n')
  return { lines: lines.slice(-CODE_LINES), done: false }
}

/**
 * The next few characters the console "types" for a keystroke, hackertyper style: whatever key
 * is pressed, the code comes out right. Returns the text and where the next one starts.
 */
export function typerChunk(stream, cursor) {
  const L = stream.length
  const at = ((cursor % L) + L) % L
  const size = 3 + (hashString(`typer:${at}`) % 4)
  const text = stream.slice(at, at + size) || stream.slice(0, size)
  return { text, next: (at + text.length) % L }
}

/** What the nth Enter says: denied, denied, denied, then in. */
export function verdictAt(seed, n) {
  const rand = rngFor(`${seed}:verdict:${n}`)
  return toneOf(pick(rand, n % 4 === 3 ? T.VERDICTS.granted : T.VERDICTS.denied))
}

const SECRET_KEYS = Object.keys(T.SECRETS).sort((a, b) => b.length - a.length)

/** The egg the last keys typed spell, if any: the longest secret the buffer ends with. */
export function secretIn(buffer) {
  const b = String(buffer || '').toLowerCase()
  const key = SECRET_KEYS.find((k) => b.endsWith(k))
  return key ? T.SECRETS[key] : null
}

/** A line typed and then Enter: a command the console knows, a villager's name, or null. */
export function commandOf(line, pools = DEFAULT_POOLS) {
  const w = String(line || '').trim().toLowerCase().replace(/^\$\s*/, '')
  if (!w) return null
  if (Object.hasOwn(T.COMMANDS, w)) return { egg: T.COMMANDS[w] }
  const name = poolsOf(pools).names.find((n) => String(n).toLowerCase() === w)
  return name ? { egg: 'operative', name } : null
}

/** An egg's lines, filled. */
export function eggLines(id, seed, pools = DEFAULT_POOLS, vars = {}) {
  const egg = T.EGGS[id]
  if (!egg) return []
  const rand = rngFor(`egg:${id}:${seed}`)
  return egg.lines.map((l) => filled(l, rand, pools, vars))
}

/** What a dock button prints, the nth time it is pressed. */
export function buttonLines(id, n, pools = DEFAULT_POOLS) {
  if (id === 'nope') return [toneOf(`! ${T.DO_NOT_PRESS[n % T.DO_NOT_PRESS.length]}`)]
  const lines = T.BUTTON_LINES[id] || []
  if (!lines.length) return []
  const rand = rngFor(`button:${id}:${n}`)
  return [filled(lines[n % lines.length], rand, pools)]
}

/** Whether the nth press of DO NOT PRESS is the one that lets every dossier out. */
export const isStorm = (n) => n % T.DO_NOT_PRESS.length === T.DO_NOT_PRESS.length - 1

const GLYPH_LIST = [...T.GLYPHS]
const scramble = (target, keep, rand) => [...target].map((c, i) => (i < keep || c === ' ' ? c : GLYPH_LIST[Math.floor(rand() * GLYPH_LIST.length)])).join('')

// A password locks in over nine seconds, says so for three, and the screen rests for two.
const CRACK_LOCK_MS = 9_000
const CRACK_HOLD_MS = 3_000
const CRACK_CYCLE_MS = 14_000

/** The password cracker: letters locking in one at a time, then ACCESS GRANTED, then the next. */
export function crackerAt(win, localT) {
  const t = Math.max(0, localT)
  const k = Math.floor(t / CRACK_CYCLE_MS)
  const phase = t % CRACK_CYCLE_MS
  const target = pick(rngFor(`${win.seed}:pw${k}`), T.PASSWORDS)
  const locked = Math.min(target.length, Math.floor(phase / (CRACK_LOCK_MS / target.length)))
  const tick = Math.floor(t / TEXT_TICK_MS)
  return {
    k,
    target,
    locked,
    display: scramble(target, locked, rngFor(`${win.seed}:g${tick}`)),
    granted: phase >= CRACK_LOCK_MS && phase < CRACK_LOCK_MS + CRACK_HOLD_MS,
    blank: phase >= CRACK_LOCK_MS + CRACK_HOLD_MS,
    attempts: k * 4_000_000 + Math.floor(phase * 431),
  }
}

/** Progress bars: some fill and start again; one, often, gets to 99% and stays there forever. */
export function progressAt(win, localT, pools = DEFAULT_POOLS) {
  const t = Math.max(0, localT)
  const rand = rngFor(`${win.seed}:bars`)
  const count = 3 + Math.floor(rand() * 3)
  const stuckAt = rand() < 0.6 ? Math.floor(rand() * count) : -1
  const labels = [...T.PROGRESS.common, ...(T.PROGRESS[win.act] || [])]
  const bars = []
  for (let j = 0; j < count; j++) {
    const period = range(rand, 18_000, 75_000)
    const offset = rand() * period
    if (j === stuckAt) {
      const r = rngFor(`${win.seed}:${j}`)
      const label = fill(pick(r, labels), r, pools)
      const eta = T.ETAS[(Math.floor(t / 3000) + j) % T.ETAS.length]
      bars.push({ label, pct: Math.min(99, Math.floor((t / period) * 140)), eta, stuck: true })
      continue
    }
    const c = t + offset
    const k = Math.floor(c / period)
    const frac = (c % period) / period
    const r = rngFor(`${win.seed}:${j}:${k}`)
    const label = fill(pick(r, labels), r, pools)
    // The last few percent of each period it sits at 100 and says so, before the next starts.
    const done = frac >= 0.92
    bars.push({ label, pct: done ? 100 : Math.floor((frac / 0.92) * 100), eta: done ? 'DONE' : `${Math.ceil(((0.92 - frac) * period) / 1000)}s`, stuck: false })
  }
  return bars
}

/** A word hidden in a hex dump's ASCII column: one of HIDDEN_WORDS, or a villager who was here. */
function hiddenWord(rand, pools) {
  if (rand() < 0.25) return `${String(pick(rand, poolsOf(pools).names)).toUpperCase().replace(/[^ -~]/g, '')} WAS HERE`.slice(0, 16)
  return pick(rand, T.HIDDEN_WORDS).slice(0, 16)
}

/** Rows of a hex dump: offset, sixteen bytes and their ASCII. Every sixth row's ASCII spells a word. */
export function hexRows(seed, row0, count, pools = DEFAULT_POOLS) {
  const rows = []
  for (let r = row0; r < row0 + count; r++) {
    const rand = rngFor(`${seed}:row${r}`)
    let bytes
    let word = ''
    if (r % 6 === 0) {
      word = hiddenWord(rand, pools)
      const pad = Math.floor(rand() * (17 - word.length))
      bytes = Array.from({ length: 16 }, (_, i) => (i >= pad && i < pad + word.length ? word.charCodeAt(i - pad) : Math.floor(rand() * 32)))
    } else {
      bytes = Array.from({ length: 16 }, () => Math.floor(rand() * 256))
    }
    rows.push({
      offset: (r * 16).toString(16).padStart(8, '0').toUpperCase(),
      hex: bytes.map((b) => b.toString(16).padStart(2, '0').toUpperCase()),
      ascii: bytes.map((b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : '.')).join(''),
      word,
    })
  }
  return rows
}

export const hexAt = (win, localT, pools) => hexRows(win.seed, Math.floor(Math.max(0, localT) / Math.max(1, win.cadenceMs)), HEX_ROWS, pools)

// A ping every 1.4 s that lasts nine: about six on the globe at once.
const PING_EVERY_MS = 1_400
const PING_LIFE_MS = 9_000

/** The globe: how far it has turned, and the pings on it now, with their cities. */
export function globeAt(win, localT) {
  const t = Math.max(0, localT)
  const pings = []
  const last = Math.floor(t / PING_EVERY_MS)
  for (let j = Math.max(0, Math.ceil((t - PING_LIFE_MS) / PING_EVERY_MS)); j <= last; j++) {
    const [city, lat, lon] = pick(rngFor(`${win.seed}:p${j}`), T.CITIES)
    pings.push({ j, city, lat, lon, age: t - j * PING_EVERY_MS, life: PING_LIFE_MS })
  }
  return { rot: (hashString(win.seed) % 628) / 100 + (t / 1000) * 0.2, pings }
}

// Twelve hops a second and a half apart, then six seconds of TRACE COMPLETE, then the next.
const HOP_MS = 1_500
const HOPS = 12
const TRACE_HOLD_MS = 6_000

/** The IP tracer: hops coming in one by one until the trace completes. */
export function tracerAt(win, localT) {
  const t = Math.max(0, localT)
  const cycle = HOP_MS * HOPS + TRACE_HOLD_MS
  const k = Math.floor(t / cycle)
  const phase = t % cycle
  const rand = rngFor(`${win.seed}:tr${k}`)
  const target = ipOf(rand)
  const handle = pick(rand, T.HANDLES)
  const shown = Math.min(HOPS, Math.floor(phase / HOP_MS) + 1)
  const hops = []
  for (let h = 0; h < shown; h++) {
    const r = rngFor(`${win.seed}:tr${k}:${h}`)
    hops.push({ n: h + 1, ip: ipOf(r, h === HOPS - 1), city: pick(r, T.CITIES)[0], ms: Math.floor(range(r, 4, 30 * (h + 1))) })
  }
  return { k, target, handle, hops, pct: Math.min(100, Math.round((phase / (HOP_MS * HOPS)) * 100)), done: phase >= HOP_MS * HOPS }
}

// A saying decrypts over twelve seconds and holds for six.
const CIPHER_REVEAL_MS = 12_000
const CIPHER_CYCLE_MS = 18_000

/** A line decrypting under cycling glyphs. */
export function cipherAt(win, localT) {
  const t = Math.max(0, localT)
  const k = Math.floor(t / CIPHER_CYCLE_MS)
  const phase = t % CIPHER_CYCLE_MS
  const text = pick(rngFor(`${win.seed}:q${k}`), T.QUIPS)
  const revealed = Math.min(text.length, Math.floor(phase / (CIPHER_REVEAL_MS / text.length)))
  return { k, text, revealed, display: scramble(text, revealed, rngFor(`${win.seed}:c${Math.floor(t / TEXT_TICK_MS)}`)), done: revealed >= text.length }
}

// A sample every 300 ms, forty on a graph: twelve seconds of history.
const SAMPLE_MS = 300
const SAMPLES = 40

const smooth = (seed, i) => {
  const a = rngFor(`${seed}:${Math.floor(i / 8)}`)()
  const b = rngFor(`${seed}:${Math.floor(i / 8) + 1}`)()
  const f = (i % 8) / 8
  return Math.max(0, Math.min(1, a + (b - a) * f + (rngFor(`${seed}:j${i}`)() - 0.5) * 0.15))
}

/** The system monitor's graphs, from seeded noise; RAM climbs past 100% because more was downloaded. */
export function sysmonAt(win, localT) {
  const t = Math.max(0, localT)
  const n = Math.floor(t / SAMPLE_MS)
  const series = (name) => Array.from({ length: SAMPLES }, (_, k) => smooth(`${win.seed}:${name}`, n - SAMPLES + 1 + k))
  return {
    cpu: series('cpu'),
    net: series('net'),
    ram: Math.min(110, Math.floor(40 + (t / 1000) * 0.9)),
    temp: Math.round(55 + smooth(`${win.seed}:temp`, n) * 45),
  }
}

// ENHANCE, three times, then a name: sixteen seconds round.
const ENHANCE_CYCLE_MS = 16_000
const ENHANCE_STEPS = [[0, 'LIVE', 1], [4_000, 'ENHANCE', 2], [7_000, 'ENHANCE', 4], [10_000, 'ENHANCE', 8], [12_500, 'IDENTIFIED', 8]]

/** The live feed's zoom: which villager it follows (the kth), how close, and what it says. */
export function enhanceAt(win, localT) {
  const t = Math.max(0, localT)
  const k = Math.floor(t / ENHANCE_CYCLE_MS)
  const phase = t % ENHANCE_CYCLE_MS
  let step = 0
  while (step + 1 < ENHANCE_STEPS.length && phase >= ENHANCE_STEPS[step + 1][0]) step++
  return { k, step, label: ENHANCE_STEPS[step][1], zoom: ENHANCE_STEPS[step][2] }
}

/** A dossier on a villager: the made-up file a film would put on screen. */
export function dossierOf(seed, pools = DEFAULT_POOLS, name = null) {
  const rand = rngFor(`dossier:${seed}`)
  const p = poolsOf(pools)
  return {
    name: name || pick(rand, p.names),
    codename: pick(rand, T.HANDLES),
    lastSeen: pick(rand, p.repos),
    threat: pick(rand, T.THREATS),
    knownFor: pick(rand, T.KNOWN_FOR),
    file: hex8(rand),
  }
}

/** WOPR playing itself to a draw: the board `localT` ms in, and whether it is over. */
export function tictactoeAt(localT) {
  const moves = Math.min(9, Math.floor(Math.max(0, localT) / 700))
  const board = Array(9).fill(' ')
  T.TICTACTOE.slice(0, moves).forEach((cell, i) => (board[cell] = i % 2 ? 'O' : 'X'))
  return { board, done: moves === 9 }
}

/** The status bar's made-up numbers. */
export function statusAt(t) {
  const s = Math.floor(Math.max(0, t) / 1000)
  return { uplink: (2 + (hashString(`up:${Math.floor(s / 2)}`) % 60) / 10).toFixed(1), trace: 60 + (hashString(`tr:${Math.floor(s / 5)}`) % 40) }
}
