// Pure: reading VS Code's Copilot chat sessions, `workspaceStorage/<hash>/chatSessions/<id>.jsonl`.
//
// The file is an operation log, not a list of messages. Line one is `{kind: 0, v: <session>}`, a
// snapshot; every later line changes it at the path `k`:
//   kind 1  set `k` to `v`
//   kind 2  append the items of `v` to the array at `k`, after first cutting it to length `i`
//           when `i` is given (`{kind: 2, k: ['pendingRequests'], i: 0}` empties the queue)
//   kind 3  delete `k`
// Before VS Code 1.109 the same session object was written whole as `<id>.json`.

/** A request's `modelState.value`. The same numbers VS Code uses; 4 is new in 2026. */
export const STATE = { PENDING: 0, COMPLETE: 1, CANCELLED: 2, FAILED: 3, NEEDS_INPUT: 4 }

// Response parts that mean "stopped on a question for you", as opposed to a permission prompt.
const QUESTION_PARTS = new Set(['questionCarousel', 'elicitationSerialized'])
const TEXT_MAX = 8000

const isObj = (v) => v !== null && typeof v === 'object'
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s)
const finite = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

/** `copilot/claude-sonnet-4.5` → `claude-sonnet-4.5`. The prefix names the provider, not the model. */
export const modelName = (id) => (typeof id === 'string' ? id.replace(/^copilot\//, '').slice(0, 80) : '')

/**
 * Replay an operation log into the session it describes. Tolerant: an op whose path does not
 * exist yet creates it, and one that makes no sense (a push onto a string) is skipped.
 * @param {object[]} records parsed lines
 * @returns {object|null}
 */
export function foldChatLog(records) {
  let root = null
  for (const r of records) {
    if (!isObj(r)) continue
    if (r.kind === 0) {
      root = isObj(r.v) ? structuredClone(r.v) : null
      continue
    }
    if (!root || !Array.isArray(r.k) || !r.k.length) continue
    const keys = r.k
    let parent = root
    for (let j = 0; j < keys.length - 1 && isObj(parent); j++) {
      if (!isObj(parent[keys[j]])) parent[keys[j]] = typeof keys[j + 1] === 'number' ? [] : {}
      parent = parent[keys[j]]
    }
    if (!isObj(parent)) continue
    const last = keys[keys.length - 1]
    if (r.kind === 1) parent[last] = r.v
    else if (r.kind === 3) delete parent[last]
    else if (r.kind === 2) {
      if (!Array.isArray(parent[last])) parent[last] = []
      const arr = parent[last]
      if (Number.isInteger(r.i) && r.i >= 0) arr.length = Math.min(arr.length, r.i)
      if (Array.isArray(r.v)) arr.push(...r.v)
    }
  }
  return root
}

/**
 * Where the newest request stands, from whatever part of the log is at hand (usually its tail).
 * Requests are addressed by index, so the highest index seen is the newest; a push onto
 * `requests` with no `i` is the next one after everything seen so far.
 * @returns {{ index: number, state: number|null, at: number, asking: boolean, model: string, title: string } | null}
 *          `state` null means the tail never said; `asking` means the newest response holds a question.
 */
export function lastTurn(records) {
  let index = -1
  let state = null
  let at = 0
  let asking = false
  let model = ''
  let title = ''
  const adopt = (req, i) => {
    index = i
    state = isObj(req?.modelState) && Number.isInteger(req.modelState.value) ? req.modelState.value : isObj(req) ? STATE.PENDING : null
    at = Math.max(finite(req?.timestamp), finite(req?.modelState?.completedAt))
    asking = Array.isArray(req?.response) && req.response.some((p) => QUESTION_PARTS.has(p?.kind))
    if (req?.modelId) model = modelName(req.modelId)
  }
  const adoptAll = (requests) => {
    if (Array.isArray(requests) && requests.length) adopt(requests[requests.length - 1], requests.length - 1)
  }
  for (const r of records) {
    if (!isObj(r)) continue
    if (r.kind === 0 && isObj(r.v)) {
      adoptAll(r.v.requests)
      if (typeof r.v.customTitle === 'string') title = r.v.customTitle
      continue
    }
    if (!Array.isArray(r.k)) continue
    const [head, n, field] = r.k
    if (head === 'customTitle' && r.kind === 1 && typeof r.v === 'string') title = r.v
    if (head !== 'requests') continue
    if (r.k.length === 1) {
      if (r.kind === 1) adoptAll(r.v)
      else if (r.kind === 2 && Array.isArray(r.v) && r.v.length) {
        const first = Number.isInteger(r.i) ? r.i : index + 1
        adopt(r.v[r.v.length - 1], first + r.v.length - 1)
      }
      continue
    }
    if (!Number.isInteger(n) || n < index) continue
    if (n > index) {
      // First news of a request whose push was before the tail began.
      index = n
      state = null
      asking = false
    }
    if (field === 'modelState' && r.kind === 1 && isObj(r.v) && Number.isInteger(r.v.value)) {
      state = r.v.value
      at = Math.max(at, finite(r.v.completedAt))
    } else if (field === 'response' && r.kind === 2 && Array.isArray(r.v)) {
      if (r.v.some((p) => QUESTION_PARTS.has(p?.kind))) asking = true
    } else if (field === 'modelId' && r.kind === 1) {
      model = modelName(r.v)
    }
  }
  return index < 0 ? null : { index, state, at, asking, model, title }
}

// The first thing the person asked, found in the raw head of the file. The first line can be a
// snapshot megabytes long, cut off by the head read and so unparsable; the first request's text
// is near its start, and a JSON string literal is easy to pick out on its own.
const FIRST_TEXT_RE = /"message":\s*\{\s*"text":\s*("(?:[^"\\]|\\.)*")/
const CREATED_RE = /"creationDate":\s*(\d{10,})/
const MODEL_RE = /"modelId":\s*"([^"\\]{1,120})"/

/** @returns {{ firstPrompt: string, createdAt: number, model: string }} */
export function headMeta(text) {
  const s = String(text || '')
  let firstPrompt = ''
  const m = FIRST_TEXT_RE.exec(s)
  if (m) {
    try {
      firstPrompt = JSON.parse(m[1]).replace(/\s+/g, ' ').trim().slice(0, 300)
    } catch {
      // A literal cut off mid-escape.
    }
  }
  const c = CREATED_RE.exec(s)
  return { firstPrompt, createdAt: c ? Number(c[1]) : 0, model: modelName(MODEL_RE.exec(s)?.[1]) }
}

/** Text of a markdown-ish value: VS Code writes both `"text"` and `{ value: "text" }`. */
function textOf(v) {
  if (typeof v === 'string') return v
  if (isObj(v) && typeof v.value === 'string') return v.value
  return ''
}

/** `file:///a/b/thing.js` → `thing.js`, for inline file references. */
function refName(ref) {
  const r = isObj(ref) ? ref : {}
  const p = r.name || r.path || r.uri?.path || r.location?.uri?.path || r.fsPath || ''
  return String(p).split(/[\\/]/).pop()
}

/**
 * The conversation, in the transcript panel's shape: what you asked, what Copilot said, and a
 * line per tool call. Thinking, edit groups and progress are the machinery, not the conversation.
 * @returns {{ role: 'user'|'assistant'|'tool', text?: string, name?: string, detail?: string, at: number }[]}
 */
export function chatMessages(session) {
  const out = []
  const requests = Array.isArray(session?.requests) ? session.requests : []
  for (const req of requests) {
    if (!isObj(req)) continue
    const at = finite(req.timestamp)
    const asked = textOf(req.message?.text ?? req.message).trim()
    if (asked) out.push({ role: 'user', text: clip(asked, TEXT_MAX), at })
    let buf = ''
    const flush = () => {
      if (buf.trim()) out.push({ role: 'assistant', text: clip(buf.trim(), TEXT_MAX), at: finite(req.modelState?.completedAt) || at })
      buf = ''
    }
    for (const p of Array.isArray(req.response) ? req.response : []) {
      if (!isObj(p)) continue
      if (!p.kind || p.kind === 'markdownContent') buf += textOf(p.kind ? p.content : p)
      else if (p.kind === 'inlineReference') buf += `\`${refName(p.inlineReference)}\``
      else if (p.kind === 'toolInvocationSerialized' || p.kind === 'toolInvocation') {
        flush()
        const detail = textOf(p.pastTenseMessage) || textOf(p.invocationMessage)
        out.push({ role: 'tool', name: String(p.toolId || 'tool').replace(/^copilot_/, ''), detail: clip(detail.replace(/\s+/g, ' ').trim(), 240), at })
      }
    }
    flush()
  }
  return out
}
