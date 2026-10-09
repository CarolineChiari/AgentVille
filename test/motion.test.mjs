import { test } from 'node:test'
import assert from 'node:assert/strict'
import { reducedMotion, villageSummary } from '../src/game/motion.js'
import { announcementFor } from '../src/game/notify.js'
import { Camera } from '../src/render/camera.js'

test('motion follows the system unless the setting says otherwise', () => {
  assert.equal(reducedMotion({ motion: 'system' }, true), true)
  assert.equal(reducedMotion({ motion: 'system' }, false), false)
  assert.equal(reducedMotion({}, true), true)
  assert.equal(reducedMotion({ motion: 'reduce' }, false), true)
  assert.equal(reducedMotion({ motion: 'full' }, true), false)
})

test('the summary counts only what is there', () => {
  assert.equal(villageSummary({}), 'The village: no villagers need you.')
  assert.equal(villageSummary({ waiting: 2, working: 1 }), 'The village: 2 need you, 1 working.')
})

test('an announcement reads like the notification', () => {
  assert.equal(announcementFor([]), '')
  const t = { id: 'a', status: 'waiting', title: 'Fix the login test', project: 'orchard' }
  assert.match(announcementFor([t]), /^Fix the login test\. .*orchard/)
})

test('an instant camera cuts instead of flying', () => {
  const cam = new Camera()
  cam.instant = true
  cam.flyTo(40, 50)
  assert.deepEqual([cam.x, cam.y, cam.target], [40, 50, null])
})
