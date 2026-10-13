// The foreman's words: what a verdict on a session can be, and how a round stands. Pure, shared by
// the server that makes the rounds and the page that shows them.

/**
 * What the foreman can make of a session, most pressing first: the order its report is read in.
 * `working`, `stuck` and `you` can be told from the village alone; the rest need the transcript.
 * `unsure` is what is left when neither the transcript nor the session itself could say.
 */
export const VERDICTS = ['you', 'stuck', 'unfinished', 'unsure', 'working', 'done']

export const VERDICT_LABEL = {
  you: 'Waiting on you',
  stuck: 'Stuck',
  unfinished: 'Not finished',
  unsure: 'Couldn’t tell',
  working: 'Still working',
  done: 'Done',
}

/** What a session asked about itself can answer: it knows, so never `unsure`, and it isn't running. */
export const ASKED_VERDICTS = ['done', 'unfinished', 'stuck', 'you']
/** What the foreman can make of a transcript; `working` is only ever seen, never judged. */
export const JUDGED_VERDICTS = [...ASKED_VERDICTS, 'unsure']

export const isVerdict = (v) => typeof v === 'string' && VERDICTS.includes(v)

/** Where a round is: `reading` transcripts, `asking` sessions, or finished one way or the other. */
export const PHASES = ['idle', 'reading', 'asking', 'done', 'failed']
export const isRunning = (s) => s?.phase === 'reading' || s?.phase === 'asking'

/** The most sessions one round looks at: they all go into one prompt, and the busiest are first. */
export const MAX_ROUND = 24

// A report is read back from data/foreman.json, which a person could edit by hand.
const ID_RE = /^[a-z][a-z0-9-]{0,30}:[A-Za-z0-9_.:-]{1,120}$/
export const isThreadId = (v) => typeof v === 'string' && ID_RE.test(v)

const text = (v, max) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '')

/** One row of a report as kept, or null when it isn't one. */
export function cleanRow(r) {
  if (!r || typeof r !== 'object' || !isThreadId(r.id) || !isVerdict(r.verdict)) return null
  return { id: r.id, title: text(r.title, 120), project: text(r.project, 120), verdict: r.verdict, summary: text(r.summary, 240), asked: r.asked === true, note: text(r.note, 240) }
}

/** A round's report in reading order: most pressing verdict first, then as the round listed them. */
export function sortReport(rows) {
  return rows.map((r, i) => [r, i]).sort((a, b) => VERDICTS.indexOf(a[0].verdict) - VERDICTS.indexOf(b[0].verdict) || a[1] - b[1]).map(([r]) => r)
}

/** Thread id → verdict, for the clipboard each villager holds up until the report is cleared. */
export function verdictsOf(status) {
  const out = new Map()
  if (status?.phase !== 'done') return out
  for (const r of status.report || []) if (isThreadId(r.id) && isVerdict(r.verdict)) out.set(r.id, r.verdict)
  return out
}

/** How many of each verdict, for a one-line summary of a round. */
export function tally(rows) {
  const n = Object.fromEntries(VERDICTS.map((v) => [v, 0]))
  for (const r of rows || []) if (isVerdict(r.verdict)) n[r.verdict]++
  return n
}

/** A round summed up in a sentence: the toast when it finishes, and the screen reader's line. */
export function roundLine(status) {
  if (status?.phase === 'failed') return `The foreman couldn’t finish: ${status.error || 'something went wrong.'}`
  const rows = status?.report || []
  if (!rows.length) return 'The foreman found nobody at work.'
  const n = tally(rows)
  const parts = VERDICTS.filter((v) => n[v]).map((v) => `${n[v]} ${VERDICT_LABEL[v].toLowerCase()}`)
  return `The foreman checked ${rows.length} session${rows.length === 1 ? '' : 's'}: ${parts.join(', ')}.`
}
