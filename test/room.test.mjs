import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BOARD_ROWS, PIN_MAX, ROOM_H, ROOM_W, SHELF_MAX, isDoor, logRows, roomFrame, since, timeline } from '../src/sim/room.js'
import { roomLayout, roomPick } from '../src/render/room.js'
import { generate } from '../src/render/sprites/registry.js'
import { INTERIOR_SIZE, INTERIOR_VARIANTS } from '../src/render/sprites/interiors.js'
import { PLAIN_STYLE } from '../src/sim/style.js'

const thread = (status = 'idle') => ({ id: 'claude-code:1', status })
const files = (n) => Array.from({ length: n }, (_, i) => ({ path: `src/f${i}.js`, edits: (i % 5) + 1, kind: 'edited', at: i, outside: false }))
const commits = (n) => Array.from({ length: n }, (_, i) => ({ at: i, message: `commit ${i}` }))
/** What the harness hands back, as roomFrame and the board take it. */
const log = (nf, nc = 0, entries = []) => ({ ok: true, files: files(nf), commits: commits(nc), entries, more: 0 })

const propOf = (room, kind) => room.props.find((p) => p.kind === kind)

test('a room is furnished from the work: a spine per file, a note per commit', () => {
  const room = roomFrame(thread(), { style: PLAIN_STYLE, log: log(4, 3) })
  assert.equal(propOf(room, 'shelf').books.length, 4)
  assert.equal(propOf(room, 'pinboard').notes.length, 3)
  assert.equal(room.counts.files, 4)
  // A file worked over more has a fatter spine, and the same file is always the same book.
  const again = roomFrame(thread(), { style: PLAIN_STYLE, log: log(4) })
  assert.deepEqual(propOf(room, 'shelf').books.map((b) => b.color), propOf(again, 'shelf').books.map((b) => b.color))
  assert.ok(propOf(room, 'shelf').books[3].tall >= propOf(room, 'shelf').books[0].tall)
})

test('a session that changed more than the shelves hold fills them and says so', () => {
  const room = roomFrame(thread(), { style: PLAIN_STYLE, log: log(SHELF_MAX + 9, PIN_MAX + 4) })
  assert.equal(propOf(room, 'shelf').books.length, SHELF_MAX)
  assert.equal(propOf(room, 'pinboard').notes.length, PIN_MAX)
  assert.equal(room.counts.files, SHELF_MAX + 9)
  assert.equal(room.counts.shelved, SHELF_MAX)
  // The newest commits are the ones still pinned up.
  assert.equal(propOf(room, 'pinboard').notes.at(-1).message, `commit ${PIN_MAX + 3}`)
})

test('the room says the same thing about its villager as the street does', () => {
  assert.equal(roomFrame(thread('working'), { style: PLAIN_STYLE }).villager.anim, 'sit')
  assert.equal(roomFrame(thread('working'), { style: PLAIN_STYLE }).props.find((p) => p.kind === 'desk').on, true)
  assert.equal(roomFrame(thread('waiting'), { style: PLAIN_STYLE }).villager.anim, 'idle')
  const asleep = roomFrame(thread('sleeping'), { style: PLAIN_STYLE })
  assert.equal(asleep.villager.inBed, true)
  assert.equal(propOf(asleep, 'bed').slept, true)
  assert.equal(asleep.lamp, false, 'nobody leaves the lamp on in daylight while asleep')
  assert.equal(roomFrame(thread('idle'), { style: PLAIN_STYLE, night: 1 }).lamp, true)
})

test('everything in the room stands inside it, and the door is in the wall', () => {
  const room = roomFrame(thread(), { style: PLAIN_STYLE, log: log(3, 2) })
  assert.equal(room.w, ROOM_W)
  assert.equal(room.h, ROOM_H)
  for (const p of room.props) {
    assert.ok(p.x >= 0 && p.x < room.w, `${p.kind} is off the side of the room`)
    assert.ok(p.y >= -room.wallH && p.y < room.h, `${p.kind} is through the wall`)
  }
  const v = room.villager
  assert.ok(v.x >= 0 && v.x < room.w && v.y >= 0 && v.y < room.h)
  assert.ok(isDoor(room, room.door.x, room.door.y))
  assert.ok(!isDoor(room, room.door.x + 1, room.door.y))
  // Props are handed over back to front, so a renderer can draw them in order.
  assert.deepEqual(room.props.map((p) => p.y), [...room.props.map((p) => p.y)].sort((a, b) => a - b))
})

test('a room is drawn whole, centred in what the panels leave free', () => {
  const room = roomFrame(thread(), { style: PLAIN_STYLE })
  const view = { width: 1600, height: 900, insetLeft: 400, insetRight: 300 }
  const l = roomLayout(room, view)
  assert.ok(l.scale >= 2 && Number.isInteger(l.scale), 'a whole number of pixels per pixel')
  assert.ok(l.ox >= view.insetLeft, 'never under the left-hand panel')
  assert.ok(l.ox + l.wPx * l.scale <= view.width - view.insetRight, 'never under the sidebar')
  assert.ok(l.oy >= 0 && l.oy + l.hPx * l.scale <= view.height)
  // A window too small for the room still draws it, rather than nothing.
  assert.ok(roomLayout(room, { width: 200, height: 120 }).scale >= 2)
})

test('a click lands on the tile it looks like it lands on', () => {
  const room = roomFrame(thread(), { style: PLAIN_STYLE })
  const l = roomLayout(room, { width: 1200, height: 800 })
  const s = 16 * l.scale
  const centre = (x, y) => roomPick(room, l, l.ox + (x + 0.5) * s, l.oy + (y + room.wallH + 0.5) * s)
  assert.deepEqual(centre(2, 3), { x: 2, y: 3 })
  assert.deepEqual(centre(room.door.x, room.door.y), { x: room.door.x, y: room.door.y }, 'wall tiles are pickable too')
  assert.equal(roomPick(room, l, l.ox - 10, l.oy + s), null)
  assert.equal(roomPick(room, l, l.ox + (room.w + 1) * s, l.oy + s), null)
})

test('every piece of a room draws, at the size the renderer places it at', () => {
  for (const [kind, n] of Object.entries(INTERIOR_VARIANTS)) {
    const [w, h] = INTERIOR_SIZE[kind]
    for (let v = 0; v < n; v++) {
      const pc = generate(`interior.${kind}.${v}`, 0, {})
      assert.equal(pc.w, w, `interior.${kind}.${v} is the wrong width`)
      assert.equal(pc.h, h, `interior.${kind}.${v} is the wrong height`)
      let opaque = 0
      for (let i = 3; i < pc.data.length; i += 4) if (pc.data[i]) opaque++
      assert.ok(opaque > 0, `interior.${kind}.${v} is empty`)
      // Floors and walls tile, so they must have no holes in them at all.
      if (kind === 'floor' || kind === 'wall') assert.equal(opaque, w * h, `interior.${kind}.${v} has holes`)
    }
  }
})

test('a plot of every wall material has a room of its own', () => {
  const seen = new Set()
  for (let wall = 0; wall < INTERIOR_VARIANTS.floor; wall++) {
    const pc = generate(`interior.floor.${wall}`, 0, {})
    const key = pc.data.join(',')
    assert.ok(!seen.has(key), `wall material ${wall} lays the same floor as another`)
    seen.add(key)
  }
})

test('the log in order puts each commit after the edits it committed', () => {
  const rows = timeline({
    entries: [{ at: 10, path: 'a.js', kind: 'edited' }, { at: 30, path: 'b.js', kind: 'created' }],
    commits: [{ at: 30, message: 'both' }, { at: 20, message: 'first' }],
  })
  assert.deepEqual(rows.map((r) => `${r.row}:${r.path || r.message}`), ['entry:a.js', 'commit:first', 'entry:b.js', 'commit:both'])
})

test('the board says what the session did, in whichever order you ask for', () => {
  const entries = [
    { at: 10, path: 'src/f0.js', kind: 'created', tool: 'Write', excerpt: 'a → b', outside: false },
    { at: 20, path: 'src/f1.js', kind: 'edited', tool: 'Edit', excerpt: 'c → d', outside: false },
  ]
  const l = { ok: true, files: files(2), commits: [{ at: 30, message: 'Do it' }], entries, more: 0 }
  const byFile = logRows(l, { view: 'files', now: 0 })
  assert.deepEqual(byFile.lines.map((x) => x.type), ['file', 'file'])
  // Most recently touched first, and a file is clickable in a way that unfolds it.
  assert.equal(byFile.lines[0].path, 'src/f1.js')
  assert.equal(byFile.lines[0].act, 'fold')

  const order = logRows(l, { view: 'order', now: 0 })
  assert.deepEqual(order.lines.map((x) => x.type), ['entry', 'entry', 'commit'])
  assert.equal(order.lines[2].text, 'Do it')
})

test('unfolding a file shows its own edits and a way to open it', () => {
  const entries = Array.from({ length: 12 }, (_, i) => ({ at: i, path: 'src/f0.js', kind: 'edited', tool: 'Edit', excerpt: `e${i}`, outside: false }))
  const l = { ok: true, files: files(2), commits: [], entries, more: 0 }
  const rows = logRows(l, { view: 'files', open: 'src/f0.js', now: 0 })
  const types = rows.lines.map((x) => x.type)
  assert.ok(types.includes('edit'))
  assert.equal(types.at(-1), 'open')
  // Only the last few edits: the tail is the end you came to read.
  assert.equal(types.filter((t) => t === 'edit').length, 8)
  assert.equal(rows.lines.find((x) => x.type === 'file' && x.path === 'src/f0.js').open, true)
})

test('a file outside the repo is shown but never offered to open', () => {
  const l = { ok: true, more: 0, commits: [], entries: [], files: [{ path: '/etc/hosts', edits: 1, kind: 'edited', at: 1, outside: true }] }
  const open = logRows(l, { view: 'files', open: '/etc/hosts', now: 0 }).lines.find((x) => x.type === 'open')
  assert.equal(open.act, '')
  assert.match(open.text, /outside/)
})

test('the board holds a page at a time and can’t be scrolled off its end', () => {
  const l = { ok: true, files: files(40), commits: [], entries: [], more: 3 }
  const top = logRows(l, { view: 'files', now: 0 })
  assert.equal(top.lines.length, BOARD_ROWS)
  assert.equal(top.total, 41, 'the "more not shown" line counts as one')
  assert.equal(top.scroll, 0)
  const end = logRows(l, { view: 'files', scroll: 9999, now: 0 })
  assert.equal(end.scroll, 41 - BOARD_ROWS)
  assert.equal(end.lines.at(-1).type, 'note')
  assert.equal(logRows(l, { view: 'files', scroll: -5, now: 0 }).scroll, 0)
})

test('a log that hasn’t arrived, or didn’t, says so on the board', () => {
  assert.match(logRows(null, {}).lines[0].text, /Reading/)
  assert.match(logRows({ ok: false, error: 'No transcript.' }, {}).lines[0].text, /No transcript/)
  assert.match(logRows({ ok: true, files: [], entries: [], commits: [] }, {}).lines[0].text, /hasn’t changed a file/)
})

test('the board puts a time in the fewest words that fit', () => {
  const now = Date.parse('2026-09-19T12:00:00Z')
  assert.equal(since(now - 10_000, now), 'now')
  assert.equal(since(now - 20 * 60_000, now), '20m')
  assert.equal(since(now - 5 * 3_600_000, now), '5h')
  assert.equal(since(now - 4 * 86_400_000, now), '4d')
  assert.equal(since(0, now), '')
})

test('the room carries the board, and the board carries the session’s own facts', () => {
  const t = { id: 'claude-code:1', status: 'working', title: 'Write the migration', project: 'orchard', gitBranch: 'main', model: 'claude-opus-5', lastActivityAt: 1000 }
  const room = roomFrame(t, { style: PLAIN_STYLE, log: log(3, 1), board: { view: 'order' }, now: 61_000 })
  assert.equal(room.board.heading, 'Write the migration')
  assert.equal(room.board.sub, 'orchard · main · claude-opus-5 · 1m')
  assert.deepEqual(room.board.tabs.map((x) => x.on), [false, true])
  // The board hangs on the wall, inside the room's own width.
  assert.ok(room.board.y >= -room.wallH && room.board.y + room.board.h <= 0)
  assert.ok(room.board.x >= 0 && room.board.x + room.board.w <= room.w)
})
