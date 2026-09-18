import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { commandScript, openInTerminal, shq } from '../server/terminal.mjs'
import { tmpHome } from './helpers/fixtures.mjs'

test('single-quoting survives quotes, dollars and backticks', () => {
  assert.equal(shq(`it's $(rm) \`x\``), `'it'\\''s $(rm) \`x\`'`)
})

test('the launch script quotes every value and never contains the prompt', () => {
  const script = commandScript({ cwd: "/work/o'neil app", exe: '/bin/claude', args: ['--model', 'opus'], promptFile: '/d/p.txt', self: '/d/x.command' })
  assert.match(script, /^#!\/bin\/zsh -l\n/)
  assert.ok(script.includes(`cd -- '/work/o'\\''neil app' || exit 1`))
  assert.ok(script.includes(`exec '/bin/claude' '--model' 'opus' "$AGENTVILLE_PROMPT"`))
  assert.ok(script.indexOf("rm -f -- '/d/x.command'") < script.indexOf('exec'), 'deletes itself first')
})

test('on macOS the prompt goes to its own file and `open` gets the script', async (t) => {
  const { home, cleanup } = tmpHome()
  t.after(cleanup)
  const calls = []
  const spawn = (cmd, args, opts) => (calls.push({ cmd, args, opts }), { on() {}, unref() {} })
  const prompt = `Fix "it"; $(touch /tmp/pwned) && echo \`id\``
  const r = await openInTerminal({ exe: '/bin/claude', args: [], cwd: home, prompt }, { dataDir: home, platform: 'darwin', spawn })
  assert.deepEqual(r, { ok: true, promptPassed: true })
  assert.equal(calls[0].cmd, 'open')
  assert.equal(calls[0].opts.shell, false)
  const files = fs.readdirSync(path.join(home, 'launch'))
  const script = fs.readFileSync(path.join(home, 'launch', files.find((f) => f.endsWith('.command'))), 'utf8')
  const promptFile = files.find((f) => f.endsWith('.prompt.txt'))
  assert.equal(fs.readFileSync(path.join(home, 'launch', promptFile), 'utf8'), prompt)
  assert.ok(!script.includes('pwned'), 'the prompt never appears in the script')
})

test('on Windows cmd-special paths are refused and the prompt is left to the clipboard', async () => {
  const calls = []
  const spawn = (cmd, args, opts) => (calls.push({ cmd, args, opts }), { on() {}, unref() {} })
  const bad = await openInTerminal({ exe: 'C:\\bin\\claude.exe', args: [], cwd: 'C:\\work\\a&b' }, { dataDir: '/tmp', platform: 'win32', spawn })
  assert.equal(bad.ok, false)
  assert.equal(calls.length, 0)
  const ok = await openInTerminal({ exe: 'C:\\bin\\claude.exe', args: ['--model', 'sonnet'], cwd: 'C:\\work\\app', prompt: 'hi' }, { dataDir: '/tmp', platform: 'win32', spawn })
  assert.deepEqual(ok, { ok: true, promptPassed: false })
  assert.equal(calls[0].args[0], '/c start "" /D "C:\\work\\app" "C:\\bin\\claude.exe" "--model" "sonnet"')
})
