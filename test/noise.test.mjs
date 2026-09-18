import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fbm, lattice, noise2 } from '../src/sim/noise.js'

const samples = (fn) => {
  const out = []
  for (let y = -20; y < 20; y += 0.37) for (let x = -20; x < 20; x += 0.41) out.push(fn(x, y))
  return out
}

test('noise stays in [0, 1) and uses most of that range', () => {
  for (const fn of [(x, y) => noise2(x, y, 3), (x, y) => fbm(x, y, 3)]) {
    const v = samples(fn)
    assert.ok(v.every((n) => n >= 0 && n < 1))
    assert.ok(Math.min(...v) < 0.2 && Math.max(...v) > 0.8, 'noise that never strays from the middle makes no patches')
  }
})

test('the same place and seed always give the same value', () => {
  assert.equal(fbm(12.3, -4.5, 7), fbm(12.3, -4.5, 7))
  assert.equal(lattice(5, -9, 2), lattice(5, -9, 2))
})

test('noise passes through the lattice values and changes smoothly between them', () => {
  assert.equal(noise2(4, 7, 1), lattice(4, 7, 1))
  for (let x = 0; x < 6; x += 0.05) {
    assert.ok(Math.abs(noise2(x, 2.5, 1) - noise2(x + 0.01, 2.5, 1)) < 0.05, `a jump at x=${x}`)
  }
})

test('different seeds give unrelated fields', () => {
  const a = samples((x, y) => noise2(x, y, 1))
  const b = samples((x, y) => noise2(x, y, 2))
  const mean = (v) => v.reduce((s, n) => s + n, 0) / v.length
  const ma = mean(a)
  const mb = mean(b)
  let cov = 0
  let va = 0
  let vb = 0
  for (let i = 0; i < a.length; i++) {
    cov += (a[i] - ma) * (b[i] - mb)
    va += (a[i] - ma) ** 2
    vb += (b[i] - mb) ** 2
  }
  assert.ok(Math.abs(cov / Math.sqrt(va * vb)) < 0.2)
})

test('neighbouring lattice points do not repeat a pattern', () => {
  const seen = new Set()
  for (let y = 0; y < 30; y++) for (let x = 0; x < 30; x++) seen.add(lattice(x, y, 0))
  assert.equal(seen.size, 900)
})
