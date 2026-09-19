import { test } from 'node:test'
import assert from 'node:assert/strict'
import { World } from '../src/sim/world.js'
import { TILE } from '../src/sim/plot.js'
import { plotStyle } from '../src/sim/style.js'

const T = (id, project, status = 'idle', extra = {}) => ({ id, project, createdAt: Number(id.replace(/\D/g, '')) || 0, status, known: true, ...extra })

function run(world, seconds, dt = 1 / 30) {
  for (let t = 0; t < seconds; t += dt) world.tick(dt)
}

/** Distance from a villager to the nearest place its building lets it stand. */
const fromStand = (v, b) => Math.min(...b.standSpots().map((p) => Math.hypot(v.x - p.x, v.y - p.y)))

test('the first roster trickles everybody out of the gate, then they reach their plots', () => {
  const w = new World()
  w.setRoster([T('t1', 'a', 'waiting'), T('t2', 'a'), T('t3', 'b', 'working')])
  assert.equal(w.snapshot().villagers.length, 0, 'everyone starts queued')
  run(w, 25)
  const snap = w.snapshot()
  assert.equal(snap.villagers.length, 3)
  for (const v of snap.villagers) assert.notEqual(w.villager(v.id).loco, 'entering', `${v.id} never arrived`)
  const waiting = w.villager('t1')
  assert.ok(fromStand(waiting, w.buildings.get('t1')) < 0.7, 'waiting villager stands by its door')
})

test('a known newcomer appears in place; an unknown one walks in from the gate', () => {
  const w = new World()
  w.setRoster([T('t1', 'a')])
  run(w, 10)
  w.setRoster([T('t1', 'a'), T('t2', 'a', 'idle', { known: true }), T('t3', 'a', 'idle', { known: false })])
  assert.equal(w.villager('t2').loco, 'site')
  assert.equal(w.villager('t3').loco, 'entering')
  assert.ok(Math.hypot(w.villager('t3').x - w.gate.x, w.villager('t3').y - w.gate.y) < 0.01)
  assert.equal(w.buildings.get('t3').progress, 0, 'a brand-new thread starts from its foundations')
})

test('an archived villager walks back to the gate and is gone; its building fades out', () => {
  const w = new World()
  w.setRoster([T('t1', 'a'), T('t2', 'a')])
  run(w, 12)
  w.setRoster([T('t1', 'a')])
  assert.equal(w.villager('t2').loco, 'leaving')
  run(w, 25)
  assert.equal(w.villager('t2'), null)
  assert.equal(w.buildings.has('t2'), false)
})

test('slots are stable: archiving one thread does not move its siblings', () => {
  const w = new World()
  w.setRoster([T('t1', 'a'), T('t2', 'a'), T('t3', 'a')])
  const before = { x: w.buildings.get('t3').x, y: w.buildings.get('t3').y }
  w.setRoster([T('t1', 'a'), T('t3', 'a')])
  assert.deepEqual({ x: w.buildings.get('t3').x, y: w.buildings.get('t3').y }, before)
})

test('locomotion wins over status: a working villager on the move walks', () => {
  const w = new World()
  w.setRoster([T('t1', 'a', 'working')])
  run(w, 1.5)
  const v = w.villager('t1')
  if (v.moving) assert.equal(v.anim, 'walk')
  run(w, 20)
  assert.ok(['hammer', 'walk'].includes(w.villager('t1').anim))
})

test('a status change at site re-targets', () => {
  const w = new World()
  w.setRoster([T('t1', 'a', 'working')])
  run(w, 15)
  w.setRoster([T('t1', 'a', 'waiting')])
  run(w, 6)
  const v = w.villager('t1')
  assert.ok(fromStand(v, w.buildings.get('t1')) < 0.7)
  assert.ok(['idle', 'wave', 'jump'].includes(v.anim))
  assert.equal(v.badge, 'waiting')
})

test('nobody ever stands inside a wall over a long busy run', () => {
  const w = new World()
  const threads = []
  for (let i = 0; i < 40; i++) threads.push(T(`t${i}`, `p${i % 5}`, ['idle', 'working', 'waiting', 'sleeping'][i % 4]))
  w.setRoster(threads)
  for (let s = 0; s < 60 * 30; s++) {
    w.tick(1 / 30)
    if (s % 15) continue
    for (const v of w.villagers.values()) {
      if (v.loco === 'queued') continue
      assert.ok(!w.nav.isBlocked(Math.floor(v.x), Math.floor(v.y)), `${v.id} inside a wall at ${v.x.toFixed(2)},${v.y.toFixed(2)}`)
    }
  }
})

test('a waiting villager waves and hops every few seconds', () => {
  const w = new World()
  w.setRoster([T('t1', 'a', 'waiting')])
  run(w, 12)
  const seen = new Set()
  for (let i = 0; i < 8 * 30; i++) {
    w.tick(1 / 30)
    seen.add(w.villager('t1').anim)
  }
  assert.ok(seen.has('wave') && seen.has('jump') && seen.has('idle'), [...seen].join(','))
})

const F = (id, kind = 0) => ({ id, kind, color: 1 })

test('flowers fill the field a row at a time, on ploughed ground', () => {
  const w = new World()
  const flowers = Array.from({ length: 9 }, (_, i) => F(`f${i}`))
  w.setRoster([T('t1', 'a')], undefined, new Map([['a', flowers]]))
  const p = (id) => w.flower(id)
  assert.ok(p('f1').x > p('f0').x && p('f1').y === p('f0').y, 'second flower is right of the first')
  assert.ok(p('f8').x === p('f0').x && p('f8').y > p('f0').y, 'ninth flower starts the next row')
  for (const f of flowers) {
    const tx = Math.floor(p(f.id).x)
    const ty = Math.floor(p(f.id).y - 0.2)
    assert.ok(!w.nav.isBlocked(tx, ty), 'the field is walkable')
    assert.equal(w.map.tileAt(tx, ty), TILE.BED, `${f.id} stands on soil`)
  }
})

test('the field is ploughed deeper as flowers arrive', () => {
  const w = new World()
  const soil = () => w.map.tiles.filter((t) => t === TILE.BED).length
  w.setRoster([T('t1', 'a')], undefined, new Map([['a', []]]))
  const bare = soil()
  assert.ok(bare > 0, 'an empty field still has a strip of soil')
  w.setRoster([T('t1', 'a')], undefined, new Map([['a', Array.from({ length: 30 }, (_, i) => F(`f${i}`))]]))
  assert.ok(soil() > bare, 'more flowers, more soil')
})

test('the first few houses stand round the field, not in a row', () => {
  const w = new World()
  w.setRoster([T('t1', 'a'), T('t2', 'a'), T('t3', 'a')])
  const ys = new Set([...w.buildings.values()].map((b) => b.y))
  const xs = new Set([...w.buildings.values()].map((b) => b.x))
  assert.equal(xs.size, 3, 'three columns')
  assert.equal(ys.size, 2, 'on two sides of the field')
})

test('a repo with only finished threads keeps its plot and garden', () => {
  const w = new World()
  w.setRoster([T('t1', 'a')], undefined, new Map([['b', [F('x')]]]))
  assert.ok(w.plots.has('b'))
  assert.equal(w.flower('x').plot, 'b')
})

test('flowers present at load are in bloom; one finished later grows in', () => {
  const w = new World()
  w.setRoster([T('t1', 'a'), T('t2', 'a')], undefined, new Map([['a', [F('old')]]]))
  assert.equal(w.flower('old').born, null)
  run(w, 2)
  w.setRoster([T('t1', 'a')], undefined, new Map([['a', [F('old'), F('t2')]]]))
  assert.equal(typeof w.flower('t2').born, 'number')
  assert.equal(w.snapshot().flowers.length, 2)
})

test('a done villager stands at its door with a checkmark and does not wave', () => {
  const w = new World()
  w.setRoster([T('t1', 'a', 'done')])
  run(w, 12)
  const seen = new Set()
  for (let i = 0; i < 8 * 30; i++) {
    w.tick(1 / 30)
    seen.add(w.villager('t1').anim)
  }
  const v = w.villager('t1')
  assert.ok(fromStand(v, w.buildings.get('t1')) < 0.7)
  assert.equal(v.badge, 'done')
  assert.deepEqual([...seen], ['idle'])
})

test('neighbouring buildings never offer the same spot to work or stand on', () => {
  const w = new World()
  w.setRoster([T('t1', 'a', 'working'), T('t2', 'a', 'working'), T('t3', 'a', 'working')])
  const seen = new Map()
  for (const [id, b] of w.buildings) {
    for (const p of [...b.workSpots(), ...b.standSpots()]) {
      const k = `${p.x},${p.y}`
      if (seen.has(k) && seen.get(k) !== id) assert.fail(`${id} and ${seen.get(k)} share ${k}`)
      seen.set(k, id)
    }
  }
})

test('idle villagers spread over the whole yard, garden included', () => {
  const w = new World()
  w.setRoster([T('t1', 'a'), T('t2', 'a'), T('t3', 'a')])
  const rows = new Set()
  for (let s = 0; s < 90 * 30; s++) {
    w.tick(1 / 30)
    if (s % 30) continue
    for (const v of w.villagers.values()) if (v.loco === 'site' && !v.moving) rows.add(((Math.floor(v.y) % 12) + 12) % 12)
  }
  assert.ok([...rows].some((r) => r >= 5), `only ever stood on rows ${[...rows].sort().join(',')}`)
})

const notes = (n, repo = 'a') => Array.from({ length: n }, (_, i) => ({ id: `issue:me/${repo}#${i + 1}` }))

test('a plot with open issues gets one notice board; one without gets none', () => {
  const w = new World()
  w.setRoster([T('t1', 'a'), T('t2', 'b')], undefined, new Map(), new Map([['a', notes(3)], ['b', []], ['nowhere', notes(2)]]))
  const snap = w.snapshot({ selected: 'board:a' })
  assert.deepEqual(snap.boards.map((b) => b.id), ['board:a'], 'no board for an empty list, and none for a repo without a plot')
  assert.equal(snap.boards[0].count, 3)
  assert.equal(snap.boards[0].selected, true)
  assert.equal(w.board('board:a').plot, 'a')
  assert.equal(w.board('board:b'), null)
})

test('a board stands on the walkway, blocks its tile, and never moves as the plot grows', () => {
  const w = new World()
  w.setRoster([T('t1', 'a')], undefined, new Map(), new Map([['a', notes(1)]]))
  const b = w.board('board:a')
  assert.ok(w.nav.isBlocked(b.tx, b.ty), 'nobody walks through the board')
  const ly = ((b.ty % 12) + 12) % 12
  assert.notEqual(ly, 4, 'not on the row in front of the doors')
  for (const bd of w.buildings.values()) {
    assert.ok(!(b.tx >= bd.x && b.tx < bd.x + bd.w && b.ty >= bd.y && b.ty < bd.y + bd.h), 'not inside a building')
  }
  // Every fence gap still opens onto a walkable tile.
  const [cx, cy] = w.plots.get('a').cells[0]
  for (const [gx, gy, ix, iy] of [[1, 4, 2, 4], [1, 9, 2, 9], [10, 4, 9, 4], [10, 9, 9, 9], [4, 10, 4, 9], [7, 10, 7, 9]]) {
    assert.ok(!w.nav.isBlocked(cx * 12 + ix, cy * 12 + iy), `the gap at ${gx},${gy} is not plugged`)
  }
  const at = `${b.tx},${b.ty}`
  w.setRoster(Array.from({ length: 7 }, (_, i) => T(`t${i + 1}`, 'a')), undefined, new Map(), new Map([['a', notes(9)]]))
  assert.ok(w.plots.get('a').cells.length > 1, 'the plot grew')
  assert.equal(`${w.board('board:a').tx},${w.board('board:a').ty}`, at)
  assert.equal(w.board('board:a').count, 9)
})

test('closing the last issue takes the board down and frees its tile', () => {
  const w = new World()
  w.setRoster([T('t1', 'a')], undefined, new Map(), new Map([['a', notes(2)]]))
  const { tx, ty } = w.board('board:a')
  w.setRoster([T('t1', 'a')], undefined, new Map(), new Map([['a', []]]))
  assert.equal(w.board('board:a'), null)
  assert.ok(!w.nav.isBlocked(tx, ty))
})

test('a villager standing where a board goes up walks off it', () => {
  const w = new World()
  w.setRoster([T('t1', 'a')])
  run(w, 12)
  const tile = w.plots.get('a').boardTile
  const v = w.villager('t1')
  v.x = tile.x + 0.5
  v.y = tile.y + 0.5
  v.goal = { x: v.x, y: v.y }
  w.setRoster([T('t1', 'a')], undefined, new Map(), new Map([['a', notes(1)]]))
  run(w, 3)
  assert.ok(w.nav.standable(v.x, v.y), `still inside the board at ${v.x.toFixed(2)},${v.y.toFixed(2)}`)
})

test('in a full plot, the thread you are working in still has a villager', () => {
  const w = new World()
  // More threads than the largest plot has slots; the newest is the one working.
  const threads = Array.from({ length: 40 }, (_, i) => T(`t${i + 1}`, 'a', 'sleeping'))
  threads.push(T('t99', 'a', 'working'))
  w.setRoster(threads)
  assert.ok(w.buildings.has('t99'), 'it has a building')
  assert.ok(w.villager('t99'), 'and a villager')
  run(w, 30)
  assert.equal(w.villager('t99').badge, 'working')
})

/** A village big enough to have plenty of countryside round it, ponds and woods included. */
function sprawl() {
  const w = new World()
  const roster = []
  for (let i = 0; i < 14; i++) roster.push(T(`s${i}`, `repo${i}`))
  w.setRoster(roster)
  return w
}

test('the countryside can always be crossed: every road can be reached from the gate', () => {
  const w = sprawl()
  const { map, nav } = w
  const start = [Math.floor(w.gate.x), Math.floor(w.gate.y)]
  const seen = new Set([start.join()])
  const queue = [start]
  while (queue.length) {
    const [x, y] = queue.pop()
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx
      const ny = y + dy
      const k = `${nx},${ny}`
      if (seen.has(k) || !nav.inside(nx, ny) || nav.isBlocked(nx, ny)) continue
      seen.add(k)
      queue.push([nx, ny])
    }
  }
  let roads = 0
  for (let y = map.oy; y < map.oy + map.h; y++) {
    for (let x = map.ox; x < map.ox + map.w; x++) {
      if (map.tileAt(x, y) !== TILE.ROAD) continue
      roads++
      assert.ok(seen.has(`${x},${y}`), `the road at ${x},${y} is cut off`)
    }
  }
  assert.ok(roads > 100)
})

test('nobody can walk on water', () => {
  const w = sprawl()
  let water = 0
  for (let y = w.map.oy; y < w.map.oy + w.map.h; y++) {
    for (let x = w.map.ox; x < w.map.ox + w.map.w; x++) {
      if (w.map.tileAt(x, y) !== TILE.WATER) continue
      water++
      assert.ok(w.nav.isBlocked(x, y), `the water at ${x},${y} is walkable`)
    }
  }
  assert.ok(water > 0, 'a village this size should have a pond somewhere')
})

test('a plot and every building on it carry the repo\'s style', () => {
  const w = new World()
  w.setRoster([T('t1', 'alpha'), T('t2', 'alpha'), T('t3', 'beta')])
  const snap = w.snapshot()
  const alpha = snap.plots.find((p) => p.name === 'alpha')
  assert.deepEqual(alpha.style, plotStyle('alpha'))
  for (const b of snap.buildings) assert.deepEqual(b.style, plotStyle(b.plot))
})

test('a building on a courtyard\'s top row has room above it; one down the side does not', () => {
  const w = new World()
  w.setRoster(Array.from({ length: 5 }, (_, i) => T(`r${i}`, 'solo')))
  const top = w.plots.get('solo').shape.yard.y
  const snap = w.snapshot()
  assert.ok(snap.buildings.some((b) => b.roomy) && snap.buildings.some((b) => !b.roomy))
  for (const b of snap.buildings) assert.equal(b.roomy, b.y === top, `the building at ${b.x},${b.y}`)
})

test('two villagers squeezing side by side into one gap in a fence both get through', () => {
  const w = new World()
  // The first plot takes the cell north of the square; its bottom fence has a gap at x 4..5, y -2.
  // t3 keeps the plot on the map, asleep at its door so it never wanders by and breaks them up.
  w.setRoster([T('t1', 'a'), T('t2', 'a'), T('t3', 'a', 'sleeping')])
  run(w, 25)
  w.setRoster([T('t3', 'a', 'sleeping')]) // t1 and t2 are archived and walk out to the gate
  // Let their houses finish coming down first: that rebuilds the map, and every route with it.
  run(w, 2)
  assert.ok(!w.nav.isBlocked(4, -2) && w.nav.isBlocked(3, -2) && w.nav.isBlocked(5, -2), 'the gap is where this test expects it')
  // Where a long simulated run left two villagers: shoulder to shoulder at the mouth of the gap,
  // each too far to one side to fit through it, each step towards the middle shoved straight back
  // by the other. They stood there walking for good.
  const at = { t1: [4.035885324295117, -2.224418682578415], t2: [4.908706023882051, -2.2203862875951685] }
  for (const [id, [x, y]] of Object.entries(at)) {
    const v = w.villager(id)
    v.setGoal(w.gate.x, w.gate.y)
    Object.assign(v, { x, y, stuck: 0, moving: true, anim: 'walk', path: [{ x: 4.5, y: -0.5 }, { ...w.gate }], pathVersion: w.nav.version })
  }
  run(w, 12)
  for (const id of ['t1', 't2']) {
    const v = w.villager(id)
    assert.ok(!v || v.y > -1, `${id} is still stuck at the gap, at ${v?.x.toFixed(2)},${v?.y.toFixed(2)}`)
  }
})

test('a villager whose every step is shoved straight back counts as stuck, and walks through', () => {
  const w = new World()
  w.setRoster([T('t1', 'a')])
  run(w, 25)
  const v = w.villager('t1')
  v.setGoal(w.gate.x, w.gate.y)
  let through = false
  for (let t = 0; t < 8; t += 1 / 30) {
    const x = v.x
    const y = v.y
    v.tick(1 / 30, w)
    // The crowd puts it back where it was, as two villagers in one gap do to each other.
    if (!v.ghost) Object.assign(v, { x, y })
    else through = true
  }
  assert.ok(through, 'walking on the spot never counted as stuck')
})

test('the square keeps the way out of the portal open, with planters either side of it', () => {
  const w = new World()
  w.setRoster([T('t1', 'a')])
  const gx = Math.floor(w.gate.x)
  const gy = Math.floor(w.gate.y)
  for (const [x, y] of [[gx, gy], [gx - 1, gy], [gx, gy + 1], [gx - 1, gy + 1], [gx, gy - 1]]) assert.ok(!w.nav.isBlocked(x, y), `${x},${y} by the portal is blocked`)
  const planters = w.statics.filter((s) => s.sprite === 'planter')
  assert.equal(planters.length, 2)
  for (const p of planters) assert.ok(w.nav.isBlocked(...p.blocks[0]))
})

test('the square\'s corner gardens, fountain, carts and benches stand where nobody walks through them', () => {
  const w = new World()
  w.setRoster([T('t1', 'a')])
  for (const [x, y] of [[0, 0], [11, 0], [0, 11], [11, 11], [1, 0], [0, 1]]) assert.ok(w.nav.isBlocked(x, y), `the garden at ${x},${y} is walkable`)
  for (const sprite of ['fountain', 'cart', 'bench']) {
    const props = w.statics.filter((s) => s.sprite === sprite)
    assert.ok(props.length > 0, `no ${sprite}`)
    for (const p of props) for (const [x, y] of p.blocks) assert.ok(w.nav.isBlocked(x, y))
  }
  // The benches face the portal from either side, and it can still be reached from all round.
  assert.ok(!w.nav.isBlocked(6, 9) && !w.nav.isBlocked(1, 3) && !w.nav.isBlocked(10, 8))
})

test('a building wears whatever its thread\'s roster says, and changes the moment that does', () => {
  const w = new World()
  w.setRoster([T('t1', 'a', 'working', { wear: 0 }), T('t2', 'a', 'sleeping', { wear: 5 }), T('t3', 'a')])
  const wear = () => Object.fromEntries(w.snapshot().buildings.map((b) => [b.id, b.wear]))
  assert.deepEqual(wear(), { t1: 0, t2: 5, t3: 1 }, 'a thread with no wear given is drawn as it was built')
  // Picked back up after months: good as new straight away, not a step at a time.
  w.setRoster([T('t1', 'a', 'idle', { wear: 2 }), T('t2', 'a', 'working', { wear: 0 }), T('t3', 'a')])
  assert.deepEqual(wear(), { t1: 2, t2: 0, t3: 1 })
})

test('a new theme restyles every plot and repaints the ground; the village\'s sub-theme counts for every folder', () => {
  const w = new World()
  w.setRoster([T('t1', 'a', 'working'), T('t2', 'b')])
  const before = w.map.version
  assert.equal(w.snapshot().theme, 'village')
  assert.deepEqual(w.plots.get('a').style, plotStyle('a'))
  assert.equal(w.setTheme('village'), false, 'the same theme again changes nothing')
  assert.equal(w.map.version, before)

  assert.equal(w.setTheme('construction', new Map(), 'high-rise'), true)
  assert.ok(w.map.version > before, 'the ground was repainted')
  const snap = w.snapshot()
  assert.equal(snap.theme, 'construction')
  for (const p of snap.plots) assert.deepEqual([p.style.theme, p.style.sub], ['construction', 'high-rise'])
  for (const b of snap.buildings) assert.equal(b.style.theme, 'construction')
  // A plot that turns up later is dressed like the rest.
  w.setRoster([T('t1', 'a', 'working'), T('t2', 'b'), T('t3', 'c')])
  assert.equal(w.plots.get('c').style.sub, 'high-rise')
})

test('mix and match: a folder can wear any theme\'s look, whatever the village wears, and its villagers dress for it', () => {
  const w = new World()
  const site = { theme: 'construction', sub: 'roadworks' }
  w.setTheme('village', new Map([['a', site], ['c', { theme: 'nope', sub: 'x' }]]))
  w.setRoster([T('t1', 'a', 'working'), T('t2', 'b'), T('t3', 'c')])
  const style = (n) => w.plots.get(n).style
  assert.deepEqual([style('a').theme, style('a').sub], ['construction', 'roadworks'])
  assert.deepEqual(style('b'), plotStyle('b'), 'a folder without a look follows the village')
  assert.deepEqual(style('c'), plotStyle('c'), 'a look that doesn\'t exist is ignored')
  run(w, 25)
  const hat = (id) => w.snapshot().villagers.find((v) => v.id === id).look.hat
  assert.equal(hat('t1'), 5, 'the roadworks crew wears hard hats in a countryside village')
  assert.notEqual(hat('t2'), 5)
  const building = (id) => w.snapshot().buildings.find((b) => b.id === id)
  assert.equal(building('t1').style.theme, 'construction')
  assert.equal(building('t2').style.theme, 'village')

  // The village becomes a site; the folder with its own look keeps it, the rest follow.
  w.setTheme('construction', new Map([['a', { theme: 'village', sub: 'stone-hamlet' }]]))
  assert.deepEqual([style('a').theme, style('a').sub], ['village', 'stone-hamlet'])
  assert.equal(style('b').theme, 'construction')
  assert.notEqual(hat('t1'), 5)
  assert.equal(hat('t2'), 5)
})

test('every plot has a landmark at the head of its field, standing where nobody walks and no flower grows', () => {
  const w = new World()
  const flowers = Array.from({ length: 40 }, (_, i) => F(`f${i}`))
  w.setRoster([T('t1', 'a'), T('t2', 'b')], undefined, new Map([['a', flowers]]))
  const snap = w.snapshot()
  assert.deepEqual(snap.landmarks.map((l) => l.plot).sort(), ['a', 'b'])
  const l = w.landmark('a')
  const bed = w.plots.get('a').shape.bed
  assert.ok(l.x >= bed.x && l.x + l.w <= bed.x + bed.w && l.y >= bed.y && l.y + l.h <= bed.y + bed.h, 'not in the field')
  for (let y = l.y; y < l.y + l.h; y++) {
    for (let x = l.x; x < l.x + l.w; x++) {
      assert.ok(w.nav.isBlocked(x, y), `${x},${y} under the landmark is walkable`)
      assert.equal(w.map.tileAt(x, y), TILE.YARD, `${x},${y} under the landmark is ploughed`)
    }
  }
  for (const f of flowers) {
    const p = w.flower(f.id)
    assert.ok(!(p.x >= l.x && p.x < l.x + l.w && p.y >= l.y && p.y < l.y + l.h), `${f.id} grows on the landmark`)
  }
  assert.equal(w.landmark('landmark:a'), l, 'found by its id too')
})

test('standing the landmarks elsewhere in their fields moves them, and the work growing round them', () => {
  const w = new World()
  // Enough finished work for a plot four cells across: a one-cell field is too shallow to move a
  // landmark about in, and takes the one row that keeps the walkway clear whatever it is asked.
  const flowers = Array.from({ length: 240 }, (_, i) => F(`f${i}`))
  const roster = () => w.setRoster([T('t1', 'a')], undefined, new Map([['a', flowers]]))
  roster()
  const head = { ...w.plots.get('a').landmarkRect }
  assert.equal(w.setLandmarkSpot('bottom'), true)
  const l = w.landmark('a')
  assert.ok(l.y > head.y, 'the landmark stayed at the head of the field')
  assert.ok(w.nav.isBlocked(l.x, l.y), 'nobody is kept out of where it now stands')
  assert.ok(!w.nav.isBlocked(head.x, head.y), 'they still walk round where it stood')
  roster()
  for (const f of flowers) {
    const p = w.flower(f.id)
    assert.ok(!(p.x >= l.x && p.x < l.x + l.w && p.y >= l.y && p.y < l.y + l.h), `${f.id} grows on the landmark`)
  }
  assert.equal(w.setLandmarkSpot('bottom'), false, 'the spot they already stand at changes nothing')
  assert.equal(w.setLandmarkSpot('nowhere'), true, 'a spot we don’t know is the default one')
  assert.deepEqual({ ...w.plots.get('a').landmarkRect }, head)
})

test('a landmark present at load is standing; a tier that rises later goes up with confetti', () => {
  const w = new World()
  // Done: it stands still at its door, so the confetti over it is still over it a moment later.
  w.setRoster([T('t1', 'a', 'done')], undefined, new Map(), new Map(), new Map([['a', 2]]))
  assert.equal(w.landmark('a').tier, 2)
  assert.equal(w.landmark('a').stage, 3, 'at load it is already built')
  assert.equal(w.effects.length, 0, 'and nobody celebrates what was already there')
  run(w, 25)
  w.setRoster([T('t1', 'a', 'done')], undefined, new Map(), new Map(), new Map([['a', 3]]))
  const l = w.landmark('a')
  assert.equal(l.tier, 3)
  assert.equal(l.stage, 0, 'a new tier goes up from its foundations')
  assert.ok(w.effects.some((e) => e.kind === 'confetti'), 'no confetti')
  // The villager on that plot cheers too, and keeps its own status.
  run(w, 2)
  const v = w.villager('t1')
  assert.ok(w.effects.some((e) => e.kind === 'confetti' && Math.hypot(e.x - v.x, e.y - (v.y - 1.5)) < 1), 'no confetti over the villager')
  assert.equal(v.status, 'done')
  run(w, 10)
  assert.equal(l.stage, 3)
})

test('a plot a new repo claims raises its landmark from the ground', () => {
  const w = new World()
  w.setRoster([T('t1', 'a')])
  w.setRoster([T('t1', 'a'), T('t2', 'b', 'idle', { known: false })])
  assert.equal(w.landmark('a').stage, 3)
  assert.equal(w.landmark('b').stage, 0)
})

test('a landmark is lit while somebody on its plot is working or waiting on you, like a window', () => {
  const w = new World()
  w.setRoster([T('t1', 'a', 'working'), T('t2', 'b', 'sleeping')])
  run(w, 25)
  const lit = Object.fromEntries(w.snapshot().landmarks.map((l) => [l.plot, l.lit]))
  assert.deepEqual(lit, { a: true, b: false })
})

test('a selected plot rings its landmark, unless something on it is selected', () => {
  const w = new World()
  w.setRoster([T('t1', 'a'), T('t2', 'b')])
  const ring = (opts) => Object.fromEntries(w.snapshot(opts).landmarks.map((l) => [l.plot, l.selected]))
  assert.deepEqual(ring({ selectedPlot: 'a' }), { a: true, b: false })
  assert.deepEqual(ring({ selectedPlot: 'a', selected: 't1' }), { a: false, b: false })
  assert.equal(w.snapshot({ hovered: 'landmark:b' }).landmarks.find((l) => l.plot === 'b').hovered, true)
})

test('when a plot grows, its landmark moves with the field and the villagers walk round it', () => {
  const w = new World()
  w.setRoster([T('t1', 'a')], undefined, new Map(), new Map(), new Map([['a', 1]]))
  const small = { x: w.landmark('a').x, y: w.landmark('a').y }
  w.setRoster(Array.from({ length: 9 }, (_, i) => T(`t${i + 1}`, 'a')), undefined, new Map(), new Map(), new Map([['a', 1]]))
  assert.ok(w.plots.get('a').cells.length > 1, 'the plot grew')
  const l = w.landmark('a')
  assert.notDeepEqual({ x: l.x, y: l.y }, small)
  assert.ok(w.nav.isBlocked(l.x, l.y))
  assert.equal(l.stage, 3, 'moving is not rebuilding')
})

test('a landmark\'s tier brings scenery into its plot\'s fence line, and never shuts anybody in', () => {
  const w = new World()
  const threads = [T('t1', 'a', 'working'), T('t2', 'a')]
  w.setRoster(threads)
  const blockedBefore = new Set()
  for (let y = w.map.oy; y < w.map.oy + w.map.h; y++) for (let x = w.map.ox; x < w.map.ox + w.map.w; x++) if (w.nav.isBlocked(x, y)) blockedBefore.add(`${x},${y}`)
  assert.equal(w.statics.filter((s) => s.plot).length, 0, 'a campfire brings nothing')
  w.setRoster(threads, undefined, new Map(), new Map(), new Map([['a', 5]]))
  const props = w.statics.filter((s) => s.plot === 'a')
  assert.deepEqual(props.map((s) => s.sprite).sort(), ['gateway', 'yardbench', 'yardlamp', 'yardlamp', 'yardplanter', 'yardplanter'])
  // They stand where the fence stood: nothing that was open is closed, and the gateway is walked through.
  for (let y = w.map.oy; y < w.map.oy + w.map.h; y++) {
    for (let x = w.map.ox; x < w.map.ox + w.map.w; x++) {
      if (w.nav.isBlocked(x, y)) assert.ok(blockedBefore.has(`${x},${y}`), `${x},${y} was walkable before the props came`)
    }
  }
  const gate = props.find((s) => s.sprite === 'gateway')
  assert.ok(!w.nav.isBlocked(Math.floor(gate.x), gate.y - 1), 'the gateway plugs its gap')
  for (const s of props) for (const [x, y] of s.blocks || []) assert.equal(w.map.decoAt(x, y), 0, `a fence still stands under the ${s.sprite}`)
})
