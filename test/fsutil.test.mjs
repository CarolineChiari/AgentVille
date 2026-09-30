import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { isAlive, jsonLines, num, readHead, readTail, scanLines } from '../server/lib/fsutil.mjs'
import { DEAD_PID, tmpHome } from './helpers/fixtures.mjs'

test('readHead drops a trailing partial line', async (t) => {
  const { home, cleanup } = tmpHome()
  t.after(cleanup)
  const file = path.join(home, 'a.jsonl')
  fs.writeFileSync(file, '{"a":1}\n{"b":2}\n{"c":3}\n')
  const head = await readHead(file, 12) // cuts inside the second line
  assert.equal(head, '{"a":1}\n')
  assert.deepEqual(jsonLines(head), [{ a: 1 }])
})

test('readHead returns the whole file when it fits', async (t) => {
  const { home, cleanup } = tmpHome()
  t.after(cleanup)
  const file = path.join(home, 'a.jsonl')
  fs.writeFileSync(file, '{"a":1}\n{"b":2}')
  assert.deepEqual(jsonLines(await readHead(file, 1000)), [{ a: 1 }, { b: 2 }])
})

test('readTail drops a leading partial line', async (t) => {
  const { home, cleanup } = tmpHome()
  t.after(cleanup)
  const file = path.join(home, 'a.jsonl')
  fs.writeFileSync(file, '{"a":1}\n{"b":2}\n{"c":3}\n')
  assert.deepEqual(jsonLines(await readTail(file, 12)), [{ c: 3 }])
})

test('jsonLines skips malformed, blank and CRLF lines', () => {
  assert.deepEqual(jsonLines('{"a":1}\r\n\r\nnot json\n{"b":2}\n{"half'), [{ a: 1 }, { b: 2 }])
})

test('isAlive is true for this process and false for a dead pid', () => {
  assert.equal(isAlive(process.pid), true)
  assert.equal(isAlive(DEAD_PID), false)
  assert.equal(isAlive(0), false)
  assert.equal(isAlive('123'), false)
})

test('num coerces numbers, numeric strings and ISO dates', () => {
  assert.equal(num(5), 5)
  assert.equal(num('7'), 7)
  assert.equal(num('2026-01-01T00:00:00Z'), Date.parse('2026-01-01T00:00:00Z'))
  assert.equal(num(NaN, 3), 3)
  assert.equal(num(undefined), 0)
})

test('scanLines reads whole lines on from an offset and stops before a half-written one', async (t) => {
  const { home, cleanup } = tmpHome()
  t.after(cleanup)
  const file = path.join(home, 'a.jsonl')
  fs.writeFileSync(file, 'één\ntwo\nthr')
  const seen = []
  const end = await scanLines(file, 0, (l) => seen.push(l))
  assert.deepEqual(seen, ['één', 'two'])
  assert.equal(end, Buffer.byteLength('één\ntwo\n'))
  fs.appendFileSync(file, 'ee\n')
  seen.length = 0
  assert.equal(await scanLines(file, end, (l) => seen.push(l)), fs.statSync(file).size)
  assert.deepEqual(seen, ['three'])
})
