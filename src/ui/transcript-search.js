// What the transcript panel does with the messages it holds, kept free of the DOM so it can be
// tested: finding a phrase in a piece of text, and writing the conversation out as Markdown.

/**
 * `text` cut into runs, each marked as a match of `query` or not. Case-insensitive, and the
 * runs always join back to `text`. An empty query matches nothing.
 */
export function splitMatches(text, query) {
  const s = String(text)
  const q = String(query || '')
  if (!q) return [{ text: s, hit: false }]
  // The pattern keeps the query as typed and lets the `i` flag fold case: lowercasing it first
  // would change some characters (İ becomes i + a combining dot) so that it no longer matched itself.
  const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
  const out = []
  let at = 0
  for (const m of s.matchAll(re)) {
    if (m.index > at) out.push({ text: s.slice(at, m.index), hit: false })
    out.push({ text: m[0], hit: true })
    at = m.index + m[0].length
  }
  if (at < s.length || !out.length) out.push({ text: s.slice(at), hit: false })
  return out
}

/** A tool call as the panel shows it: its name, then the one line it said, or the command itself. */
export function toolText(m) {
  return `${m.name || 'tool'} ${m.code || m.detail || ''}`.trim()
}

/** The visible conversation as Markdown, in the order the panel shows it. `who` names the assistant. */
export function toMarkdown(messages, who = 'Claude') {
  const fence = (s) => {
    // A fence has to be longer than any run of backticks inside what it holds.
    const longest = Math.max(2, ...(String(s).match(/`+/g) || []).map((r) => r.length))
    const f = '`'.repeat(longest + 1)
    return `${f}\n${s}\n${f}`
  }
  return messages
    .map((m) => {
      if (m.role === 'thinking') return `<details><summary>Thinking</summary>\n\n${m.text}\n\n</details>`
      if (m.role === 'tool') return m.code ? `**${m.name || 'tool'}**\n\n${fence(m.code)}` : `- \`${m.name || 'tool'}\` ${m.detail || ''}`.trimEnd()
      return `**${m.role === 'user' ? 'You' : who}:**\n\n${m.text}`
    })
    .join('\n\n')
}
