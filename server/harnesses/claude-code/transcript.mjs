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
    prNumber: 0,
    prUrl: '',
  }
  for (const r of records) {
    if (!r || typeof r !== 'object') continue
    if (r.type === 'custom-title' && !meta.customTitle && typeof r.customTitle === 'string') {
      meta.customTitle = r.customTitle.trim()
    } else if (r.type === 'summary' && !meta.summary && typeof r.summary === 'string') {
      meta.summary = r.summary.trim()
    } else if (r.type === 'pr-link') {
      // The last PR a thread linked is the one it is about.
      if (!meta.prState) meta.prState = 'OPEN'
      if (Number.isInteger(r.prNumber)) meta.prNumber = r.prNumber
      if (typeof r.prUrl === 'string' && /^https:\/\/github\.com\//.test(r.prUrl)) meta.prUrl = r.prUrl
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

/** Tools that stop and wait for the person: a question dialog, or a plan waiting for approval. */
export const ASKING_TOOLS = new Set(['AskUserQuestion', 'ExitPlanMode'])

/**
 * Is the model stopped on a question to the person? The last main-thread record is an assistant
 * turn calling a tool that waits for them, with no answer after it.
 */
export function pendingQuestion(records) {
  for (let i = records.length - 1; i >= 0; i--) {
    const r = records[i]
    if (!isMain(r)) continue
    if (r.type === 'user') return false
    if (r.type === 'assistant') {
      const content = r.message?.content
      return Array.isArray(content) && content.some((b) => b?.type === 'tool_use' && ASKING_TOOLS.has(b.name))
    }
  }
  return false
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

// ---------- the conversation, for the transcript panel ----------

const HIDDEN_BLOCK_RE = /<(system-reminder|ide_selection|ide_opened_file|local-command-caveat|local-command-stdout|command-message|command-args)\b[^>]*>[\s\S]*?<\/\1>/g
const COMMAND_RE = /<command-name>\s*([^<]+?)\s*<\/command-name>/
const TEXT_MAX = 8000

/** A user message as the person typed it: harness wrappers removed, a slash command shown as itself. */
export function readableUserText(text) {
  const s = String(text ?? '')
  const cmd = COMMAND_RE.exec(s)
  const rest = s.replace(HIDDEN_BLOCK_RE, '').replace(/<command-name>[\s\S]*?<\/command-name>/g, '').trim()
  return [cmd ? cmd[1] : '', rest].filter(Boolean).join(' ').trim()
}

const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s)

/** One line saying what a tool call did: the command it ran, the file it touched, what it searched. */
export function summarizeTool(block) {
  const i = block?.input && typeof block.input === 'object' ? block.input : {}
  const detail = i.command ?? i.file_path ?? i.notebook_path ?? i.pattern ?? i.url ?? i.query ?? i.description ?? i.skill ?? i.prompt ?? i.action ?? i.text ?? ''
  // `mcp__Claude_Browser__computer` reads better as `Claude Browser · computer`.
  const raw = String(block?.name || 'tool')
  const mcp = /^mcp__(.+?)__(.+)$/.exec(raw)
  const name = mcp ? `${mcp[1].replace(/_/g, ' ')} · ${mcp[2]}` : raw
  return { name, detail: clip(String(detail).replace(/\s+/g, ' ').trim(), 240) }
}

/**
 * The main conversation as a list of messages: what the person said, what Claude said, and a
 * line for each tool call. Subagent (sidechain) turns and tool results are left out; they are the
 * machinery, not the conversation.
 * @returns {{ role: 'user'|'assistant'|'tool', text?: string, name?: string, detail?: string, at: number }[]}
 */
export function transcriptMessages(records) {
  const out = []
  for (const r of records) {
    if (!isMain(r) || r.isMeta) continue
    const at = Date.parse(r.timestamp) || 0
    if (r.type === 'user') {
      const content = r.message?.content
      if (Array.isArray(content) && content.length && content.every((b) => b?.type === 'tool_result')) continue
      const text = readableUserText(textOf(content))
      if (text) out.push({ role: 'user', text: clip(text, TEXT_MAX), at })
    } else if (r.type === 'assistant') {
      const content = Array.isArray(r.message?.content) ? r.message.content : []
      for (const b of content) {
        if (b?.type === 'text' && b.text?.trim()) {
          const prev = out.at(-1)
          // The CLI writes one record per content block; stitch a reply's text back together.
          if (prev?.role === 'assistant' && prev.msgId && prev.msgId === r.message?.id) prev.text = clip(`${prev.text}\n\n${b.text.trim()}`, TEXT_MAX)
          else out.push({ role: 'assistant', text: clip(b.text.trim(), TEXT_MAX), at, msgId: r.message?.id })
        } else if (b?.type === 'tool_use') {
          out.push({ role: 'tool', ...summarizeTool(b), at })
        }
      }
    }
  }
  for (const m of out) delete m.msgId
  return out
}
