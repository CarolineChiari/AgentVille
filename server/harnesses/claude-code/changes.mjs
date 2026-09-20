// Pure: what a Claude Code transcript says the session changed on disk. Everything here is read
// from the tool calls the transcript already recorded — the repo itself is never run, never asked,
// never touched (CLAUDE.md: a repo is only ever read).

const PATH_MAX = 400
const EXCERPT_MAX = 160
/** Entries kept per session. A long refactor can run to thousands; the log says how many were dropped. */
export const ENTRIES_MAX = 400
/** Files listed on a card. Beyond this the list stops being a summary. */
export const FILES_MAX = 50
/**
 * What one file's text is allowed to carry when it is read for review: each side of a hunk, and
 * how many of a file's edits are kept. A whole session's bodies would be far too much to hold or
 * to send, so they are only ever read for the one file being looked at, newest edits first.
 */
const BODY_MAX = 8000
export const EDITS_MAX = 40

/** Tools that write a file, and what a call to each one does to it. */
const FILE_TOOLS = { Write: 'created', Edit: 'edited', MultiEdit: 'edited', NotebookEdit: 'edited' }

const clip = (s, n) => {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim()
  return t.length > n ? t.slice(0, n - 1) + '…' : t
}

/** The first line of a blob, for an excerpt: the whole of a one-line edit, the gist of a big one. */
const firstLine = (s) => {
  const lines = String(s ?? '').split('\n')
  const line = lines.find((l) => l.trim()) || ''
  return clip(line, EXCERPT_MAX / 2) + (lines.filter((l) => l.trim()).length > 1 ? ' …' : '')
}

/**
 * Path segments, comparable across platforms: split on both separators so a Windows path parses
 * the same on a Mac test run, and a drive letter compares case-insensitively because Windows
 * writes `C:\` and `c:\` for the same disk.
 */
function segments(p) {
  const out = String(p ?? '').split(/[\\/]/).filter(Boolean)
  if (/^[A-Za-z]:$/.test(out[0] || '')) out[0] = out[0].toUpperCase()
  return out
}

/**
 * A path as the village shows it: relative to the repo root when it is inside it, absolute when
 * it is not. A path outside the repo is still worth showing — it says the session reached out of
 * its plot — but the page must not offer to open it.
 * @returns {{ path: string, outside: boolean }}
 */
export function relativePath(file, root) {
  const f = segments(file)
  const r = segments(root)
  if (!f.length) return { path: '', outside: true }
  if (!r.length || f.length <= r.length || r.some((s, i) => s !== f[i])) return { path: clip(file, PATH_MAX), outside: true }
  return { path: f.slice(r.length).join('/'), outside: false }
}

/**
 * A shell command split into arguments, quotes respected. Only good enough to read paths back out
 * of an `rm` or a `git mv`; anything cleverer than quoting is left as one argument and simply
 * shows up as an odd-looking path rather than the wrong one.
 */
export function shellArgs(cmd) {
  const out = []
  const re = /"((?:[^"\\]|\\.)*)"|'([^']*)'|(\S+)/g
  let m
  while ((m = re.exec(String(cmd ?? '')))) out.push(m[1] !== undefined ? m[1].replace(/\\(.)/g, '$1') : (m[2] ?? m[3]))
  return out
}

/**
 * The separate commands in one Bash call. A session writes `cd x && git commit -m …` as often as
 * it writes the command alone, so each part is read on its own. `|` is deliberately not a
 * separator: a pipeline is one command, and its tail is not something that touched a file.
 */
const commandParts = (cmd) => String(cmd ?? '').split(/&&|\|\||;|\n/).map((s) => s.trim()).filter(Boolean)

/**
 * The message of a `git commit`, collapsed onto one line for a pinned-up note. Both forms the CLI
 * writes are read: a quoted `-m "…"`, and the heredoc (`-m "$(cat <<'EOF' … EOF)"`) that carries a
 * multi-line message — whose body stops at the terminator line, not at the end of the command.
 */
export function commitMessage(cmd) {
  const m = /-m\s+(?:(['"])([\s\S]*?)\1|(\S+))/.exec(String(cmd ?? ''))
  if (!m) return ''
  const raw = m[2] ?? m[3] ?? ''
  const here = /<<-?\s*'?"?(\w+)'?"?\s*\n([\s\S]*)/.exec(raw)
  if (!here) return clip(raw, EXCERPT_MAX)
  const end = here[2].split('\n').findIndex((l) => l.trim() === here[1])
  return clip(end === -1 ? here[2] : here[2].split('\n').slice(0, end).join('\n'), EXCERPT_MAX)
}

/** What one Bash command did to the files, or null when it did nothing we can see. */
function fromBash(part) {
  if (/^git\s+commit\b/.test(part)) return { commit: commitMessage(part) }
  if (/^git\s+mv\b/.test(part)) {
    // `git mv <src> <dst>`: the destination is the file that now exists, so that is the entry.
    const args = shellArgs(part).slice(2).filter((a) => !a.startsWith('-'))
    if (args.length < 2) return null
    const to = args.at(-1)
    return { files: [{ file: to, kind: 'renamed', excerpt: `${args.slice(0, -1).join(', ')} → ${to}` }] }
  }
  if (/^rm\b/.test(part)) {
    const args = shellArgs(part).slice(1).filter((a) => !a.startsWith('-'))
    return { files: args.map((file) => ({ file, kind: 'deleted', excerpt: '' })) }
  }
  return null
}

const body = (s) => {
  const t = String(s ?? '')
  return t.length > BODY_MAX ? t.slice(0, BODY_MAX) + '\n… cut here; the rest is in the file itself' : t
}

/**
 * What one file-writing tool call did: the file it wrote, a short before → after, and the text on
 * either side of each thing it replaced. A `Write` replaced nothing, so its before is empty and
 * the whole file reads as new; a `MultiEdit` did several replacements in one call, so it has one
 * hunk each.
 */
function fromFileTool(name, input) {
  const kind = FILE_TOOLS[name]
  const file = input.file_path ?? input.notebook_path ?? ''
  if (!kind || !file) return null
  let excerpt = ''
  let hunks = []
  if (name === 'Write') {
    excerpt = firstLine(input.content)
    hunks = [{ before: '', after: body(input.content) }]
  } else if (name === 'Edit') {
    excerpt = `${firstLine(input.old_string)} → ${firstLine(input.new_string)}`
    hunks = [{ before: body(input.old_string), after: body(input.new_string) }]
  } else if (name === 'NotebookEdit') {
    excerpt = firstLine(input.new_source)
    hunks = [{ before: '', after: body(input.new_source) }]
  } else if (name === 'MultiEdit') {
    const edits = Array.isArray(input.edits) ? input.edits : []
    const one = edits[0] || {}
    excerpt = `${edits.length} edit${edits.length === 1 ? '' : 's'}${one.old_string ? `: ${firstLine(one.old_string)} → ${firstLine(one.new_string)}` : ''}`
    hunks = edits.map((e) => ({ before: body(e?.old_string), after: body(e?.new_string) }))
  }
  return { file, kind, excerpt: clip(excerpt, EXCERPT_MAX), hunks }
}

/**
 * Every change one session made, in the order it made them, plus the commits between them.
 *
 * Subagent (sidechain) turns count here, unlike in the conversation view: a subagent's Write
 * changed the same working tree as its parent's, so leaving it out would under-report the work.
 *
 * A tool call whose result came back an error is dropped — the edit did not land — while a call
 * with no result yet is kept, because that is what a session still working looks like.
 *
 * @param {object[]} records  parsed transcript lines, in file order
 * @param {{ root?: string, bodiesFor?: string }} [opts]  the repo root, and the one path whose
 *        before-and-after text to keep. Every other entry carries only its one-line excerpt.
 * @returns {{ entries: object[], commits: object[], dropped: number }}
 */
export function changeLog(records, { root = '', bodiesFor = '' } = {}) {
  const entries = []
  const commits = []
  const failed = new Set()
  let dropped = 0

  const push = (entry) => {
    if (entries.length >= ENTRIES_MAX) {
      dropped++
      return
    }
    entries.push(entry)
  }

  for (const r of records) {
    if (!r || typeof r !== 'object') continue
    const at = Date.parse(r.timestamp) || 0
    const content = r.message?.content
    if (!Array.isArray(content)) continue
    for (const b of content) {
      if (b?.type === 'tool_result' && b.is_error && typeof b.tool_use_id === 'string') {
        failed.add(b.tool_use_id)
        continue
      }
      if (b?.type !== 'tool_use') continue
      const input = b.input && typeof b.input === 'object' ? b.input : {}
      const id = typeof b.id === 'string' ? b.id : ''
      if (b.name === 'Bash') {
        for (const part of commandParts(input.command)) {
          const did = fromBash(part)
          if (!did) continue
          if (did.commit !== undefined) commits.push({ at, message: did.commit, id })
          for (const f of did.files || []) push({ at, ...relativePath(f.file, root), kind: f.kind, tool: 'Bash', excerpt: f.excerpt, id })
        }
        continue
      }
      const did = fromFileTool(b.name, input)
      if (!did) continue
      const where = relativePath(did.file, root)
      const entry = { at, ...where, kind: did.kind, tool: b.name, excerpt: did.excerpt, id }
      // Only the file being reviewed carries its text: everything else would be megabytes.
      if (bodiesFor && where.path === bodiesFor) entry.hunks = did.hunks
      push(entry)
    }
  }

  const kept = entries.filter((e) => e.path && !failed.has(e.id))
  const seen = new Set()
  for (const e of kept) {
    // Only the first Write of a file in a session created it; a later one rewrote what was there.
    if (e.kind === 'created' && seen.has(e.path)) e.kind = 'edited'
    seen.add(e.path)
    delete e.id
  }
  const landed = commits.filter((c) => !failed.has(c.id))
  for (const c of landed) delete c.id
  return { entries: kept, commits: landed, dropped }
}

/**
 * The files a session touched, most edited first: what a card has room for. `edits` counts every
 * call that wrote the file, so a file worked over ten times reads louder than one written once.
 * @param {object[]} entries  from `changeLog`
 */
export function filesTouched(entries, { max = FILES_MAX } = {}) {
  const byPath = new Map()
  for (const e of entries) {
    const hit = byPath.get(e.path)
    if (hit) {
      hit.edits++
      hit.at = Math.max(hit.at, e.at)
      // A file written and then deleted is gone; a deleted file written again is back.
      hit.kind = e.kind === 'deleted' || hit.kind === 'deleted' ? e.kind : hit.kind
    } else {
      byPath.set(e.path, { path: e.path, outside: e.outside, edits: 1, kind: e.kind, at: e.at })
    }
  }
  const all = [...byPath.values()].sort((a, b) => b.edits - a.edits || b.at - a.at || a.path.localeCompare(b.path))
  return { files: all.slice(0, max), more: Math.max(0, all.length - max) }
}
