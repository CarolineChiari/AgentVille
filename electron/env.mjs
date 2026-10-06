// Pure: what the desktop wrapper decides, from where it listens to what its dock badge says.
// Imports nothing from Electron, so it runs under `node --test`.
import path from 'node:path'
import { APP_BG, BADGE, hexToRgb } from '../src/render/sprites/palette.js'

/**
 * The port the app tries first. Not 5274: that is `npm run dev`'s, and the two should be able to
 * run side by side. It is fixed rather than 0 because Settings live in localStorage, which is
 * keyed by origin, so a new port on every launch would forget them.
 */
export const APP_PORT = 5275

/**
 * PATH with the directories command-line tools are usually installed in appended. A Mac app
 * started from Finder or the Dock inherits launchd's PATH (`/usr/bin:/bin:/usr/sbin:/sbin`), not
 * the shell's, so `gh` from Homebrew would never be found and the PR gardens would stay empty.
 * Appended, not prepended, so whatever the environment already chose still wins. Windows apps
 * get the full user PATH from Explorer, so there it is left alone.
 * @param {{ PATH?: string }} env
 * @param {{ home: string, platform: string }} opts
 */
export function augmentedPath(env, { home, platform }) {
  const current = String(env.PATH || '')
  if (platform === 'win32') return current
  const have = current.split(':').filter(Boolean)
  const extra = ['/opt/homebrew/bin', '/usr/local/bin', path.posix.join(home, '.local', 'bin'), '/usr/bin', '/bin', '/usr/sbin', '/sbin']
  return [...have, ...extra.filter((d) => !have.includes(d))].join(':')
}

/**
 * Whether a navigation may happen inside the window. Only the app's own origin; anything else
 * (a stray link, a redirect) would otherwise load a remote page next to a server that can read
 * transcripts and open things.
 * @param {string} target
 * @param {string} appUrl
 */
export function isAppUrl(target, appUrl) {
  if (typeof target !== 'string' || typeof appUrl !== 'string') return false
  try {
    return new URL(target).origin === new URL(appUrl).origin
  } catch {
    return false
  }
}

/**
 * How many villagers need you, read back out of the page's title, `(3) AgentVille`. The title is
 * the channel because the page has no preload and no IPC to say it any other way. It is the
 * page's to set, so anything that isn't that shape is 0, and at most four digits, so a runaway
 * title can't hand the dock an absurd number.
 * @param {unknown} title
 */
export function badgeCount(title) {
  if (typeof title !== 'string') return 0
  const m = /^\((\d{1,4})\) /.exec(title)
  return m ? Number(m[1]) : 0
}

/** Digits in a 3×5 pixel font, one string per row, `#` for ink. */
const DIGITS = [
  '### #.# #.# #.# ###', '.#. ##. .#. .#. ###', '### ..# ### #.. ###', '### ..# ### ..# ###', '#.# #.# ### ..# ..#',
  '### #.. ### ..# ###', '### #.. ### #.# ###', '### ..# ..# .#. .#.', '### #.# ### #.# ###', '### #.# ### ..# ###',
].map((g) => g.split(' '))
const PLUS = ['.#.', '###', '.#.']

/** Windows draws a taskbar overlay icon at 16×16 at 100% scaling; bigger is scaled down and blurs. */
export const BADGE_PX = 16

/**
 * The Windows taskbar's stand-in for a dock badge, which Windows doesn't have: a yellow disc with
 * the count in it, drawn pixel by pixel because the main process has no canvas. Two digits don't
 * fit a 16-pixel disc at a readable size, so ten or more is `9+`. `scale` is for high-DPI
 * representations, pixel-doubled like the village. The pixels are BGRA, the order `nativeImage`
 * reads a raw bitmap in (Skia's native order, the same on Windows and macOS); in RGBA the yellow
 * comes out sky blue. Each is opaque or fully clear, so premultiplied alpha makes no difference.
 * @param {number} n
 * @param {number} [scale]
 * @returns {{ width: number, height: number, data: Buffer } | null} null for no badge
 */
export function badgeBitmap(n, scale = 1) {
  if (!Number.isInteger(n) || n < 1 || !Number.isInteger(scale) || scale < 1) return null
  const size = BADGE_PX * scale
  const data = Buffer.alloc(size * size * 4)
  const put = (x, y, hex) => {
    const { r, g, b } = hexToRgb(hex)
    for (let j = 0; j < scale; j++) {
      for (let i = 0; i < scale; i++) data.set([b, g, r, 255], ((y * scale + j) * size + x * scale + i) * 4)
    }
  }
  const c = BADGE_PX / 2
  const inDisc = (x, y) => Math.hypot(x + 0.5 - c, y + 0.5 - c) <= c
  // A one-pixel dark rim, so the badge keeps an edge on a light taskbar, where yellow all but vanishes.
  const rim = (x, y) => !inDisc(x - 1, y) || !inDisc(x + 1, y) || !inDisc(x, y - 1) || !inDisc(x, y + 1)
  for (let y = 0; y < BADGE_PX; y++) {
    for (let x = 0; x < BADGE_PX; x++) if (inDisc(x, y)) put(x, y, rim(x, y) ? APP_BG : BADGE.waiting)
  }
  const stamp = (rows, x0, y0, k) => rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch !== '#') return
    for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) put(x0 + x * k + i, y0 + y * k + j, APP_BG)
  }))
  // Doubled glyphs, centred: 6×10 pixels. `9+` puts a small plus up by the 9's shoulder.
  if (n < 10) stamp(DIGITS[n], 5, 3, 2)
  else {
    stamp(DIGITS[9], 3, 3, 2)
    stamp(PLUS, 10, 3, 1)
  }
  return { width: size, height: size, data }
}

/** What the window opens at when nothing was saved. */
export const DEFAULT_BOUNDS = { width: 1400, height: 900 }

const finite = (n) => typeof n === 'number' && Number.isFinite(n)

/**
 * Read saved window bounds back from whatever `window.json` held. It is a file on disk, so
 * anything that isn't four finite numbers (and a positive size) is no bounds at all.
 * @param {unknown} raw
 * @returns {{ x: number, y: number, width: number, height: number, maximized: boolean } | null}
 */
export function parseBounds(raw) {
  if (!raw || typeof raw !== 'object') return null
  const { x, y, width, height, maximized } = /** @type {any} */ (raw)
  if (![x, y, width, height].every(finite) || width <= 0 || height <= 0) return null
  return { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height), maximized: maximized === true }
}

/**
 * Bring saved bounds back on screen. `displays` are the work areas that exist now. If the window
 * overlaps one by a usable amount it stays where it was, shrunk to fit if that display got
 * smaller; if it is off every display (an unplugged monitor), it is moved onto the first, the
 * primary, and centred. Without any display there is nothing to clamp to, so size only.
 * @param {{ x: number, y: number, width: number, height: number }} bounds
 * @param {{ x: number, y: number, width: number, height: number }[]} displays primary first
 * @param {{ minWidth?: number, minHeight?: number }} [min]
 */
export function clampBounds(bounds, displays, { minWidth = 720, minHeight = 480 } = {}) {
  const list = displays.filter((d) => [d.x, d.y, d.width, d.height].every(finite) && d.width > 0 && d.height > 0)
  if (!list.length) return { width: bounds.width, height: bounds.height }
  // Enough of the window on a display that its title bar can be grabbed.
  const VISIBLE = 100
  const overlap = (d) => Math.min(bounds.x + bounds.width, d.x + d.width) - Math.max(bounds.x, d.x)
  const overlapY = (d) => Math.min(bounds.y + bounds.height, d.y + d.height) - Math.max(bounds.y, d.y)
  // The display holding most of the window, not the first with enough: a window mostly on the
  // second monitor must not be dragged to the primary because a sliver of it touches that too.
  const home = list
    .filter((d) => overlap(d) >= VISIBLE && overlapY(d) >= VISIBLE)
    .reduce((best, d) => (!best || overlap(d) * overlapY(d) > overlap(best) * overlapY(best) ? d : best), null)
  const d = home || list[0]
  const width = Math.max(Math.min(minWidth, d.width), Math.min(bounds.width, d.width))
  const height = Math.max(Math.min(minHeight, d.height), Math.min(bounds.height, d.height))
  if (!home) return { x: Math.round(d.x + (d.width - width) / 2), y: Math.round(d.y + (d.height - height) / 2), width, height }
  const x = Math.min(Math.max(bounds.x, d.x), d.x + d.width - width)
  const y = Math.min(Math.max(bounds.y, d.y), d.y + d.height - height)
  return { x, y, width, height }
}
