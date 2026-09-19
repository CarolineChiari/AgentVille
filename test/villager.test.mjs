import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EXTRAS, HATS, TOPS, lookFor } from '../src/sim/villager.js'
import { THEMES } from '../src/sim/themes.js'
import { PALETTE as P } from '../src/render/sprites/palette.js'

/** What the themes hand out: nobody picks work gear for themselves, whichever theme it belongs to. */
const WORK_GEAR = {
  hat: Object.values(THEMES).map((t) => t.outfit?.hat).filter(Boolean),
  top: Object.values(THEMES).map((t) => t.outfit?.top).filter(Boolean),
}

const IDS = Array.from({ length: 4000 }, (_, i) => `claude-code:${(i * 7919).toString(16)}`)

test('a thread always looks the same', () => {
  assert.deepEqual(lookFor('t42'), lookFor('t42'))
})

test('everyone kept their face, hair style and hat when the new clothes came along', () => {
  // Recorded before hats had kinds and villagers had anything more than six choices.
  const before = {
    t1: { skin: 0, hair: 0, shirt: 0, pants: 1, style: 0, hat: 1 },
    t2: { skin: 2, hair: 2, shirt: 0, pants: 1, style: 0, hat: 0 },
    t3: { skin: 1, hair: 1, shirt: 2, pants: 0, style: 0, hat: 0 },
    'demo:1': { skin: 3, hair: 3, shirt: 3, pants: 0, style: 1, hat: 0 },
  }
  for (const [id, old] of Object.entries(before)) {
    const look = lookFor(id)
    assert.equal(look.skin, old.skin, id)
    assert.equal(look.style, old.style, id)
    if (old.hat) assert.ok(look.hat > 0, `${id} lost its hat`)
    // A colour only changes to one of the new ones.
    assert.ok(look.hair === old.hair || look.hair >= 5, `${id}'s hair`)
    assert.ok(look.shirt === old.shirt || look.shirt >= 6, `${id}'s shirt`)
    assert.ok(look.pants === old.pants || look.pants >= 3, `${id}'s trousers`)
  }
})

test('every hat, top, extra and colour turns up, and every index has a colour to go with it', () => {
  const seen = { hat: new Set(), top: new Set(), extra: new Set(), hair: new Set(), shirt: new Set(), pants: new Set(), shoe: new Set(), hatColor: new Set(), tall: new Set() }
  for (const id of IDS) {
    const look = lookFor(id)
    for (const k of Object.keys(seen)) seen[k].add(look[k])
  }
  assert.equal(seen.hat.size, HATS.length - WORK_GEAR.hat.length)
  assert.equal(seen.top.size, TOPS.length - WORK_GEAR.top.length)
  for (const name of WORK_GEAR.hat) assert.ok(!seen.hat.has(HATS.indexOf(name)), `somebody put on a ${name} by themselves`)
  for (const name of WORK_GEAR.top) assert.ok(!seen.top.has(TOPS.indexOf(name)), `somebody put on a ${name} by themselves`)
  assert.equal(seen.extra.size, EXTRAS.length)
  assert.equal(seen.hair.size, P.hair.length)
  assert.equal(seen.shirt.size, P.cloth.length)
  assert.equal(seen.pants.size, P.pants.length)
  assert.equal(seen.shoe.size, P.shoes.length)
  assert.equal(seen.hatColor.size, P.cloth.length)
  assert.equal(seen.tall.size, 2)
})

test('most villagers are plainly dressed; the extras are occasional', () => {
  const share = (f) => IDS.filter((id) => f(lookFor(id))).length / IDS.length
  const plain = share((l) => TOPS[l.top] === 'plain')
  const bare = share((l) => EXTRAS[l.extra] === 'none')
  const hatted = share((l) => l.hat > 0)
  assert.ok(plain > 0.3 && plain < 0.5, `plain tops ${plain}`)
  assert.ok(bare > 0.45 && bare < 0.65, `no extra ${bare}`)
  assert.ok(hatted > 0.25 && hatted < 0.45, `hats ${hatted}`)
})
