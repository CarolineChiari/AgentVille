// Pure: reading the Codex CLI's rollout logs, `$CODEX_HOME/sessions/YYYY/MM/DD/rollout-<ts>-<id>.jsonl`.
// Today every line is `{ timestamp, type, payload }`: one `session_meta` first (id, cwd, git), a
// `turn_context` per turn (model, effort), the model's `response_item`s (messages, reasoning, tool
// calls and their output) and `event_msg`s (what the person typed, what the agent said, a turn
// aborted). The earliest releases wrote a bare `{ id, timestamp, instructions }` first and the
// response items unwrapped after it, with no cwd anywhere; both are read, the old ones only as far
// as they go.

const TEXT_MAX = 8000
const THINK_MAX = 4000
const CODE_MAX = 2000
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s)
const str = (v) => (typeof v === 'string' ? v : '')
const isObj = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v)
const at = (r) => Date.parse(r?.timestamp) || 0
const oneLine = (s) => s.replace(/\s+/g, ' ').trim()

// What the unwrapped, earliest rollouts held on a line of their own.
const ITEM_TYPES = new Set(['message', 'reasoning', 'function_call', 'function_call_output', 'custom_tool_call', 'custom_tool_call_output', 'local_shell_call', 'web_search_call'])
const CALLS = new Set(['function_call', 'custom_tool_call', 'local_shell_call', 'web_search_call'])

/**
 * The text Codex itself puts in a user message before the person's first word: the AGENTS.md it
 * read, the cwd and sandbox, a note that a turn was cut off. None of it is anything they asked.
 */
const INJECTED = /^\s*(<(environment_context|user_instructions|turn_aborted|user_shell_command|INSTRUCTIONS)>|# AGENTS\.md instructions)/

/** A response item, whichever way the line wrapped it; null for anything else. */
export function itemOf(r) {
  if (!isObj(r)) return null
  if (r.type === 'response_item') return isObj(r.payload) ? r.payload : null
  return ITEM_TYPES.has(r.type) && !('payload' in r) ? r : null
}

/** An event's payload, `{ type, … }`; null for anything else. */
export const eventOf = (r) => (isObj(r) && r.type === 'event_msg' && isObj(r.payload) ? r.payload : null)

/** The text of a message item: its `input_text` or `output_text` parts, joined. */
function messageText(item) {
  const c = item?.content
  if (typeof c === 'string') return c
  if (!Array.isArray(c)) return ''
  return c.map((p) => (isObj(p) && (p.type === 'input_text' || p.type === 'output_text' || p.type === 'text') ? str(p.text) : '')).filter(Boolean).join('\n')
}

/** What the person typed in a user message item, or '' for one Codex wrote itself. */
function personText(item) {
  const text = messageText(item).trim()
  return text && !INJECTED.test(text) ? text : ''
}

/**
 * What the head of a rollout says about where and how the session started.
 * @returns {{ id: string, cwd: string, branch: string, model: string, effort: string, source: string, createdAt: number, firstPrompt: string }}
 */
export function rolloutHead(records) {
  const out = { id: '', cwd: '', branch: '', model: '', effort: '', source: '', createdAt: 0, firstPrompt: '' }
  for (const r of records) {
    if (!isObj(r)) continue
    if (r.type === 'session_meta' && isObj(r.payload)) {
      const p = r.payload
      out.id ||= str(p.id)
      out.cwd ||= str(p.cwd)
      out.branch ||= str(p.git?.branch)
      // `source` says cli, vscode, exec or mcp; the oldest metas only had an `originator`.
      out.source ||= str(p.source) || str(p.originator)
      out.createdAt ||= Date.parse(p.timestamp) || at(r)
    } else if (!r.type && typeof r.id === 'string' && !out.id) {
      out.id = r.id
      out.createdAt ||= Date.parse(r.timestamp) || 0
    } else if (r.type === 'turn_context' && isObj(r.payload)) {
      out.cwd ||= str(r.payload.cwd)
      out.model ||= str(r.payload.model)
      out.effort ||= str(r.payload.effort)
    }
    // The first thing the person said, whichever way the line holds it: newer rollouts say it as a
    // message item and again as an event straight after, and older ones only as the item.
    if (!out.firstPrompt) out.firstPrompt = oneLine(userText(r)).slice(0, 300)
  }
  return out
}

/** What the person said on this line, as a user message item or a `user_message` event; '' else. */
function userText(r) {
  const ev = eventOf(r)
  if (ev?.type === 'user_message') {
    const text = str(ev.message).trim()
    return text && !INJECTED.test(text) ? text : ''
  }
  const item = itemOf(r)
  return item?.type === 'message' && item.role === 'user' ? personText(item) : ''
}

// The events that open and close a turn. Codex renamed tasks to turns; older rollouts say task.
const TURN_START = new Set(['task_started', 'turn_started'])
const TURN_END = new Set(['task_complete', 'turn_complete'])

/**
 * Whether an assistant message ends its turn. Newer Codex says so in `phase`: commentary and a
 * partial answer are on the way to more work. Without it, the last message is taken for the answer,
 * and a message followed by more tool calls turns out to have been only a preamble.
 */
const answers = (m) => m.phase !== 'commentary' && m.phase !== 'partial_answer'

/**
 * Where the session stands, from the tail of its rollout. A turn is under way from the person's
 * message until the agent answers, the turn completes or it is aborted.
 *
 * There is no error here, nor anything asking for approval: Codex counts both as transient and never
 * writes them to a rollout, so a turn that stopped on one looks like one cut off, and a pending
 * approval like a long command.
 * @returns {{ inTurn: boolean, finished: boolean, at: number, model: string } | null} null for an empty tail
 *          `finished`: the last turn ended with an answer (not aborted), so there is something to review.
 */
export function rolloutTail(records) {
  let seen = false
  let inTurn = false
  let finished = false
  let last = 0
  let model = ''
  const set = (working, done) => {
    inTurn = working
    finished = done
  }
  for (const r of records) {
    if (!isObj(r)) continue
    seen = true
    last = Math.max(last, at(r))
    if (r.type === 'turn_context' && isObj(r.payload)) model = str(r.payload.model) || model
    const ev = eventOf(r)
    if (ev) {
      if (TURN_START.has(ev.type) || (ev.type === 'user_message' && userText(r))) set(true, false)
      else if (TURN_END.has(ev.type)) set(false, true)
      else if (ev.type === 'agent_message') set(!answers(ev), answers(ev))
      else if (ev.type === 'turn_aborted') set(false, false)
      continue
    }
    const item = itemOf(r)
    if (!item) continue
    if (item.type === 'message' && item.role === 'user') {
      if (personText(item)) set(true, false)
    } else if (item.type === 'message' && item.role === 'assistant') set(!answers(item), answers(item))
    else if (CALLS.has(item.type) || item.type === 'function_call_output' || item.type === 'custom_tool_call_output' || item.type === 'reasoning') set(true, false)
  }
  if (!seen) return null
  return { inTurn, finished, at: last, model }
}

/** A command as it was run: `["bash", "-lc", "npm test"]` is `npm test`. */
function commandText(cmd) {
  if (typeof cmd === 'string') return cmd.trim()
  if (!Array.isArray(cmd) || !cmd.every((c) => typeof c === 'string')) return ''
  const shell = /(^|[\\/])(ba|z|da)?sh(\.exe)?$|(^|[\\/])(pwsh|powershell)(\.exe)?$/i
  if (cmd.length === 3 && shell.test(cmd[0]) && /^(-l?c|-Command)$/i.test(cmd[1])) return cmd[2].trim()
  return cmd.join(' ').trim()
}

function parseArgs(s) {
  if (isObj(s)) return s
  try {
    const v = JSON.parse(str(s))
    return isObj(v) ? v : {}
  } catch {
    return {}
  }
}

/** A tool call as one line of the transcript: `{ name, detail, code? }`. */
export function summarizeCall(item) {
  if (item.type === 'local_shell_call') {
    const command = commandText(item.action?.command)
    return { name: 'shell', detail: clip(oneLine(command), 240), ...(command ? { code: clip(command, CODE_MAX) } : {}) }
  }
  if (item.type === 'web_search_call') return { name: 'web search', detail: clip(oneLine(str(item.action?.query)), 240) }
  const name = str(item.name) || 'tool'
  if (item.type === 'custom_tool_call') {
    const input = str(item.input)
    // A patch is named by the files it touches; its body is the edit, too long for one line.
    const files = [...input.matchAll(/^\*\*\* (?:Add|Update|Delete) File: (.+)$/gm)].map((m) => m[1].trim().split(/[\\/]/).pop())
    return { name, detail: clip(files.length ? files.join(', ') : oneLine(input), 240) }
  }
  const a = parseArgs(item.arguments)
  const command = commandText(a.command ?? a.cmd)
  if (command) return { name, detail: clip(oneLine(command), 240), code: clip(command, CODE_MAX) }
  const detail = str(a.path ?? a.file_path ?? a.pattern ?? a.query ?? a.url ?? a.plan?.[0]?.step ?? a.explanation) || (typeof item.arguments === 'string' ? item.arguments : '')
  return { name, detail: clip(oneLine(detail), 240) }
}

/**
 * The conversation, in the transcript panel's shape: what you asked, what Codex thought, what it
 * said, and a line per tool call. Many rollouts say a message twice, as a response item and as an
 * event beside it; each pair is shown once, and a message said only one way is still shown.
 * A folded line's key is its line number: a rollout only ever grows at the end.
 * @returns {{ role: 'user'|'thinking'|'assistant'|'tool', text?: string, key?: string, name?: string, detail?: string, code?: string, at: number }[]}
 */
export function rolloutMessages(records) {
  const out = []
  const from = [] // beside `out`: 'item' or 'event', and whether its twin has been seen
  /**
   * The other half of a pair: the same words, said the other way, in the same turn and not yet
   * matched. Reasoning is the exception: one summary item, but an event per part of it, so the
   * events are joined into one thought and an item's summary takes in every part it contains.
   */
  const twin = (role, text, kind) => {
    for (let i = out.length - 1; i >= 0; i--) {
      const m = out[i]
      if (m.role === role && from[i].kind !== kind) {
        if (!from[i].paired && m.text === text) return i
        if (role === 'thinking' && (kind === 'event' ? m.text.includes(text) : !from[i].paired && text.includes(m.text))) return i
      }
      if (m.role === 'user') break // a turn's twins never cross into the turn before
    }
    return -1
  }
  const say = (role, text, kind, extra) => {
    const max = role === 'thinking' ? THINK_MAX : TEXT_MAX
    const t = clip(text, max)
    const i = twin(role, t, kind)
    if (i >= 0) {
      from[i].paired = true
      // A whole summary is worth more than the parts of it said so far.
      if (t.length > out[i].text.length) out[i].text = t
      return
    }
    const prev = out.length - 1
    if (role === 'thinking' && kind === 'event' && out[prev]?.role === 'thinking' && from[prev].kind === 'event' && !from[prev].paired) {
      out[prev].text = clip(`${out[prev].text}\n\n${t}`, max)
      return
    }
    out.push({ role, text: t, ...extra })
    from.push({ kind, paired: false })
  }
  for (const [n, r] of records.entries()) {
    const t = at(r)
    const ev = eventOf(r)
    if (ev) {
      const text = str(ev.type === 'agent_reasoning' ? ev.text : ev.message).trim()
      if (!text) continue
      if (ev.type === 'user_message' && !INJECTED.test(text)) say('user', text, 'event', { at: t })
      else if (ev.type === 'agent_message') say('assistant', text, 'event', { at: t })
      else if (ev.type === 'agent_reasoning') say('thinking', text, 'event', { key: String(n), at: t })
      continue
    }
    const item = itemOf(r)
    if (!item) continue
    if (item.type === 'message' && item.role === 'user') {
      const text = personText(item)
      if (text) say('user', text, 'item', { at: t })
    } else if (item.type === 'message' && item.role === 'assistant') {
      const text = messageText(item).trim()
      if (text) say('assistant', text, 'item', { at: t })
    } else if (item.type === 'reasoning') {
      // Only the summary is readable; the reasoning itself is sent back encrypted.
      const text = (Array.isArray(item.summary) ? item.summary : []).map((s) => str(s?.text)).filter(Boolean).join('\n\n').trim()
      if (text) say('thinking', text, 'item', { key: String(n), at: t })
    } else if (CALLS.has(item.type)) {
      out.push({ role: 'tool', ...summarizeCall(item), key: String(n), at: t })
      from.push({ kind: 'item', paired: true })
    }
  }
  return out
}
