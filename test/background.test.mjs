import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { runInBackground } from '../server/background.mjs'

import { EventEmitter } from 'node:events'

// A child that spawns (or fails to) on the next tick, and exits when told.
const fakeSpawn = (calls, fail) => (cmd, argv, o) => {
  const child = Object.assign(new EventEmitter(), { unref() {} })
  calls.push({ cmd, argv, o, child })
  setImmediate(() => (fail ? child.emit('error', Object.assign(new Error('nope'), { code: 'ENOENT' })) : child.emit('spawn')))
  return child
}

test('runs the CLI in print mode, detached, with no shell, logging under data/runs', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'av-bg-'))
  const calls = []
  const r = await runInBackground({ exe: '/bin/claude', args: ['--resume', 'abc'], cwd: '/work/app', prompt: 'commit it' }, { dataDir: dir, platform: 'linux', spawn: fakeSpawn(calls) })
  assert.equal(r.ok, true)
  assert.deepEqual(calls[0].argv, ['-p', '--resume', 'abc', 'commit it'])
  assert.equal(calls[0].o.shell, false)
  assert.equal(calls[0].o.detached, true)
  assert.equal(path.dirname(r.log), path.join(dir, 'runs'))
  assert.ok(fs.existsSync(r.log))
})

test('a prompt that looks like an option is not one', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'av-bg-'))
  const calls = []
  await runInBackground({ exe: '/bin/claude', args: ['--resume', 'dash'], cwd: '/w', prompt: '--settings=x' }, { dataDir: dir, platform: 'linux', spawn: fakeSpawn(calls) })
  assert.equal(calls[0].argv.at(-1), ' --settings=x')
})

test('refuses relative paths and an empty prompt, and keeps only the latest logs', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'av-bg-'))
  const calls = []
  const o = { dataDir: dir, platform: 'linux', spawn: fakeSpawn(calls) }
  assert.equal((await runInBackground({ exe: 'claude', args: [], cwd: '/w', prompt: 'x' }, o)).ok, false)
  assert.equal((await runInBackground({ exe: '/bin/claude', args: [], cwd: 'w', prompt: 'x' }, o)).ok, false)
  assert.equal((await runInBackground({ exe: '/bin/claude', args: [], cwd: '/w', prompt: ' ' }, o)).ok, false)
  assert.equal(calls.length, 0)
  for (let i = 0; i < 30; i++) await runInBackground({ exe: '/bin/claude', args: ['--resume', `s${i}`], cwd: '/w', prompt: 'x' }, o)
  assert.ok(fs.readdirSync(path.join(dir, 'runs')).length <= 20)
})

test('a launch that fails is reported, not called a success', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'av-bg-'))
  const r = await runInBackground({ exe: '/gone/claude', args: ['--resume', 'e'], cwd: '/w', prompt: 'x' }, { dataDir: dir, platform: 'linux', spawn: fakeSpawn([], true) })
  assert.equal(r.ok, false)
  assert.match(r.error, /ENOENT/)
})

test('one conversation never has two background runs, until the first exits', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'av-bg-'))
  const calls = []
  const o = { dataDir: dir, platform: 'linux', spawn: fakeSpawn(calls) }
  const spec = { exe: '/bin/claude', args: ['--resume', 'same'], cwd: '/w', prompt: 'x' }
  assert.equal((await runInBackground(spec, o)).ok, true)
  assert.equal((await runInBackground(spec, o)).ok, false)
  assert.equal((await runInBackground({ ...spec, args: ['--resume', 'other'] }, o)).ok, true, 'another conversation is free')
  calls[0].child.emit('exit')
  assert.equal((await runInBackground(spec, o)).ok, true)
})

test('a Windows .cmd launcher is refused rather than run through a shell', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'av-bg-'))
  const calls = []
  const r = await runInBackground({ exe: 'C:\\npm\\claude.cmd', args: [], cwd: 'C:\\w', prompt: 'x' }, { dataDir: dir, platform: 'win32', spawn: fakeSpawn(calls) })
  assert.equal(r.ok, false)
  assert.equal(calls.length, 0)
})
