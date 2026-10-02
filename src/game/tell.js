// Tell another agent: a message the person writes on one villager's card and sends into another
// villager's conversation. Pure, so the card, the sheet and the tests read the same rules.
//
// Only Claude Code for now: it is the one harness that resumes a conversation with a prompt. A
// tell never falls back to a new session the way a task does: a message meant for one agent
// that lands in a stranger's fresh session has reached nobody.

export const TELL_HARNESSES = new Set(['claude-code'])
// Room for a real note without dwarfing what it sits beside. The CLI takes 20k; the rest is the
// sender's last reply and the few lines saying who it is from.
export const MESSAGE_MAX = 4000
// The sender's last reply rides along as context. Its tail is kept: that is where an agent puts
// its conclusion and what it is waiting on.
export const REPLY_MAX = 3000

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** A CLI session id the thread can be resumed by, or ''. */
const resumeId = (t) => (typeof t?.ref?.cliSessionId === 'string' && UUID_RE.test(t.ref.cliSessionId) ? t.ref.cliSessionId : '')

/** Whether a thread can be told something: a Claude Code conversation the CLI can resume. */
export const canHear = (t) => Boolean(t && TELL_HARNESSES.has(t.harness) && !t.archived && resumeId(t))

/** Whether a thread's card offers Tell: Claude Code only for now, whether or not it can be resumed itself. */
export const canTell = (t) => Boolean(t && TELL_HARNESSES.has(t.harness))

/**
 * Who `from` can tell something: every other thread that can hear, those on the same repo first,
 * then the most recently active. `busy` ones are listed so they can be seen, but not sent to:
 * two processes answering one conversation would talk over each other.
 */
export function tellTargets(threads, from) {
  const list = (Array.isArray(threads) ? threads : []).filter((t) => t && t.id !== from?.id && canHear(t))
  const same = (t) => (from && t.project === from.project ? 0 : 1)
  return list
    .sort((a, b) => same(a) - same(b) || (b.lastActivityAt || 0) - (a.lastActivityAt || 0))
    .map((t) => ({ id: t.id, title: t.title || 'Untitled', project: t.project || '', busy: Boolean(t.running || t.needsInput) }))
}

/** The last thing an agent said, from a transcript's messages, or ''. */
export function lastReply(messages) {
  const list = Array.isArray(messages) ? messages : []
  for (let i = list.length - 1; i >= 0; i--) {
    const m = list[i]
    if (m?.role === 'assistant' && typeof m.text === 'string' && m.text.trim()) return m.text.trim()
  }
  return ''
}

/**
 * The prompt the receiving agent sees. It says who the note is about and where that session works,
 * so the agent can look at its branch or files itself, and that the person wrote it, so it is
 * taken as theirs. Their last reply is quoted as the other agent's words, not the person's.
 */
export function tellPrompt(from, message, reply = '') {
  const text = typeof message === 'string' ? message.trim().slice(0, MESSAGE_MAX) : ''
  if (!text || !from) return ''
  const where = [
    from.project && `repo ${from.project}`,
    from.gitBranch && `branch ${from.gitBranch}`,
    (from.cwd || from.projectPath) && `working in ${from.cwd || from.projectPath}`,
  ].filter(Boolean).join(', ')
  const id = resumeId(from)
  const lines = [
    `Message from me, about another Claude Code session on this machine: “${from.title || 'Untitled'}”${where ? ` (${where})` : ''}${id ? `, session ${id}` : ''}.`,
    '',
    text,
  ]
  const said = typeof reply === 'string' ? reply.trim() : ''
  if (said) {
    const tail = said.length > REPLY_MAX ? `…${said.slice(-REPLY_MAX)}` : said
    lines.push('', 'Its last reply, quoted for context (its words, not mine):', ...tail.split('\n').map((l) => `> ${l}`))
  }
  return lines.join('\n')
}
