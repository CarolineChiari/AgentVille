import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ACT_IDS, ARM_MAX_MS, ARM_STEP_MS, CATCH_UP_MS, DEFAULT_POOLS, EVENT_KINDS, HEX_ROWS, KONAMI, LOOP_MS, MAX_WINDOWS, TERM_LINES,
  armDelay, buttonLines, comboLabel, cipherAt, clockOf, codeAt, codeStream, comboOf, commandOf, coverage, crackerAt, dossierOf, eggLines,
  enhanceAt, eventContent, eventsFor, eventsToFire, fill, globeAt, hexRows, ipOf, isStorm, konamiStep, lineAt, loopSeed,
  nudged, progressAt, sceneAt, scheduleFor, secretIn, showAt, streamAt, sysmonAt, tictactoeAt, toneOf, tracerAt, typerChunk,
  verdictAt, wpmOf,
} from '../src/sim/hacker.js'
import * as T from '../src/sim/hacker-text.js'
import { mulberry32 } from '../src/sim/rng.js'

const POOLS = { names: ['Wren', 'Otto', 'Mabel'], repos: ['orchard', 'quill'] }
const key = (o) => ({ code: 'KeyH', key: 'H', shiftKey: true, metaKey: false, ctrlKey: false, altKey: false, ...o })
const forbidden = (s) => T.FORBIDDEN.find((re) => re.test(s))

test('⌘⇧H and Ctrl+Shift+H toggle; with ⌥ or Alt they arm', () => {
  assert.equal(comboOf(key({ metaKey: true })), 'toggle')
  assert.equal(comboOf(key({ ctrlKey: true })), 'toggle')
  // ⌥H types ˙ on a Mac: the physical key is what counts.
  assert.equal(comboOf(key({ metaKey: true, altKey: true, key: '˙' })), 'arm')
  assert.equal(comboOf(key({ ctrlKey: true, altKey: true })), 'arm')
})

test('nothing else is the combo', () => {
  assert.equal(comboOf(key({ metaKey: true, shiftKey: false })), null)
  assert.equal(comboOf(key({})), null)
  assert.equal(comboOf(key({ metaKey: true, code: 'KeyK' })), null)
  assert.equal(comboOf({ key: 'h' }), null)
  assert.equal(comboOf(undefined), null)
  assert.equal(comboOf('KeyH'), null)
})

test('the keys are named the way the keyboard writes them', () => {
  assert.equal(comboLabel('MacIntel'), '⌘⇧H')
  assert.equal(comboLabel('MacIntel', true), '⌘⇧⌥H')
  assert.equal(comboLabel('Win32'), 'Ctrl+Shift+H')
  assert.equal(comboLabel('Linux x86_64', true), 'Ctrl+Shift+Alt+H')
})

test('each press of the arm keys adds a minute, up to an hour', () => {
  assert.equal(armDelay(1), ARM_STEP_MS)
  assert.equal(armDelay(3), 3 * ARM_STEP_MS)
  assert.equal(armDelay(500), ARM_MAX_MS)
  assert.equal(armDelay(0), ARM_STEP_MS)
  assert.equal(armDelay('junk'), ARM_STEP_MS)
})

test('a loop of the show is scenes that tile two hours exactly', () => {
  const s = scheduleFor(loopSeed('a', 0))
  assert.equal(s[0].start, 0)
  assert.equal(s.at(-1).end, LOOP_MS)
  for (let i = 0; i < s.length; i++) {
    const sc = s[i]
    if (i) assert.equal(sc.start, s[i - 1].end)
    assert.ok(sc.end - sc.start >= 60_000, `scene ${i} is too short`)
    assert.ok(sc.windows.length <= MAX_WINDOWS)
    assert.equal(sc.windows.filter((w) => w.kind === 'console').length, 1)
    for (const w of sc.windows) {
      assert.ok(w.opensAt >= sc.start && w.closesAt <= sc.end && w.opensAt < w.closesAt, `${w.id} opens outside its scene`)
    }
  }
})

test('the schedule is the same for a seed, and the next loop is a different show', () => {
  assert.deepEqual(scheduleFor('x/0'), scheduleFor('x/0'))
  const a = scheduleFor(loopSeed('x', 0)).map((s) => s.act).join()
  const b = scheduleFor(loopSeed('x', 1)).map((s) => s.act).join()
  assert.notEqual(a, b)
})

test('acts never follow themselves, every act comes round twice, and every kind of window shows', () => {
  for (let n = 0; n < 30; n++) {
    const s = scheduleFor(`seed${n}/0`)
    for (let i = 1; i < s.length; i++) assert.notEqual(s[i].act, s[i - 1].act, `seed${n} repeats ${s[i].act}`)
    for (const act of ACT_IDS) assert.ok(s.filter((x) => x.act === act).length >= 2, `seed${n} has ${act} less than twice`)
    assert.deepEqual([...coverage(s)].sort(), [...T.KINDS].sort())
  }
})

test('windows stay on screen, are big enough to read, and never stack exactly', () => {
  for (let n = 0; n < 10; n++) {
    for (const sc of scheduleFor(`lay${n}/0`)) {
      const corners = new Set()
      for (const w of sc.windows) {
        assert.ok(w.x >= 0 && w.y >= 0 && w.x + w.w <= 100 && w.y + w.h <= 100, `${w.id} is off screen`)
        assert.ok(w.w >= 15 && w.h >= 15, `${w.id} is too small`)
        corners.add(`${w.x},${w.y}`)
        const moved = nudged(w, mulberry32(n))
        assert.ok(moved.x >= 0 && moved.x + w.w <= 100 && moved.y >= 0 && moved.y + w.h <= 100)
      }
      assert.equal(corners.size, sc.windows.length)
    }
  }
})

test('sceneAt finds the scene and only its open windows', () => {
  const s = scheduleFor('find/0')
  const third = s[2]
  const at = sceneAt(s, third.start + 60_000)
  assert.equal(at.scene, third)
  assert.equal(at.t, 60_000)
  for (const w of at.open) assert.ok(w.opensAt <= third.start + 60_000 && w.closesAt > third.start + 60_000)
  assert.ok(at.open.some((w) => w.id === 'console'))
  assert.equal(sceneAt(s, 0).scene, s[0])
})

test('the show knows which loop it is in', () => {
  assert.deepEqual(showAt('s', 5_000), { loop: 0, seed: 's/0', t: 5_000 })
  assert.deepEqual(showAt('s', LOOP_MS + 7), { loop: 1, seed: 's/1', t: 7 })
  assert.equal(showAt('s', -5).t, 0)
})

test('a terminal only ever adds lines, keeps forty, and names only what it is given', () => {
  const win = scheduleFor('t/0').flatMap((s) => s.windows).find((w) => w.kind === 'terminal')
  const a = streamAt(win, 20_000, POOLS)
  const b = streamAt(win, 20_000 + win.cadenceMs * 5, POOLS)
  assert.ok(a.length <= TERM_LINES && b.length <= TERM_LINES)
  const shared = a.filter((l) => b.some((m) => m.i === l.i))
  for (const l of shared) assert.deepEqual(l, b.find((m) => m.i === l.i))
  assert.equal(b.at(-1).i, a.at(-1).i + 5)
  const many = streamAt(win, 3_600_000, POOLS).map((l) => l.text).join('\n')
  for (const host of many.match(/\b[a-z]+-(mainframe|db01|node7|proxy|gateway|vault|core|relay|srv|bastion|nas|printer)\b/g) || []) {
    assert.ok(['wren', 'otto', 'mabel'].includes(host.split('-')[0]), `${host} is not one of the given names`)
  }
})

test('a chat line has a speaker', () => {
  const chat = { kind: 'chat', seed: 'c', act: 'standoff', cadenceMs: 2000 }
  const l = lineAt(chat, 3, POOLS)
  assert.ok(l.who && l.text)
})

test('the hex dump spells words in its ASCII column', () => {
  const rows = hexRows('h', 0, 60, POOLS)
  for (const r of rows) {
    assert.equal(r.hex.length, 16)
    for (const b of r.hex) assert.match(b, /^[0-9A-F]{2}$/)
    assert.equal(r.ascii.length, 16)
  }
  const words = rows.filter((r) => r.word)
  assert.equal(words.length, 10)
  for (const r of words) assert.ok(r.ascii.includes(r.word), `${r.word} is not in ${r.ascii}`)
  assert.equal(hexRows('h', 6, HEX_ROWS)[0].offset, '00000060')
})

test('the cracker locks letters in, says granted, and moves on to another password', () => {
  const win = { seed: 'pw' }
  let last = -1
  for (let t = 0; t < 9_000; t += 250) {
    const c = crackerAt(win, t)
    assert.ok(c.locked >= last)
    assert.ok(T.PASSWORDS.includes(c.target))
    assert.equal(c.display.length, [...c.target].length)
    last = c.locked
  }
  const g = crackerAt(win, 10_000)
  assert.ok(g.granted)
  assert.equal(g.locked, g.target.length)
  assert.equal(g.display, g.target)
  assert.equal(crackerAt(win, 14_000).k, 1)
})

test('a stuck bar never gets past 99; the others reach 100', () => {
  let stuck = null
  for (let n = 0; n < 40 && !stuck; n++) if (progressAt({ seed: `b${n}`, act: 'exfil' }, 0).some((b) => b.stuck)) stuck = `b${n}`
  assert.ok(stuck)
  const etas = new Set()
  for (let t = 0; t < 600_000; t += 1_000) {
    const bar = progressAt({ seed: stuck, act: 'exfil' }, t).find((b) => b.stuck)
    assert.ok(bar.pct <= 99)
    etas.add(bar.eta)
  }
  assert.ok(etas.size > 3)
  let full = false
  for (let t = 0; t < 200_000 && !full; t += 500) full = progressAt({ seed: stuck, act: 'exfil' }, t).some((b) => !b.stuck && b.pct === 100)
  assert.ok(full)
})

test('pings sit on the globe and there are only ever a few', () => {
  for (let t = 0; t < 120_000; t += 3_700) {
    const g = globeAt({ seed: 'g' }, t)
    assert.ok(g.pings.length <= 8)
    for (const p of g.pings) assert.ok(Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180 && p.age >= 0 && p.age <= p.life)
  }
})

test('addresses are real octets unless they are one of the jokes', () => {
  const rand = mulberry32(7)
  for (let i = 0; i < 500; i++) {
    const plain = ipOf(rand, false).split('.').map(Number)
    assert.equal(plain.length, 4)
    for (const o of plain) assert.ok(o >= 1 && o <= 254)
    const any = ipOf(rand)
    assert.ok(T.IP_EGGS.includes(any) || any.split('.').every((o) => Number(o) <= 255))
  }
})

test('the tracer gains hops and completes', () => {
  const a = tracerAt({ seed: 'tr' }, 1_000)
  const b = tracerAt({ seed: 'tr' }, 10_000)
  assert.ok(b.hops.length > a.hops.length)
  assert.deepEqual(b.hops.slice(0, a.hops.length), a.hops)
  const done = tracerAt({ seed: 'tr' }, 19_000)
  assert.ok(done.done && done.pct === 100)
})

test('the cipher decrypts to a saying, the feed enhances, the monitor stays in range', () => {
  const c = cipherAt({ seed: 'q' }, 12_500)
  assert.ok(c.done)
  assert.equal(c.display, c.text)
  assert.ok(T.QUIPS.includes(c.text))
  assert.deepEqual(enhanceAt({ seed: 'f' }, 0), { k: 0, step: 0, label: 'LIVE', zoom: 1 })
  assert.equal(enhanceAt({ seed: 'f' }, 13_000).label, 'IDENTIFIED')
  assert.equal(enhanceAt({ seed: 'f' }, 16_000).k, 1)
  const m = sysmonAt({ seed: 'm' }, 400_000)
  for (const v of [...m.cpu, ...m.net]) assert.ok(v >= 0 && v <= 1)
  assert.equal(m.ram, 110)
})

test('WOPR plays itself to a draw', () => {
  const { board, done } = tictactoeAt(60_000)
  assert.ok(done)
  const lines = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]]
  for (const l of lines) assert.ok(!(board[l[0]] !== ' ' && l.every((i) => board[i] === board[l[0]])), `${l} is a win`)
  assert.equal(tictactoeAt(0).board.join(''), ' '.repeat(9))
})

test('the console types code whatever key is pressed, a few characters at a time', () => {
  const s = codeStream('k', POOLS)
  let cursor = 0
  let typed = ''
  for (let i = 0; i < 200; i++) {
    const c = typerChunk(s, cursor)
    assert.ok(c.text.length >= 1 && c.text.length <= 14)
    assert.deepEqual(typerChunk(s, cursor), c)
    typed += c.text
    cursor = c.next
  }
  assert.ok(s.startsWith(typed.slice(0, 50)))
  const shown = codeAt(s, { cadenceMs: 10 }, 1_000_000)
  assert.ok(shown.lines.length <= 30 && shown.lines.length > 0)
})

test('Enter is denied three times, then lets you in', () => {
  const v = [0, 1, 2, 3].map((n) => verdictAt('v', n))
  assert.ok(v.slice(0, 3).every((x) => x.tone === 'err' || x.tone === 'warn'))
  assert.equal(v[3].tone, 'ok')
})

test('secret words are found at the end of what was typed, longest first', () => {
  assert.equal(secretIn('asdfswordfish'), 'crack')
  assert.equal(secretIn('xx HACK THE PLANET'), 'planet')
  assert.equal(secretIn('sudo make me a sandwich'), 'sandwichOk')
  assert.equal(secretIn('make me a sandwich'), 'sandwichNo')
  assert.equal(secretIn('swordfishy'), null)
  assert.equal(secretIn(''), null)
  // Every secret is five letters at least, so mashing the keyboard never trips one.
  for (const k of Object.keys(T.SECRETS)) assert.ok(k.length >= 5, k)
  for (const egg of [...Object.values(T.SECRETS), ...Object.values(T.COMMANDS)]) assert.ok(T.EGGS[egg], `no egg called ${egg}`)
})

test('commands and villager names work after Enter', () => {
  assert.deepEqual(commandOf(' WhoAmI '), { egg: 'whoami' })
  assert.deepEqual(commandOf('$ exit'), { egg: 'exit' })
  assert.deepEqual(commandOf('42'), { egg: 'answer' })
  assert.deepEqual(commandOf('otto', POOLS), { egg: 'operative', name: 'Otto' })
  assert.equal(commandOf('asdf'), null)
  assert.equal(commandOf('   '), null)
})

test('the Konami code, and a slip starts it again', () => {
  const press = (keys) => keys.reduce((p, k) => konamiStep(p, k.startsWith('Arrow') ? { code: k, key: k } : { code: 'KeyX', key: k }), 0)
  assert.equal(press(KONAMI), KONAMI.length)
  assert.equal(press([...KONAMI.slice(0, 9), 'b']), 0)
  assert.equal(press(['ArrowUp', 'ArrowUp', 'ArrowUp']), 2)
  assert.equal(press(['ArrowUp', 'ArrowDown']), 0)
  assert.equal(press(['ArrowUp', 'ArrowUp', 'ArrowUp', ...KONAMI.slice(2)]), KONAMI.length)
})

test('words per minute count only the recent keys', () => {
  assert.equal(wpmOf([], 1000), 0)
  const now = 100_000
  const times = Array.from({ length: 50 }, (_, i) => now - i * 100)
  assert.equal(wpmOf(times, now), 60)
  assert.equal(wpmOf([now - 20_000], now), 0)
})

test('events are spread through the loop, every kind comes up, and a long gap fires only the last', () => {
  const ev = eventsFor('ev/0')
  for (let i = 1; i < ev.length; i++) assert.ok(ev[i].at - ev[i - 1].at >= 20_000)
  assert.ok(ev[0].at >= 60_000 && ev.at(-1).at < LOOP_MS)
  assert.deepEqual([...new Set(ev.map((e) => e.kind))].sort(), [...EVENT_KINDS].sort())
  const a = ev[3].at
  assert.deepEqual(eventsToFire(ev, a, a + 1), [ev[3]])
  assert.deepEqual(eventsToFire(ev, a + 1, a + 2), [])
  assert.deepEqual(eventsToFire(ev, 0, LOOP_MS), [ev.at(-1)])
  assert.ok(CATCH_UP_MS < 20_000)
  for (const e of ev) assert.ok(eventContent(e, POOLS))
})

test('templates fill, tones read, clocks count', () => {
  assert.equal(fill('{name}', mulberry32(1), { names: ['Ivy'], repos: ['x'] }), 'Ivy')
  assert.equal(fill('{who} {nope}', mulberry32(1), POOLS, { who: 'me' }), 'me {nope}')
  assert.deepEqual(toneOf('! ACCESS DENIED'), { tone: 'err', text: 'ACCESS DENIED' })
  assert.deepEqual(toneOf('plain'), { tone: '', text: 'plain' })
  assert.equal(clockOf(3_723_000), '01:02:03')
  assert.ok(dossierOf('d', POOLS).name)
  assert.equal(dossierOf('d', POOLS, 'Otto').name, 'Otto')
})

test('buttons answer, and DO NOT PRESS gets worse', () => {
  for (const b of T.BUTTONS) assert.ok(buttonLines(b.id, 0, POOLS).length, b.id)
  assert.notDeepEqual(buttonLines('nope', 0), buttonLines('nope', 1))
  assert.ok(isStorm(T.DO_NOT_PRESS.length - 1))
  assert.ok(!isStorm(0))
})

// ---------- guards ----------

const strings = (v) => (typeof v === 'string' ? [v] : Array.isArray(v) ? v.flatMap(strings) : v && typeof v === 'object' ? Object.entries(v).flatMap(([k, x]) => [k, ...strings(x)]) : [])

test('nothing the show can say looks like wiping a disk or reading real files', () => {
  for (const [name, value] of Object.entries(T)) {
    if (name === 'FORBIDDEN') continue
    for (const s of strings(value)) assert.equal(forbidden(s), undefined, `${name}: "${s}"`)
  }
  for (let n = 0; n < 4; n++) {
    for (const sc of scheduleFor(`guard${n}/0`)) {
      for (const w of sc.windows) {
        assert.equal(forbidden(w.title), undefined, w.title)
        if (w.kind === 'terminal' || w.kind === 'chat') for (const l of streamAt(w, 50 * w.cadenceMs)) assert.equal(forbidden(l.text), undefined, l.text)
      }
    }
  }
  assert.equal(forbidden(codeStream('guard')), undefined)
  for (const id of Object.keys(T.EGGS)) for (const l of eggLines(id, 1, DEFAULT_POOLS, { uptime: '00:01:00', wpm: 200, date: 'today' })) assert.equal(forbidden(l.text), undefined, l.text)
})

test('the pools are tidy', () => {
  for (const h of T.HANDLES) assert.match(h, /^[a-z0-9_]{3,16}$/)
  assert.equal(new Set(T.PASSWORDS).size, T.PASSWORDS.length)
  assert.equal(new Set(T.HIDDEN_WORDS).size, T.HIDDEN_WORDS.length)
  for (const q of T.QUIPS) assert.ok(q.length <= 70, q)
  for (const k of T.KINDS) assert.ok(T.TITLES[k]?.length, `no titles for ${k}`)
  for (const [id, act] of Object.entries(T.ACTS)) for (const k of [...act.need, ...act.may]) assert.ok(T.KINDS.includes(k), `${id} names ${k}`)
  for (const [, lat, lon] of T.CITIES) assert.ok(Math.abs(lat) <= 90 && Math.abs(lon) <= 180)
})
