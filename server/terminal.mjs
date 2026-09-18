// Opening a terminal window running a command. Used to start a Claude Code session with a
// chosen model, which neither the VS Code nor the desktop-app link can carry.
//
// Nothing the person typed is ever interpreted by a shell. On macOS the command goes into a
// one-shot `.command` script under data/ (the only place AgentVille writes): every value in it
// is single-quoted, the prompt is not in it at all but in a sibling file read with `cat`, and the
// script deletes both files as its first act. On Windows the prompt is not passed (the page
// copies it to the clipboard instead), and paths that cmd.exe would treat specially are refused.
import { spawn as nodeSpawn } from 'node:child_process'
import crypto from 'node:crypto'
import fsp from 'node:fs/promises'
import path from 'node:path'

/** POSIX single-quoting: the only character that needs care inside '…' is ' itself. */
export const shq = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`

// cmd.exe expands or splits on these even inside quotes; a path containing one is refused.
const CMD_SPECIAL = /["%^&|<>!\r\n]/

/**
 * The text of the macOS launch script. Exported for tests: what matters is what it does not do.
 * @param {{ cwd: string, exe: string, args: string[], promptFile?: string, self: string }} o
 */
export function commandScript({ cwd, exe, args, promptFile, self }) {
  const lines = [
    '#!/bin/zsh -l',
    `rm -f -- ${shq(self)}`,
    `cd -- ${shq(cwd)} || exit 1`,
  ]
  const argv = [shq(exe), ...args.map(shq)].join(' ')
  if (promptFile) {
    lines.push(`AGENTVILLE_PROMPT="$(cat -- ${shq(promptFile)})"`, `rm -f -- ${shq(promptFile)}`)
    lines.push(`exec ${argv} "$AGENTVILLE_PROMPT"`)
  } else {
    lines.push(`exec ${argv}`)
  }
  return lines.join('\n') + '\n'
}

/**
 * @param {{ exe: string, args: string[], cwd: string, prompt?: string }} spec
 * @param {{ dataDir: string, platform?: string, spawn?: Function }} opts
 * @returns {Promise<{ ok: true, promptPassed: boolean } | { ok: false, error: string }>}
 */
export async function openInTerminal(spec, { dataDir, platform = process.platform, spawn = nodeSpawn }) {
  const { exe, args, cwd } = spec
  const prompt = typeof spec.prompt === 'string' ? spec.prompt : ''
  // Judge paths by the target platform's rules, so a Windows launch is checkable on a Mac.
  const P = platform === 'win32' ? path.win32 : path.posix
  if (!P.isAbsolute(exe) || !P.isAbsolute(cwd)) return { ok: false, error: 'Needs absolute paths.' }
  const run = (cmd, argv, extra = {}) => {
    const child = spawn(cmd, argv, { shell: false, detached: true, stdio: 'ignore', ...extra })
    child.on?.('error', () => {})
    child.unref?.()
  }

  if (platform === 'darwin') {
    const dir = path.join(dataDir, 'launch')
    await fsp.mkdir(dir, { recursive: true })
    const id = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`
    const self = path.join(dir, `${id}.command`)
    const promptFile = prompt ? path.join(dir, `${id}.prompt.txt`) : undefined
    if (promptFile) await fsp.writeFile(promptFile, prompt, { mode: 0o600 })
    await fsp.writeFile(self, commandScript({ cwd, exe, args, promptFile, self }), { mode: 0o700 })
    // `open` hands a .command file to whatever terminal the person uses for them (Terminal by default).
    run('open', [self])
    return { ok: true, promptPassed: Boolean(prompt) }
  }

  if (platform === 'win32') {
    if (CMD_SPECIAL.test(cwd) || CMD_SPECIAL.test(exe) || args.some((a) => CMD_SPECIAL.test(a))) {
      return { ok: false, error: 'That folder name has characters a Windows terminal would misread.' }
    }
    // `start` opens a new console window; the empty "" is its title argument, not the program.
    const line = ['/c', 'start', '""', '/D', `"${cwd}"`, `"${exe}"`, ...args.map((a) => `"${a}"`)].join(' ')
    run(process.env.ComSpec || 'cmd.exe', [line], { windowsVerbatimArguments: true, windowsHide: false })
    return { ok: true, promptPassed: false }
  }

  return { ok: false, error: `Opening a terminal isn't supported on ${platform} yet.` }
}
