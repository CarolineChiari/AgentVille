// Pure: what can be learned from the records of a Claude Code transcript.

const TAG_BLOCK_RE = /<([a-zA-Z][\w-]*)\b[^>]*>[\s\S]*?<\/\1>/g
const PREVIEW_MAX = 200

/**
 * A prompt fit to show as a title. Harness-injected wrappers (`<system-reminder>`,
 * `<ide_selection>`, `<command-name>` …) are stripped; a prompt that was nothing but
 * wrappers, or that starts with an unclosed tag, yields '' so the caller looks elsewhere.
 */
export function cleanPrompt(text) {
  let s = String(text ?? '').replace(TAG_BLOCK_RE, ' ').replace(/\s+/g, ' ').trim()
  if (!s || s.startsWith('<')) return ''
  if (s.length > PREVIEW_MAX) s = s.slice(0, PREVIEW_MAX - 1) + '…'
  return s
}

/** The text of a message's content, whether it is a string or an array of blocks. */
export function textOf(content) {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .filter((b) => b && b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text)
    .join('\n')
}

const isMain = (r) => r && !r.isSidechain

/**
 * Walk the head of a transcript once and collect everything the village shows: a title if the
 * user or the CLI set one, the opening prompt otherwise, and where the thread was working.
 */
export function readTranscriptMeta(records) {
  const meta = {
    customTitle: '',
    summary: '',
    firstPrompt: '',
    cwd: '',
    gitBranch: '',
    startedAt: 0,
    model: '',
    prState: '',
  }
  for (const r of records) {
    if (!r || typeof r !== 'object') continue
    if (r.type === 'custom-title' && !meta.customTitle && typeof r.customTitle === 'string') {
      meta.customTitle = r.customTitle.trim()
    } else if (r.type === 'summary' && !meta.summary && typeof r.summary === 'string') {
      meta.summary = r.summary.trim()
    } else if (r.type === 'pr-link' && !meta.prState) {
      meta.prState = 'OPEN'
    }
    if (!isMain(r)) continue
    if (!meta.cwd && typeof r.cwd === 'string' && r.cwd) meta.cwd = r.cwd
    if (!meta.gitBranch && typeof r.gitBranch === 'string' && r.gitBranch && r.gitBranch !== 'HEAD') {
      meta.gitBranch = r.gitBranch
    }
    if (!meta.startedAt && r.timestamp) {
      const t = Date.parse(r.timestamp)
      if (Number.isFinite(t)) meta.startedAt = t
    }
    if (r.type === 'user' && !meta.firstPrompt) {
      meta.firstPrompt = cleanPrompt(textOf(r.message?.content))
    } else if (r.type === 'assistant' && !meta.model && typeof r.message?.model === 'string') {
      meta.model = r.message.model
    }
  }
  return meta
}

/**
 * Is the model done and waiting for the user? Read the tail backwards: a user record (which
 * includes tool results) means the model speaks next; the last assistant record means waiting
 * only if it neither asked for a tool nor stopped to use one.
 */
export function awaitingReply(records) {
  for (let i = records.length - 1; i >= 0; i--) {
    const r = records[i]
    if (!isMain(r)) continue
    if (r.type === 'user') return false
    if (r.type === 'assistant') {
      const content = r.message?.content
      const usesTool = Array.isArray(content) && content.some((b) => b && b.type === 'tool_use')
      return !usesTool && r.message?.stop_reason !== 'tool_use'
    }
  }
  return false
}
