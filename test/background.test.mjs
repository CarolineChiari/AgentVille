import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { runInBackground } from '../server/background.mjs'

const fakeSpawn = (calls) => (cmd, argv, o) => (calls.push({ cmd, argv, o }), { on() {}, unref() {} })

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
  await runInBackground({ exe: '/bin/claude', args: [], cwd: '/w', prompt: '--settings=x' }, { dataDir: dir, platform: 'linux', spawn: fakeSpawn(calls) })
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
  for (let i = 0; i < 30; i++) await runInBackground({ exe: '/bin/claude', args: [], cwd: '/w', prompt: 'x' }, o)
  assert.ok(fs.readdirSync(path.join(dir, 'runs')).length <= 20)
})
