import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  GROUP_COLORS, GROUP_MAX, GROUP_NAME_MAX, JOIN_SLACK_MS, JOIN_WAIT_MS, arrivals, cleanGroupMap, cleanGroupName, cleanGroupOf, cleanGroups,
  freeColor, groupFor, groupId, isGroupId, partition, withGroups,
} from '../src/game/groups.js'
import { normalizeState } from '../server/state.mjs'
import { mergeState } from '../src/game/merge-state.js'
import { ACCENTS } from '../src/render/sprites/palette.js'
import { ACCENT_COUNT, World } from '../src/sim/world.js'
import { Village } from '../src/game/village.js'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const G = (id, name, color = 0) => ({ id, name, color })

test('a group flies one of the accents, as a plot does', () => {
  assert.equal(GROUP_COLORS, ACCENTS.length)
  assert.equal(GROUP_COLORS, ACCENT_COUNT)
})

test('a group name is one trimmed line, capped', () => {
  assert.equal(cleanGroupName('  auth\n   rework '), 'auth rework')
  assert.equal(cleanGroupName('x'.repeat(200)).length, GROUP_NAME_MAX)
  assert.equal(cleanGroupName(7), '')
  assert.equal(cleanGroupName('   '), '')
})

test("a repo's groups keep only groups: an id, a name, a colour of ours, and no second of any name", () => {
  const out = cleanGroups([
    G('g-auth', ' Auth ', 3),
    G('g-auth', 'Another with the same id'),
    G('g-docs', 'AUTH'), // the same name whatever its case
    G('nope', 'Bad id'),
    G('g-empty', '  '),
    G('g-paint', 'Paint', 42),
    G('g-half', 'Half', 1.5),
    null,
    'g-x',
  ])
  assert.deepEqual(out, [G('g-auth', 'Auth', 3), G('g-paint', 'Paint', 0), G('g-half', 'Half', 0)])
  const many = Array.from({ length: GROUP_MAX + 5 }, (_, i) => G(`g-${i}`, `Group ${i}`))
  assert.equal(cleanGroups(many).length, GROUP_MAX)
  assert.deepEqual(cleanGroups('no'), [])
})

test('the saved maps drop whatever is not a group, and a repo left with none', () => {
  const groups = JSON.parse('{"a":[{"id":"g-x","name":"X","color":1}],"b":[],"c":"no","__proto__":[{"id":"g-p","name":"P"}]}')
  assert.deepEqual(cleanGroupMap(groups), { a: [G('g-x', 'X', 1)] })
  assert.equal(Object.getPrototypeOf(cleanGroupMap(groups)), Object.prototype)
  assert.deepEqual(cleanGroupMap([1]), {})
  const groupOf = JSON.parse('{"t1":"g-x","t2":"nope","t3":4,"__proto__":"g-p"}')
  assert.deepEqual(cleanGroupOf(groupOf), { t1: 'g-x' })
  assert.deepEqual(cleanGroupOf(null), {})
})

test('groups survive the store and a merge between tabs', () => {
  const s = normalizeState({ groups: { a: [G('g-x', ' X ', 2), G('bad', 'Y')] }, groupOf: { t1: 'g-x', t2: 5 } })
  assert.deepEqual(s.groups, { a: [G('g-x', 'X', 2)] })
  assert.deepEqual(s.groupOf, { t1: 'g-x' })
  assert.deepEqual(normalizeState({}).groups, {})
  assert.deepEqual(normalizeState({}).groupOf, {})
  const S = (groups, groupOf) => ({ archived: [], hiddenProjects: [], groups, groupOf, updatedAt: 1 })
  const base = S({ a: [G('g-x', 'X')] }, { t1: 'g-x' })
  const mine = S({ a: [G('g-x', 'X')], b: [G('g-y', 'Y')] }, { t1: 'g-x', t2: 'g-y' })
  const theirs = S({ a: [G('g-x', 'X')] }, {})
  const out = mergeState(base, mine, theirs)
  assert.deepEqual(out.groups, { a: [G('g-x', 'X')], b: [G('g-y', 'Y')] })
  assert.deepEqual(out.groupOf, { t2: 'g-y' }, 'their ungrouping of t1 stands, and my grouping of t2 lands')
})

test('a new group gets an id of its own, from its name', () => {
  assert.equal(groupId('Auth rework'), 'g-auth-rework')
  assert.equal(groupId('Auth rework', ['g-auth-rework']), 'g-auth-rework-2')
  assert.equal(groupId('Auth rework', ['g-auth-rework', 'g-auth-rework-2']), 'g-auth-rework-3')
  assert.equal(groupId('Ωμέγα'), 'g-group')
  assert.equal(groupId('   '), 'g-group')
  for (const name of ['Auth rework', 'Ωμέγα', 'x'.repeat(60), '--a--', 'Déjà vu']) {
    for (const taken of [[], Array.from({ length: 30 }, (_, i) => groupId(name, Array.from({ length: i }, (_, j) => (j ? `${groupId(name)}-${j + 1}` : groupId(name)))))]) {
      assert.ok(isGroupId(groupId(name, taken)), `${name} → ${groupId(name, taken)}`)
    }
  }
})

test("a new group's colour stands out from the plot's and from the repo's other groups", () => {
  const accent = 6
  const first = freeColor([], accent)
  assert.equal(first, (accent + 5) % GROUP_COLORS, 'across the wheel from the plot first')
  const picks = []
  for (let i = 0; i < GROUP_COLORS; i++) picks.push(freeColor(picks.map((c, j) => G(`g-${j}`, `${j}`, c)), accent))
  assert.equal(new Set(picks).size, GROUP_COLORS, 'no colour twice until every one is flown')
  assert.equal(picks.at(-1), accent, "the plot's own colour comes last")
  const all = picks.map((c, j) => G(`g-${j}`, `${j}`, c))
  assert.ok(Number.isInteger(freeColor(all, accent)), 'and when every colour is taken, still one of them')
  assert.equal(freeColor([], undefined), freeColor([], 0))
})

test('a thread is in a group only if its own repo has that group', () => {
  const groups = { orchard: [G('g-a', 'A', 2)], tidepool: [G('g-b', 'B')] }
  const groupOf = { t1: 'g-a', t2: 'g-b', t3: 'g-gone' }
  assert.deepEqual(groupFor({ id: 't1', project: 'orchard' }, groups, groupOf), G('g-a', 'A', 2))
  assert.equal(groupFor({ id: 't2', project: 'orchard' }, groups, groupOf), null, "another repo's group")
  assert.equal(groupFor({ id: 't3', project: 'orchard' }, groups, groupOf), null, 'a group that has been taken down')
  assert.equal(groupFor({ id: 't4', project: 'orchard' }, groups, groupOf), null)
  assert.equal(groupFor({ id: 'toString', project: 'constructor' }, groups, groupOf), null)
  const [a, b] = withGroups([{ id: 't1', project: 'orchard', title: 'x' }, { id: 't4', project: 'orchard' }], groups, groupOf)
  assert.deepEqual(a, { id: 't1', project: 'orchard', title: 'x', group: G('g-a', 'A', 2) })
  assert.equal(b.group, null)
})

test("a repo's threads under its groups, in the order the groups were made, and the rest after", () => {
  const a = G('g-a', 'A')
  const b = G('g-b', 'B')
  const threads = [{ id: 1, group: b }, { id: 2, group: null }, { id: 3, group: a }, { id: 4, group: b }, { id: 5, group: G('g-gone', 'Gone') }]
  const { groups, rest } = partition(threads, [a, b, G('g-c', 'C')])
  assert.deepEqual(groups.map((g) => [g.id, g.threads.map((t) => t.id)]), [['g-a', [3]], ['g-b', [1, 4]], ['g-c', []]])
  assert.deepEqual(rest.map((t) => t.id), [2, 5])
})

test('a session started in a group takes it up as it walks in', () => {
  const at = 1_000_000_000
  const T = (id, createdAt, project = 'orchard') => ({ id, project, createdAt })
  const waiting = [{ project: 'orchard', group: 'g-a', at }]
  const threads = [T('old', at - JOIN_SLACK_MS - 1), T('elsewhere', at + 10, 'tidepool'), T('grouped', at + 5), T('new', at + 20), T('newer', at + 30)]
  const r = arrivals(waiting, threads, { grouped: 'g-b' }, at + 60_000)
  assert.deepEqual(r.joins, { new: 'g-a' }, 'the earliest made since, on its repo, in no group yet')
  assert.deepEqual(r.waiting, [])
  // Not here yet: still waited for, until it has been too long.
  assert.deepEqual(arrivals(waiting, [T('old', at - JOIN_SLACK_MS - 1)], {}, at + 1000).waiting, waiting)
  assert.deepEqual(arrivals(waiting, [], {}, at + JOIN_WAIT_MS + 1).waiting, [])
  // A record stamped a moment before the ask still counts, but not one that was already there then.
  assert.deepEqual(arrivals(waiting, [T('stamped', at - 1000)], {}, at).joins, { stamped: 'g-a' })
  assert.deepEqual(arrivals([{ ...waiting[0], before: ['there'] }], [T('there', at - 1000), T('stamped', at - 500)], {}, at).joins, { stamped: 'g-a' })
  // Two started one after the other join in the order they were started.
  const two = [{ project: 'orchard', group: 'g-b', at: at + 5 }, { project: 'orchard', group: 'g-a', at }]
  assert.deepEqual(arrivals(two, [T('second', at + 40), T('first', at + 20)], {}, at + 100).joins, { first: 'g-a', second: 'g-b' })
})

/** A demo village, driven the way the page drives it: a scan, then what a person does. */
function village(threads) {
  const toasts = []
  const v = new Village({ world: new World(), settings: { hideDormant: false }, demo: true, toast: (m) => toasts.push(m) })
  const now = Date.now()
  v.scannedThreads = threads.map((t) => ({ project: 'orchard', projectPath: '/demo/orchard', createdAt: now - 1000, lastActivityAt: now, title: t.id, ...t }))
  v._name()
  v.scanned = true
  v.apply()
  return { v, toasts }
}

test('groups are made, named, coloured and taken down from the village', () => {
  const { v, toasts } = village([{ id: 'a' }, { id: 'b' }, { id: 'c' }])
  const auth = v.addGroup('orchard', '  Auth ')
  assert.equal(auth, 'g-auth')
  assert.equal(v.addGroup('orchard', 'auth'), '', 'a name the repo already has')
  assert.equal(v.addGroup('orchard', ' '), '', 'no name')
  assert.deepEqual(toasts, ['orchard already has a group called “Auth”.', 'A group needs a name.'])
  const docs = v.addGroup('orchard', 'Docs')
  assert.notEqual(v.groupsOf('orchard')[0].color, v.groupsOf('orchard')[1].color)
  v.setGroup('a', auth)
  v.setGroup('b', auth)
  v.setGroup('c', 'g-nowhere')
  assert.equal(v.thread('a').group.name, 'Auth')
  assert.equal(v.thread('c').group, null, 'only a group its repo has')
  assert.equal(v.renameGroup('orchard', auth, 'Docs'), false, 'a name another group has')
  assert.equal(v.renameGroup('orchard', auth, 'Login'), true)
  assert.equal(v.thread('a').group.name, 'Login')
  v.recolorGroup('orchard', auth, 7)
  assert.equal(v.thread('b').group.color, 7)
  const r = v.repos().find((x) => x.name === 'orchard')
  assert.deepEqual(r.groups.map((g) => [g.name, g.threads.map((t) => t.id), g.counts.idle]), [['Login', ['a', 'b'], 2], ['Docs', [], 0]])
  assert.deepEqual(r.ungrouped.map((t) => t.id), ['c'])
  // A house flies its group's colour, and one in no group none.
  assert.equal(v.world.buildings.get('a').banner, 7)
  assert.equal(v.world.buildings.get('c').banner, null)
  // Taking a group down leaves its threads in none, and a new one of the same name is a new group.
  v.removeGroup('orchard', auth)
  assert.equal(v.thread('a').group, null)
  assert.deepEqual(v.groupsOf('orchard').map((g) => g.id), [docs])
  assert.equal(v.world.buildings.get('a').banner, null)
  v.state.groupOf = { ...v.state.groupOf, gone: 'g-login' } // a thread no scan finds any more still names it
  assert.equal(v.addGroup('orchard', 'Login'), 'g-login-2')
  v.removeGroup('orchard', docs)
  v.removeGroup('orchard', 'g-login-2')
  assert.deepEqual(v.state.groups, {}, 'a repo with no groups left keeps none')
})

test('a thread keeps its group while archived, and comes back to it', () => {
  const { v } = village([{ id: 'a' }, { id: 'b' }])
  const g = v.addGroup('orchard', 'Auth')
  v.setGroup('a', g)
  v.archive('a')
  assert.equal(v.thread('a').group.id, g, 'its flower is still of the group')
  v.unarchive('a')
  assert.equal(v.view.live.find((t) => t.id === 'a').group.id, g)
})

test('a session started in a group joins it when it walks in', () => {
  const { v } = village([{ id: 'a' }])
  const g = v.addGroup('orchard', 'Auth')
  v._expect('orchard', g)
  v._expect('orchard', 'g-nowhere') // not one of the repo's: nothing to wait for
  assert.equal(v._waiting.length, 1)
  v.scannedThreads = [...v.scannedThreads, { id: 'new', project: 'orchard', projectPath: '/demo/orchard', createdAt: Date.now(), lastActivityAt: Date.now(), title: 'new' }]
  v._name()
  v._join()
  v.apply()
  assert.equal(v.thread('new').group.id, g)
  assert.equal(v.thread('a').group, null, 'one that was already there stays out of it')
  assert.equal(v._waiting.length, 0)
})

test('the desktop app ships every file the server takes from src/', () => {
  const files = new Set(JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).build.files)
  for (const dir of ['server', 'electron']) {
    const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]))
    for (const file of walk(path.join(ROOT, dir)).filter((f) => f.endsWith('.mjs'))) {
      for (const [, spec] of fs.readFileSync(file, 'utf8').matchAll(/from '([^']+)'/g)) {
        if (!spec.startsWith('.')) continue
        const rel = path.relative(ROOT, path.resolve(path.dirname(file), spec)).split(path.sep).join('/')
        if (rel.startsWith('src/')) assert.ok(files.has(rel), `${path.relative(ROOT, file)} imports ${rel}, which the app doesn't ship`)
      }
    }
  }
})
