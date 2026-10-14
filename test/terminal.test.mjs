import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { commandScript, findLinuxTerminal, openInTerminal, promptArg, shq } from '../server/terminal.mjs'
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

test('a prompt that starts with a dash is never read as an option', async (t) => {
  assert.equal(promptArg('--settings={"hooks":{}}'), ' --settings={"hooks":{}}')
  assert.equal(promptArg('- fix the login bug'), ' - fix the login bug')
  assert.equal(promptArg('fix it - quickly'), 'fix it - quickly')
  const { home, cleanup } = tmpHome()
  t.after(cleanup)
  const spawn = () => ({ on() {}, unref() {} })
  await openInTerminal({ exe: '/bin/claude', args: [], cwd: home, prompt: '--mcp-config=x' }, { dataDir: home, platform: 'darwin', spawn })
  const promptFile = fs.readdirSync(path.join(home, 'launch')).find((f) => f.endsWith('.prompt.txt'))
  assert.equal(fs.readFileSync(path.join(home, 'launch', promptFile), 'utf8'), ' --mcp-config=x')
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

test('prompt flags go just before the prompt, and only when there is one', () => {
  const withPrompt = commandScript({ cwd: '/w', exe: '/bin/copilot', args: [], promptArgs: ['-i'], promptFile: '/d/p.txt', self: '/d/x.command' })
  assert.ok(withPrompt.includes(`exec '/bin/copilot' '-i' "$AGENTVILLE_PROMPT"`))
  const without = commandScript({ cwd: '/w', exe: '/bin/copilot', args: [], promptArgs: ['-i'], self: '/d/x.command' })
  assert.ok(without.includes(`exec '/bin/copilot'\n`), 'a bare -i would be an error')
})

test('on Linux a one-shot sh script runs in the first terminal found, with the prompt in its own file', async (t) => {
  const { home, cleanup } = tmpHome()
  t.after(cleanup)
  const calls = []
  const spawn = (cmd, args, opts) => (calls.push({ cmd, args, opts }), { on() {}, unref() {} })
  const find = async (name) => (name === 'gnome-terminal' ? '/usr/bin/gnome-terminal' : null)
  const prompt = 'Fix it; $(touch /tmp/pwned)'
  const r = await openInTerminal({ exe: '/bin/claude', args: ['--model', 'opus'], cwd: home, prompt }, { dataDir: home, platform: 'linux', spawn, env: {}, home, find })
  assert.deepEqual(r, { ok: true, promptPassed: true })
  assert.equal(calls[0].cmd, '/usr/bin/gnome-terminal')
  assert.equal(calls[0].opts.shell, false)
  assert.deepEqual(calls[0].args.slice(0, 2), ['--', '/bin/sh'])
  const script = fs.readFileSync(calls[0].args[2], 'utf8')
  assert.match(script, /^#!\/bin\/sh\n/)
  assert.ok(!script.includes('pwned'))
  const promptFile = fs.readdirSync(path.join(home, 'launch')).find((f) => f.endsWith('.prompt.txt'))
  assert.equal(fs.readFileSync(path.join(home, 'launch', promptFile), 'utf8'), prompt)
})

test('on Linux $TERMINAL wins, but only as one word', async () => {
  const find = async (name) => `/usr/bin/${name}`
  const home = '/home/me'
  assert.deepEqual(await findLinuxTerminal({ home, env: { TERMINAL: 'kitty' }, find }), { exe: '/usr/bin/kitty', flag: '-e' })
  assert.deepEqual(await findLinuxTerminal({ home, env: { TERMINAL: '/opt/t/alacritty' }, find }), { exe: '/opt/t/alacritty', flag: '-e' })
  assert.equal((await findLinuxTerminal({ home, env: { TERMINAL: 'kitty; rm -rf ~' }, find })).exe, '/usr/bin/x-terminal-emulator')
  assert.equal((await findLinuxTerminal({ home, env: {}, find })).exe, '/usr/bin/x-terminal-emulator')
})

test('on Linux with no terminal installed nothing is written or run', async (t) => {
  const { home, cleanup } = tmpHome()
  t.after(cleanup)
  const r = await openInTerminal({ exe: '/bin/claude', args: [], cwd: home }, { dataDir: home, platform: 'linux', spawn: () => assert.fail('spawned'), env: {}, home, find: async () => null })
  assert.equal(r.ok, false)
  assert.ok(!fs.existsSync(path.join(home, 'launch')))
})
