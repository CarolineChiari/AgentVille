// Claude Code run once with no window, for the foreman: its own look over the village, and a
// question put to one thread. Both go through the person's own `claude` CLI, the way the PR gardens
// go through their own `gh`, and neither leaves anything behind:
//   - `--no-session-persistence`: no transcript is written, so no villager walks in for it.
//   - asking a thread resumes it with `--fork-session`: the question goes to a copy, and the
//     thread's own transcript never gets a turn it didn't have.
//   - `--setting-sources user`: a repo's own .claude/settings.json is never read, so none of its
//     hooks run. The person's own settings still are: that is where an apiKeyHelper or a default
//     model lives, which signing in may need.
//   - `--strict-mcp-config` with no config: no MCP server starts, so nothing can reach out through one.
//   - only the tools named: none for the foreman, read-only ones for a thread checking its own work.

/**
 * Sonnet, not the person's default: the foreman reads summaries and a thread re-reads its own
 * conversation, both reading jobs, and a long Opus session re-read on Opus costs several times as much.
 */
export const FOREMAN_MODEL = 'sonnet'

// What a thread may use to check its own work: reading only. Bash could run anything at all.
export const ASK_TOOLS = ['Read', 'Grep', 'Glob']

/**
 * Most a single run may spend, in US dollars, as the CLI counts it. A thread being asked re-reads its
 * whole conversation, and a long one runs to hundreds of thousands of tokens; this keeps one
 * question from costing more than a round is worth. The foreman's own look is a few thousand tokens.
 */
export const JUDGE_BUDGET_USD = 1
export const ASK_BUDGET_USD = 1

/**
 * The CLI's arguments for one headless run. The prompt is not among them: it goes in on stdin, so
 * it is never read as an option however it starts.
 * @param {{ schema: object, tools?: string[], resume?: string, model?: string, budget?: number }} o
 */
export function headlessArgs({ schema, tools = [], resume = '', model = FOREMAN_MODEL, budget = JUDGE_BUDGET_USD }) {
  return [
    '-p',
    '--output-format', 'json',
    '--json-schema', JSON.stringify(schema),
    '--no-session-persistence',
    '--setting-sources', 'user',
    '--strict-mcp-config',
    '--tools', tools.join(','),
    '--model', model,
    '--max-budget-usd', String(budget),
    ...(resume ? ['--resume', resume, '--fork-session'] : []),
  ]
}

// What the CLI says when its own sign-in has lapsed; the desktop app signs in separately, so a
// person who only uses the app may never have signed the CLI in at all.
const SIGNED_OUT = /authenticat|log ?in|oauth|api key/i

/**
 * The answer out of what `claude -p --output-format json` printed: the object its `--json-schema`
 * asked for, or what went wrong in words a person can act on. A run that fails before it starts
 * (a thread the CLI can't find to resume) prints nothing but its reason, on stderr.
 * @param {string} stdout
 * @param {string} [stderr]
 * @returns {{ ok: true, value: object, costUsd: number } | { ok: false, error: string, costUsd: number }}
 */
export function readHeadless(stdout, stderr = '') {
  let r = null
  const text = String(stdout || '').trim()
  // One JSON object; but a warning printed first must not lose it, so the last line is tried too.
  for (const candidate of [text, text.split('\n').at(-1)]) {
    try {
      r = JSON.parse(candidate)
      break
    } catch {
      // Try the next.
    }
  }
  if (!r || typeof r !== 'object') {
    const said = String(stderr || '').trim().split('\n').at(-1).trim().slice(0, 300)
    return { ok: false, error: said || 'Claude Code’s answer could not be read.', costUsd: 0 }
  }
  const costUsd = Number.isFinite(r.total_cost_usd) ? r.total_cost_usd : 0
  const said = typeof r.result === 'string' ? r.result.trim() : ''
  if (r.is_error) {
    if (SIGNED_OUT.test(said)) return { ok: false, error: 'Claude Code’s CLI is signed out. Run `claude` once in a terminal and sign in, then send the foreman again.', costUsd }
    return { ok: false, error: said.slice(0, 300) || `Claude Code stopped (${String(r.subtype || 'error').slice(0, 40)}).`, costUsd }
  }
  if (r.structured_output && typeof r.structured_output === 'object') return { ok: true, value: r.structured_output, costUsd }
  // An older CLI puts the object in `result` as text, sometimes fenced.
  const body = said.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  try {
    const value = JSON.parse(body)
    if (value && typeof value === 'object') return { ok: true, value, costUsd }
  } catch {
    // Not JSON: fall through.
  }
  return { ok: false, error: 'Claude Code answered, but not in the shape asked for.', costUsd }
}
