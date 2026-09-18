import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CLOUD_R, FLOCK_EVERY, birdsAt, butterflyAt, cloudsIn, flockFor, smokePuffs } from '../src/render/ambient.js'

const VIEW = { x0: -300, y0: -200, x1: 400, y1: 250 }

test('a butterfly stays round its flower and beats its wings', () => {
  const frames = new Set()
  for (let t = 0; t < 60; t += 0.05) {
    const b = butterflyAt(100, 200, 12345, t)
    assert.ok(Math.abs(b.x - 100) <= 16 && Math.abs(b.y - 191) <= 8, `strayed to ${b.x},${b.y}`)
    frames.add(b.frame)
  }
  assert.deepEqual([...frames].sort(), [0, 1])
})

test('two butterflies are never in step', () => {
  const a = butterflyAt(0, 0, 1, 5)
  const b = butterflyAt(0, 0, 777, 5)
  assert.notDeepEqual([a.x, a.y], [b.x, b.y])
})

test('smoke rises from the chimney, spreading and thinning as it goes', () => {
  for (let t = 0; t < 10; t += 0.1) {
    for (const p of smokePuffs(50, 80, 99, t)) {
      assert.ok(p.y < 80, 'smoke below the chimney top')
      assert.ok(p.alpha > 0 && p.alpha <= 0.9)
    }
  }
  const puffs = smokePuffs(50, 80, 99, 3).sort((a, b) => b.y - a.y)
  for (let i = 1; i < puffs.length; i++) {
    assert.ok(puffs[i].alpha < puffs[i - 1].alpha, 'higher smoke is thinner')
    assert.ok(puffs[i].size >= puffs[i - 1].size, 'higher smoke is bigger')
  }
})

test('cloud shadows drift with the wind and are the same for the same moment', () => {
  assert.deepEqual(cloudsIn(VIEW, 100), cloudsIn(VIEW, 100))
  // Follow one cloud: a minute later, the same puff is further east.
  const big = { x0: -5000, y0: -5000, x1: 5000, y1: 5000 }
  const now = cloudsIn(big, 0)
  const later = cloudsIn(big, 60)
  const [c] = now
  const moved = later.find((d) => Math.abs(d.r - c.r) < 1e-9 && Math.abs(d.x - c.x - 300) < 1e-6)
  assert.ok(moved, 'a cloud did not drift east')
})

test('clouds cover part of the sky, not all of it, and only the ones in view are returned', () => {
  const clouds = cloudsIn(VIEW, 42)
  for (const c of clouds) assert.ok(c.x + c.r > VIEW.x0 && c.x - c.r < VIEW.x1 && c.y + c.r > VIEW.y0 && c.y - c.r < VIEW.y1)
  const big = { x0: 0, y0: 0, x1: 20000, y1: 20000 }
  const n = cloudsIn(big, 0).length / 3
  const cells = (20000 / 520) ** 2
  assert.ok(n > cells * 0.4 && n < cells * 0.85, `${n} clouds in ${cells.toFixed(0)} cells`)
  assert.ok(cloudsIn(big, 0).every((c) => c.r <= CLOUD_R * 1.3))
})

test('a flock crosses the view from one side to the other and then is gone', () => {
  for (let cycle = 0; cycle < 20; cycle++) {
    const flock = flockFor(cycle, VIEW)
    const start = birdsAt(flock, 0)
    const end = birdsAt(flock, flock.flight)
    assert.ok(start.length >= 3)
    assert.ok(start.every((b) => b.x < VIEW.x0 || b.x > VIEW.x1), 'birds appear on screen')
    assert.ok(end.every((b) => b.x < VIEW.x0 || b.x > VIEW.x1), 'birds vanish on screen')
    assert.ok(Math.sign(end[0].x - start[0].x) === Math.sign(flock.vx))
    assert.deepEqual(birdsAt(flock, flock.flight + 1), [])
    assert.ok(flock.flight < FLOCK_EVERY, 'a flock is still flying when the next sets off')
  }
  const wide = flockFor(3, { x0: 0, y0: 0, x1: 6000, y1: 3000 })
  assert.ok(wide.flight < FLOCK_EVERY, 'across a wide view a flock is still flying when the next sets off')
})
