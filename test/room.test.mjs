import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PIN_MAX, ROOM_H, ROOM_W, SHELF_MAX, isDoor, roomFrame } from '../src/sim/room.js'
import { roomLayout, roomPick } from '../src/render/room.js'
import { generate } from '../src/render/sprites/registry.js'
import { INTERIOR_SIZE, INTERIOR_VARIANTS } from '../src/render/sprites/interiors.js'
import { PLAIN_STYLE } from '../src/sim/style.js'

const thread = (status = 'idle') => ({ id: 'claude-code:1', status })
const files = (n) => Array.from({ length: n }, (_, i) => ({ path: `src/f${i}.js`, edits: (i % 5) + 1, kind: 'edited', at: i, outside: false }))
const commits = (n) => Array.from({ length: n }, (_, i) => ({ at: i, message: `commit ${i}` }))

const propOf = (room, kind) => room.props.find((p) => p.kind === kind)

test('a room is furnished from the work: a spine per file, a note per commit', () => {
  const room = roomFrame(thread(), { style: PLAIN_STYLE, files: files(4), commits: commits(3) })
  assert.equal(propOf(room, 'shelf').books.length, 4)
  assert.equal(propOf(room, 'pinboard').notes.length, 3)
  assert.equal(room.counts.files, 4)
  // A file worked over more has a fatter spine, and the same file is always the same book.
  const again = roomFrame(thread(), { style: PLAIN_STYLE, files: files(4), commits: [] })
  assert.deepEqual(propOf(room, 'shelf').books.map((b) => b.color), propOf(again, 'shelf').books.map((b) => b.color))
  assert.ok(propOf(room, 'shelf').books[3].tall >= propOf(room, 'shelf').books[0].tall)
})

test('a session that changed more than the shelves hold fills them and says so', () => {
  const room = roomFrame(thread(), { style: PLAIN_STYLE, files: files(SHELF_MAX + 9), commits: commits(PIN_MAX + 4) })
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
  const room = roomFrame(thread(), { style: PLAIN_STYLE, files: files(3), commits: commits(2) })
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

test('the log in order puts each commit after the edits it committed', async () => {
  const { timeline } = await import('../src/ui/room.js')
  const rows = timeline({
    entries: [{ at: 10, path: 'a.js', kind: 'edited' }, { at: 30, path: 'b.js', kind: 'created' }],
    commits: [{ at: 30, message: 'both' }, { at: 20, message: 'first' }],
  })
  assert.deepEqual(rows.map((r) => `${r.row}:${r.path || r.message}`), ['entry:a.js', 'commit:first', 'entry:b.js', 'commit:both'])
})
