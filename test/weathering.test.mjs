import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LOOKS, lookFor, windowsOf } from '../src/render/sprites/weathering.js'
import { fitted } from '../src/render/sprites/buildings.js'
import { ACCENTS, PALETTE as P, hexToRgb } from '../src/render/sprites/palette.js'
import { generate } from '../src/render/sprites/registry.js'
import { KINDS } from '../src/sim/building.js'
import { GLEAMING, KEPT, WEAR } from '../src/sim/wear.js'

const VARIANTS = [0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 996]
/** A finished building as the renderer asks for it, top row or down the side. */
const draw = (kind, variant, wear, { roomy = true, frame = 0, lit = false } = {}) => {
  const f = fitted(kind, variant, roomy)
  const p = { accent: ACCENTS[variant % ACCENTS.length], variant, lit, wall: variant % 5, roofs: variant % 4, low: f.low }
  return generate(`building.${f.kind}.3`, frame, wear === undefined ? p : { ...p, wear })
}
const mask = (pc) => Array.from({ length: pc.w * pc.h }, (_, i) => (pc.data[i * 4 + 3] ? 1 : 0)).join('')
const same = (a, b) => a.data.every((v, i) => v === b.data[i])
/** How different two drawings of one building are: the mean colour distance over its pixels. */
const distance = (a, b) => {
  let sum = 0
  let n = 0
  for (let i = 0; i < a.data.length; i += 4) {
    if (!a.data[i + 3]) continue
    sum += Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2])
    n++
  }
  return sum / n
}
/** Mean luminance: fresh paint is more colourful as well, and that shouldn't count as brighter. */
const brightness = (pc) => {
  let sum = 0
  let n = 0
  for (let i = 0; i < pc.data.length; i += 4) if (pc.data[i + 3]) (sum += pc.data[i] * 0.3 + pc.data[i + 1] * 0.59 + pc.data[i + 2] * 0.11), n++
  return sum / n
}
const GLASS = new Set([P.window, P.windowShine, P.windowLit, P.windowLitCore].map((c) => Object.values(hexToRgb(c)).join()))
const glassIn = (pc) => {
  let n = 0
  for (let i = 0; i < pc.data.length; i += 4) if (pc.data[i + 3] && GLASS.has(`${pc.data[i]},${pc.data[i + 1]},${pc.data[i + 2]}`)) n++
  return n
}

test('every grade has a look, and a well-kept building is drawn exactly as it always was', () => {
  for (const w of WEAR) assert.ok(w in LOOKS, w)
  assert.equal(lookFor(KEPT), null)
  for (const kind of KINDS) for (const v of VARIANTS.slice(0, 6)) assert.ok(same(draw(kind, v, KEPT), draw(kind, v)), `${kind} v${v}`)
})

test('wear never changes a building\'s outline, so it never reaches over the doorstep above', () => {
  for (const kind of KINDS) {
    for (const v of VARIANTS) {
      for (const roomy of [true, false]) {
        const kept = mask(draw(kind, v, KEPT, { roomy }))
        WEAR.forEach((name, wear) => assert.equal(mask(draw(kind, v, wear, { roomy })), kept, `a ${name} ${kind} (v${v}) changed shape`))
      }
    }
  }
})

test('a weathered windmill\'s two frames still differ only in its sails', () => {
  for (const v of VARIANTS) {
    const [a, b] = [0, 1].map((frame) => draw('windmill', v, KEPT, { frame }))
    const still = []
    for (let i = 0; i < a.data.length; i += 4) if ([0, 1, 2, 3].every((k) => a.data[i + k] === b.data[i + k])) still.push(i)
    for (let wear = 0; wear < WEAR.length; wear++) {
      const [wa, wb] = [0, 1].map((frame) => draw('windmill', v, wear, { frame }))
      for (const i of still) assert.deepEqual([...wa.data.slice(i, i + 4)], [...wb.data.slice(i, i + 4)], `v${v} ${WEAR[wear]} flickers at pixel ${i / 4}`)
    }
  }
})

test('a building weathers the same way every time it is drawn', () => {
  for (const kind of KINDS) assert.ok(same(draw(kind, 42, WEAR.length - 1), draw(kind, 42, WEAR.length - 1)), kind)
})

test('the longer a thread sits, the further its building is from how it was built', () => {
  const averages = WEAR.map((_, wear) => {
    let sum = 0
    let n = 0
    for (const kind of KINDS) for (const v of VARIANTS) (sum += distance(draw(kind, v, wear), draw(kind, v, KEPT))), n++
    return sum / n
  })
  for (let w = KEPT + 1; w < WEAR.length; w++) {
    assert.ok(averages[w] > averages[w - 1], `${WEAR[w]} (${averages[w].toFixed(1)}) is no more worn than ${WEAR[w - 1]} (${averages[w - 1].toFixed(1)})`)
  }
})

test('a gleaming building is brighter than a kept one, and a derelict one has lost most of its windows', () => {
  for (const kind of KINDS) {
    for (const v of VARIANTS) assert.ok(brightness(draw(kind, v, GLEAMING)) > brightness(draw(kind, v, KEPT)), `a gleaming ${kind} v${v} is no brighter`)
  }
  let kept = 0
  let derelict = 0
  for (const v of VARIANTS) {
    kept += glassIn(draw('house', v, KEPT))
    derelict += glassIn(draw('house', v, WEAR.indexOf('derelict')))
  }
  assert.ok(derelict < kept * 0.5, `${derelict} of ${kept} window pixels left`)
})

test('lit windows weather too: a derelict house at night keeps its shape and loses its glass', () => {
  let kept = 0
  let derelict = 0
  for (const v of VARIANTS) {
    const lit = draw('house', v, WEAR.length - 1, { lit: true })
    const before = draw('house', v, KEPT, { lit: true })
    assert.equal(mask(lit), mask(before))
    kept += glassIn(before)
    derelict += glassIn(lit)
  }
  assert.ok(derelict < kept * 0.5, `${derelict} of ${kept} lit window pixels left`)
})

test('a window\'s panes are one window, and two windows apart are two', () => {
  const w = 12
  const h = 5
  const glass = new Uint8Array(w * h)
  // Two panes split by a one-pixel mullion at x = 2, then a second window from x = 7.
  for (const [x, y] of [[0, 0], [1, 0], [3, 0], [0, 1], [1, 1], [3, 1], [7, 0], [8, 0], [7, 1], [8, 1]]) glass[y * w + x] = 1
  const found = windowsOf(glass, w, h)
  assert.equal(found.length, 2)
  assert.deepEqual(found.map(({ x0, x1, n }) => [x0, x1, n]), [[0, 3, 6], [7, 8, 4]])
})
