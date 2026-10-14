// Hollywood hacker mode's windows: one renderer per kind. What each shows comes from
// src/sim/hacker.js as a function of the window's seed and how long it has been open; these only
// put it on screen. `mount` builds a window's body once, `update` runs on every text tick, and
// `frame`, where there is one, redraws a canvas every animation frame.
import * as H from '../sim/hacker.js'
import { RAIN_GLYPHS, TICTACTOE_END, TRAIN, UNIX_TREE } from '../sim/hacker-text.js'
import { lookFor } from '../sim/villager.js'
import { rngFor } from '../sim/rng.js'
import { TILE_PX, HACKER, rgba } from '../render/sprites/palette.js'

const div = (cls = '', text = '') => {
  const d = document.createElement('div')
  if (cls) d.className = cls
  if (text) d.textContent = text
  return d
}

/** A column of `n` reusable line elements, newest at the bottom. */
function linesBox(body, n) {
  const box = div('hk-lines')
  const rows = Array.from({ length: n }, () => box.appendChild(div()))
  body.appendChild(box)
  return rows
}

const toneClass = (tone) => (tone ? `hk-tone-${tone}` : '')

/** Put lines into reusable rows: the last `rows.length` of them, bottom-aligned. */
function paint(rows, lines, render) {
  const off = rows.length - lines.length
  rows.forEach((row, k) => {
    const l = lines[k - off]
    if (!l) {
      row.textContent = ''
      row.className = ''
      return
    }
    render(row, l)
  })
}

const plain = (row, l) => {
  row.textContent = l.text
  row.className = toneClass(l.tone)
}

/** A canvas filling its parent at the device's resolution. Returns its 2D context, resized if need be. */
function fit(canvas, scale = globalThis.devicePixelRatio || 1) {
  const w = Math.max(1, Math.round(canvas.clientWidth * scale))
  const h = Math.max(1, Math.round(canvas.clientHeight * scale))
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w
    canvas.height = h
  }
  return canvas.getContext('2d')
}

function canvasIn(body, cls = 'hk-canvas') {
  const c = document.createElement('canvas')
  c.className = cls
  body.appendChild(c)
  return c
}

// ---------- the console: what the person "types" ----------

const consoleWin = {
  mount(body) {
    return { rows: linesBox(body, H.TERM_LINES + 1), version: -1 }
  },
  update(s, win, t, ctx) {
    const c = ctx.console
    if (s.version === c.version) return
    s.version = c.version
    paint(s.rows, [...c.lines, { tone: '', text: c.current, cur: true }], (row, l) => {
      row.textContent = l.text
      row.className = `${toneClass(l.tone)}${l.cur ? ' cur' : ''}`
    })
  },
}

// ---------- streams: terminals and chat ----------

const stream = {
  mount(body) {
    return { rows: linesBox(body, H.TERM_LINES), last: -1 }
  },
  update(s, win, t, ctx) {
    const lines = H.streamAt(win, t, ctx.pools)
    const last = lines.at(-1)?.i ?? -1
    if (last === s.last) return
    s.last = last
    if (win.kind !== 'chat') return paint(s.rows, lines, plain)
    paint(s.rows, lines, (row, l) => {
      row.className = ''
      row.textContent = ''
      const who = document.createElement('span')
      who.className = 'hk-who'
      who.textContent = `<${l.who}> `
      row.append(who, l.text)
    })
  },
}

const code = {
  mount(body, win, ctx) {
    return { rows: linesBox(body, H.CODE_LINES), stream: H.codeStream(win.seed, ctx.pools), key: '' }
  },
  update(s, win, t) {
    const { lines } = H.codeAt(s.stream, win, t)
    const key = `${lines.length}:${lines.at(-1)}`
    if (key === s.key) return
    s.key = key
    paint(s.rows, lines.map((text, k) => ({ text, cur: k === lines.length - 1 })), (row, l) => {
      row.textContent = l.text
      row.className = l.cur ? 'cur' : ''
    })
  },
}

const hex = {
  mount(body) {
    return { rows: linesBox(body, H.HEX_ROWS), first: -1 }
  },
  update(s, win, t, ctx) {
    const rows = H.hexAt(win, t, ctx.pools)
    if (rows[0].offset === s.first) return
    s.first = rows[0].offset
    paint(s.rows, rows, (row, r) => {
      row.textContent = `${r.offset}  ${r.hex.join(' ')}  ${r.ascii}`
      row.className = r.word ? 'word' : ''
    })
  },
}

// ---------- the big set pieces ----------

const cracker = {
  mount(body, win) {
    const r = rngFor(`${win.seed}:host`)
    body.append(div('', `TARGET: ${H.hostOf(r, null)}`), div('', 'MODE: DICTIONARY + BRUTE FORCE'))
    const big = body.appendChild(div('hk-big'))
    const stats = body.appendChild(div('hk-row'))
    const status = body.appendChild(div())
    return { big, stats, status, key: '' }
  },
  update(s, win, t, ctx) {
    let c = H.crackerAt(win, t)
    // An egg (swordfish, Konami) cracks whatever is on screen for a few seconds.
    if (ctx.solvedAt != null && ctx.elapsed - ctx.solvedAt < 6_000) c = { ...c, display: c.target, locked: c.target.length, granted: true, blank: false }
    const key = `${c.display}|${c.granted}|${c.blank}`
    if (key === s.key) return
    s.key = key
    s.big.textContent = c.blank ? '' : c.display
    s.stats.textContent = `ATTEMPTS ${c.attempts.toLocaleString('en-US')}    ${c.locked}/${c.target.length} LOCKED`
    s.status.textContent = c.granted ? 'ACCESS GRANTED' : c.blank ? 'NEXT TARGET…' : 'CRACKING…'
    s.status.className = c.granted ? 'hk-granted' : ''
  },
}

const progress = {
  mount() {
    return { slots: [], body: null }
  },
  update(s, win, t, ctx, body) {
    const bars = H.progressAt(win, t, ctx.pools)
    while (s.slots.length < bars.length) {
      const row = body.appendChild(div('hk-row'))
      const label = row.appendChild(document.createElement('span'))
      const pct = row.appendChild(document.createElement('span'))
      const bar = body.appendChild(div('hk-bar'))
      const fillEl = bar.appendChild(document.createElement('i'))
      s.slots.push({ label, pct, bar, fill: fillEl })
    }
    bars.forEach((b, j) => {
      const slot = s.slots[j]
      slot.label.textContent = b.label
      slot.pct.textContent = `${b.pct}%  ETA ${b.eta}`
      slot.fill.style.width = `${b.pct}%`
      slot.bar.classList.toggle('stuck', b.stuck)
    })
  },
}

const tracer = {
  mount(body) {
    const head = body.appendChild(div())
    const rows = linesBox(body, 13)
    const bar = body.appendChild(div('hk-bar'))
    return { head, rows, fill: bar.appendChild(document.createElement('i')), key: '' }
  },
  update(s, win, t) {
    const tr = H.tracerAt(win, t)
    const key = `${tr.k}:${tr.hops.length}:${tr.done}`
    if (key === s.key) return
    s.key = key
    s.head.textContent = `TRACING ${tr.handle} @ ${tr.target}`
    const lines = tr.hops.map((h) => ({ tone: '', text: `${String(h.n).padStart(2)}  ${h.ip.padEnd(16)} ${h.city.padEnd(18)} ${h.ms} ms` }))
    lines.push(tr.done ? { tone: 'ok', text: `TRACE COMPLETE: ${tr.hops.at(-1).city.toUpperCase()}` } : { tone: 'warn', text: `TRACE ${tr.pct}%  keep them talking…` })
    paint(s.rows, lines, plain)
    s.fill.style.width = `${tr.pct}%`
  },
}

const cipher = {
  mount(body, win) {
    const head = body.appendChild(div())
    const big = body.appendChild(div('hk-big'))
    const foot = body.appendChild(div('hk-row'))
    return { head, big, foot, key: '', win }
  },
  update(s, win, t) {
    const c = H.cipherAt(win, t)
    if (c.display === s.key) return
    s.key = c.display
    s.head.textContent = `INTERCEPT #${1000 + c.k}  ·  ${c.done ? 'DECRYPTED' : 'DECRYPTING'}`
    s.big.textContent = c.display
    s.foot.textContent = `${c.revealed}/${c.text.length} BYTES  ·  KEY ${(c.k * 2654435761 >>> 0).toString(16).toUpperCase()}`
  },
}

const dossier = {
  mount(body, win, ctx) {
    const d = H.dossierOf(win.seed, ctx.pools, win.name)
    const c = document.createElement('canvas')
    c.width = 16
    c.height = 24
    try {
      c.getContext('2d').drawImage(ctx.sprites.get('villager.idle.s', 0, { look: lookFor(d.name) }), 0, 0)
    } catch {
      // No sprites yet: an empty photo frame is still a dossier.
    }
    const info = div()
    for (const [k, v] of [['SUBJECT', d.name.toUpperCase()], ['ALIAS', d.codename], ['LAST SEEN', d.lastSeen], ['THREAT', d.threat], ['KNOWN FOR', d.knownFor], ['FILE', `#${d.file}`]]) {
      const row = info.appendChild(div())
      row.textContent = `${k}: ${v}`
    }
    info.appendChild(div('stamp', 'WANTED'))
    body.append(c, info)
    return {}
  },
  update() {},
}

// ---------- canvases ----------

const D2R = Math.PI / 180

/** Orthographic projection onto a globe turned by `rot` and tipped towards us. */
function project(lat, lon, rot) {
  const tilt = 0.35
  const p = lat * D2R
  const l = lon * D2R + rot
  const x = Math.cos(p) * Math.sin(l)
  const y = Math.cos(tilt) * Math.sin(p) - Math.sin(tilt) * Math.cos(p) * Math.cos(l)
  const z = Math.sin(tilt) * Math.sin(p) + Math.cos(tilt) * Math.cos(p) * Math.cos(l)
  return { x, y, z }
}

const globe = {
  mount(body) {
    return { canvas: canvasIn(body) }
  },
  update() {},
  frame(s, win, t, ctx) {
    const g = fit(s.canvas)
    const { width: W, height: Hh } = s.canvas
    const fg = ctx.fg
    const R = Math.min(W, Hh) * 0.42
    const cx = W / 2
    const cy = Hh / 2
    const data = H.globeAt(win, t)
    g.clearRect(0, 0, W, Hh)
    g.lineWidth = Math.max(1, W / 400)
    g.strokeStyle = rgba(fg, 0.9)
    g.beginPath()
    g.arc(cx, cy, R, 0, Math.PI * 2)
    g.stroke()
    g.strokeStyle = rgba(fg, 0.3)
    const line = (pts) => {
      let pen = false
      g.beginPath()
      for (const [la, lo] of pts) {
        const q = project(la, lo, data.rot)
        if (q.z < 0) {
          pen = false
          continue
        }
        const X = cx + q.x * R
        const Y = cy - q.y * R
        if (pen) g.lineTo(X, Y)
        else g.moveTo(X, Y)
        pen = true
      }
      g.stroke()
    }
    for (let lo = -180; lo < 180; lo += 30) line(Array.from({ length: 37 }, (_, k) => [-90 + k * 5, lo]))
    for (let la = -60; la <= 60; la += 30) line(Array.from({ length: 73 }, (_, k) => [la, -180 + k * 5]))
    // Arcs between one ping and the next, lifted off the surface.
    const pts = data.pings.map((p) => ({ ...p, q: project(p.lat, p.lon, data.rot) }))
    g.strokeStyle = rgba(HACKER.white, 0.7)
    for (let k = 1; k < pts.length; k++) {
      const a = pts[k - 1].q
      const b = pts[k].q
      if (a.z < 0 || b.z < 0) continue
      const ax = cx + a.x * R
      const ay = cy - a.y * R
      const bx = cx + b.x * R
      const by = cy - b.y * R
      const mx = (ax + bx) / 2
      const my = (ay + by) / 2
      const lift = Math.hypot(bx - ax, by - ay) * 0.35
      g.beginPath()
      g.moveTo(ax, ay)
      g.quadraticCurveTo(mx + ((mx - cx) / R) * lift, my + ((my - cy) / R) * lift, bx, by)
      g.stroke()
    }
    g.font = `${Math.round(10 * (globalThis.devicePixelRatio || 1))}px ui-monospace, Menlo, monospace`
    for (const p of pts) {
      if (p.q.z < 0) continue
      const X = cx + p.q.x * R
      const Y = cy - p.q.y * R
      const k = p.age / p.life
      g.strokeStyle = rgba(HACKER.red, 1 - k)
      g.beginPath()
      g.arc(X, Y, 3 + k * R * 0.25, 0, Math.PI * 2)
      g.stroke()
      g.fillStyle = HACKER.red
      g.fillRect(X - 2, Y - 2, 4, 4)
      g.fillStyle = rgba(HACKER.white, 1 - k * 0.6)
      g.fillText(p.city.toUpperCase(), X + 6, Y - 4)
    }
  },
}

const sysmon = {
  mount(body) {
    const canvas = canvasIn(body, '')
    const rows = [div('hk-row'), div('hk-row'), div('hk-row')]
    body.append(...rows)
    return { canvas, rows }
  },
  update(s, win, t) {
    const m = H.sysmonAt(win, t)
    const cpu = Math.round(m.cpu.at(-1) * 100)
    s.rows[0].textContent = `CPU ${cpu}%    NET ${(m.net.at(-1) * 9.9).toFixed(1)} MB/s`
    s.rows[1].textContent = `RAM ${m.ram}%${m.ram > 100 ? '  (downloaded more)' : ''}`
    s.rows[2].textContent = `TEMP ${m.temp}°C${m.temp > 90 ? '  SPICY' : ''}`
    s.m = m
  },
  frame(s, win, t, ctx) {
    if (!s.m) return
    const g = fit(s.canvas)
    const { width: W, height: Hh } = s.canvas
    g.clearRect(0, 0, W, Hh)
    const plot = (series, color, top, h) => {
      g.strokeStyle = color
      g.lineWidth = Math.max(1, W / 300)
      g.beginPath()
      series.forEach((v, k) => {
        const X = (k / (series.length - 1)) * W
        const Y = top + h - v * h
        if (k) g.lineTo(X, Y)
        else g.moveTo(X, Y)
      })
      g.stroke()
    }
    g.strokeStyle = rgba(ctx.fg, 0.2)
    for (let k = 1; k < 4; k++) {
      g.beginPath()
      g.moveTo(0, (Hh * k) / 4)
      g.lineTo(W, (Hh * k) / 4)
      g.stroke()
    }
    plot(s.m.cpu, ctx.fg, 2, Hh / 2 - 4)
    plot(s.m.net, HACKER.cyan, Hh / 2 + 2, Hh / 2 - 4)
  },
}

/**
 * The live feed: the village's own villagers, walking about right now, as a tracking camera sees
 * them. Drawn from their sprites rather than copied off the map, so no plot's name (a real repo's)
 * can turn up in the picture.
 */
const feed = {
  mount(body) {
    const canvas = canvasIn(body)
    const label = body.appendChild(div())
    label.style.cssText = 'position:absolute;left:8px;top:6px;font-weight:700;letter-spacing:.1em'
    return { canvas, label, zoom: 1, key: '' }
  },
  update(s, win, t) {
    const e = H.enhanceAt(win, t)
    s.e = e
  },
  frame(s, win, t, ctx, dt) {
    const e = s.e || H.enhanceAt(win, t)
    const g = fit(s.canvas, 1)
    g.imageSmoothingEnabled = false
    const { width: W, height: Hh } = s.canvas
    // Ease towards the zoom ENHANCE asked for, so it pushes in rather than cuts.
    s.zoom += (e.zoom - s.zoom) * Math.min(1, (dt || 0.016) * (ctx.reduced ? 60 : 3))
    g.fillStyle = HACKER.ink
    g.fillRect(0, 0, W, Hh)
    const all = [...(ctx.world?.villagers?.values?.() || [])].filter((v) => v.alpha > 0.5 && v.loco !== 'gone')
    if (!all.length) {
      const r = rngFor(`${win.seed}:${Math.floor(t / 80)}`)
      for (let k = 0; k < 600; k++) {
        g.fillStyle = rgba(HACKER.white, r() * 0.5)
        g.fillRect(r() * W, r() * Hh, 2, 2)
      }
      s.label.textContent = 'NO SIGNAL'
      return
    }
    const target = all[e.k % all.length]
    const viewTiles = 26 / s.zoom
    const scale = W / (viewTiles * TILE_PX)
    const ox = W / 2 - target.x * TILE_PX * scale
    const oy = Hh / 2 - (target.y - 0.7) * TILE_PX * scale
    // A tile grid on the ground, for something to track against.
    g.strokeStyle = rgba(ctx.fg, 0.18)
    g.lineWidth = 1
    const step = TILE_PX * scale
    for (let X = ox % step; X < W; X += step) {
      g.beginPath()
      g.moveTo(X, 0)
      g.lineTo(X, Hh)
      g.stroke()
    }
    for (let Y = oy % step; Y < Hh; Y += step) {
      g.beginPath()
      g.moveTo(0, Y)
      g.lineTo(W, Y)
      g.stroke()
    }
    for (const v of all) {
      let img
      try {
        img = ctx.sprites.get(`villager.idle.${v.facing || 's'}`, 0, { look: v.look })
      } catch {
        continue
      }
      const X = ox + (v.x * TILE_PX - img.width / 2) * scale
      const Y = oy + (v.y * TILE_PX - img.height) * scale
      if (X < -img.width * scale || Y < -img.height * scale || X > W || Y > Hh) continue
      g.drawImage(img, X, Y, img.width * scale, img.height * scale)
    }
    // Everything the one colour of the screen, as a night-vision camera would have it.
    g.globalCompositeOperation = 'color'
    g.fillStyle = ctx.fg
    g.fillRect(0, 0, W, Hh)
    g.globalCompositeOperation = 'source-over'
    // The box round whoever is being followed.
    const bw = 18 * scale
    const bh = 28 * scale
    g.strokeStyle = e.label === 'IDENTIFIED' ? HACKER.red : HACKER.white
    g.lineWidth = 2
    g.strokeRect(W / 2 - bw / 2, Hh / 2 - bh / 2 - 0.2 * step, bw, bh)
    g.fillStyle = rgba(HACKER.ink, 0.35)
    for (let Y = 0; Y < Hh; Y += 3) g.fillRect(0, Y, W, 1)
    const r = rngFor(`${win.seed}:${Math.floor(t / 80)}`)
    for (let k = 0; k < 80; k++) {
      g.fillStyle = rgba(HACKER.white, r() * 0.3)
      g.fillRect(r() * W, r() * Hh, 1, 1)
    }
    const name = String(target.name || 'UNKNOWN').toUpperCase()
    const text = e.label === 'IDENTIFIED' ? `IDENTIFIED: ${name}` : e.label === 'LIVE' ? `● REC  CAM ${1 + (e.k % 9)}` : `ENHANCE ×${e.zoom}`
    if (text !== s.key) {
      s.key = text
      s.label.textContent = text
    }
  },
}

// ---------- the eggs' own windows ----------

const ttt = {
  mount(body) {
    const grid = body.appendChild(div('grid'))
    const cells = Array.from({ length: 9 }, () => grid.appendChild(document.createElement('span')))
    const end = body.appendChild(div('end'))
    return { cells, end }
  },
  update(s, win, t) {
    const { board, done } = H.tictactoeAt(t)
    board.forEach((c, k) => (s.cells[k].textContent = c))
    s.end.textContent = done ? TICTACTOE_END : ''
  },
}

const unix = {
  mount(body) {
    return { rows: linesBox(body, UNIX_TREE.length) }
  },
  update(s, win, t) {
    const n = Math.min(UNIX_TREE.length, 1 + Math.floor(t / 250))
    paint(s.rows, UNIX_TREE.slice(0, n).map((text) => ({ text, tone: '' })), plain)
  },
}

const train = {
  mount(body) {
    const pre = document.createElement('pre')
    pre.textContent = TRAIN.join('\n')
    body.appendChild(pre)
    return {}
  },
  update() {},
}

const popup = {
  mount(body, win) {
    body.textContent = win.text || ''
    return {}
  },
  update() {},
}

export const RENDERERS = {
  console: consoleWin, terminal: stream, chat: stream, code, hex, cracker, progress, tracer, cipher,
  dossier, globe, sysmon, feed, ttt, unix, train, popup,
}

// ---------- matrix rain, behind the windows ----------

// Glyphs this tall, in CSS pixels; the rain is drawn at CSS resolution, not the screen's, because
// nobody can tell and it is four times less to draw on a Retina display.
const RAIN_PX = 16

/** The background rain. `draw(dt, fg)` advances it by `dt` seconds. */
export function createRain(canvas, seed) {
  const rand = rngFor(`rain:${seed}`)
  const glyphs = [...RAIN_GLYPHS]
  let cols = []
  return {
    draw(dt, fg, boost) {
      const g = fit(canvas, 1)
      const { width: W, height: Hh } = canvas
      const n = Math.ceil(W / RAIN_PX)
      while (cols.length < n) cols.push({ y: -rand() * (Hh / RAIN_PX), speed: 6 + rand() * 18, row: -1 })
      cols = cols.slice(0, n)
      // Fade what was drawn before, at the same rate whatever the frame rate.
      g.fillStyle = rgba(HACKER.ink, 1 - Math.pow(0.93, dt * 60))
      g.fillRect(0, 0, W, Hh)
      g.font = `${RAIN_PX - 2}px ui-monospace, Menlo, monospace`
      cols.forEach((c, k) => {
        c.y += c.speed * dt * (boost ? 1.8 : 1)
        const row = Math.floor(c.y)
        if (row !== c.row && row >= 0) {
          if (c.row >= 0) {
            g.fillStyle = fg
            g.fillText(glyphs[Math.floor(rand() * glyphs.length)], k * RAIN_PX, c.row * RAIN_PX + RAIN_PX)
          }
          g.fillStyle = HACKER.white
          g.fillText(glyphs[Math.floor(rand() * glyphs.length)], k * RAIN_PX, row * RAIN_PX + RAIN_PX)
          c.row = row
        }
        if (c.y * RAIN_PX > Hh && rand() < 0.03) {
          c.y = -rand() * 10
          c.row = -1
        }
      })
    },
  }
}
