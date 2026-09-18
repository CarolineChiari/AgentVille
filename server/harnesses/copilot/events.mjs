// Pure: reading the Copilot CLI's `~/.copilot/session-state/<id>/events.jsonl`. VS Code's
// background agents run the same CLI and write the same files. Every line is
// `{ type, data, id, timestamp, parentId }`, appended as it happens.
import { modelName } from './chatlog.mjs'

const TEXT_MAX = 8000
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s)
const str = (v) => (typeof v === 'string' ? v : '')
const at = (e) => Date.parse(e?.timestamp) || 0

// A session whose last event is one of these has finished its turn and is waiting for you.
const TURN_OVER = new Set(['assistant.turn_end', 'abort', 'session.start', 'session.resume'])

/**
 * What the head of the log says about where and how the session started.
 * @returns {{ cwd: string, gitRoot: string, branch: string, model: string, createdAt: number, firstPrompt: string }}
 */
export function eventsHeadMeta(events) {
  const out = { cwd: '', gitRoot: '', branch: '', model: '', createdAt: 0, firstPrompt: '' }
  for (const e of events) {
    const d = e?.data && typeof e.data === 'object' ? e.data : {}
    if (e.type === 'session.start') {
      const c = d.context && typeof d.context === 'object' ? d.context : {}
      out.cwd = str(c.cwd)
      out.gitRoot = str(c.gitRoot)
      out.branch = str(c.branch)
      out.model = modelName(d.selectedModel)
      out.createdAt = Date.parse(d.startTime) || at(e)
    } else if (e.type === 'user.message' && !out.firstPrompt) {
      out.firstPrompt = str(d.content).replace(/\s+/g, ' ').trim().slice(0, 300)
    }
    if (out.cwd && out.firstPrompt) break
  }
  return out
}

/**
 * Where the session stands, from the tail of its log.
 * @returns {{ turnOver: boolean, finished: boolean, at: number, branch: string } | null} null for an empty tail
 *          `finished`: the last turn ran to its end (not aborted), so there is something to review.
 */
export function eventsTail(events) {
  const last = events.at(-1)
  if (!last) return null
  let branch = ''
  for (const e of events) if (e?.type === 'session.resume' && typeof e.data?.context?.branch === 'string') branch = e.data.context.branch
  return {
    turnOver: TURN_OVER.has(last.type),
    finished: last.type === 'assistant.turn_end',
    at: at(last),
    branch,
  }
}

/** The conversation, in the transcript panel's shape. */
export function eventMessages(events) {
  const out = []
  for (const e of events) {
    const d = e?.data && typeof e.data === 'object' ? e.data : {}
    if (e.type === 'user.message') {
      const text = str(d.content).trim()
      if (text) out.push({ role: 'user', text: clip(text, TEXT_MAX), at: at(e) })
    } else if (e.type === 'assistant.message') {
      const text = str(d.content).trim()
      if (text) out.push({ role: 'assistant', text: clip(text, TEXT_MAX), at: at(e) })
    } else if (e.type === 'tool.execution_start') {
      const a = d.arguments && typeof d.arguments === 'object' ? d.arguments : {}
      const detail = str(a.command ?? a.path ?? a.pattern ?? a.url ?? a.query ?? a.intent ?? a.description)
      out.push({ role: 'tool', name: str(d.toolName) || 'tool', detail: clip(detail.replace(/\s+/g, ' ').trim(), 240), at: at(e) })
    }
  }
  return out
}

/**
 * The top-level `key: value` scalars of the CLI's `workspace.yaml` (`cwd`, `summary`, …). Not a
 * YAML parser: nested blocks and lists are ignored, which is all this file needs.
 */
export function yamlScalars(text) {
  const out = {}
  for (const line of String(text || '').split(/\r?\n/)) {
    const m = /^([A-Za-z_][\w-]*):\s*(.*?)\s*$/.exec(line)
    if (!m || !m[2] || m[2] === '|' || m[2] === '>') continue
    let v = m[2]
    if (/^'.*'$/.test(v)) v = v.slice(1, -1).replace(/''/g, "'")
    else if (/^".*"$/.test(v)) {
      try {
        v = JSON.parse(v)
      } catch {
        v = v.slice(1, -1)
      }
    }
    out[m[1]] = v
  }
  return out
}
