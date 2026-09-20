// Turning a before and an after into the lines of a diff. Pure, so it runs under `node --test`
// and so the room can show the change itself rather than the fact that there was one.
//
// The texts here are what a tool call recorded — the string it matched and the string it put in
// its place — so they are short by the standards of a real diff, and a plain longest-common-
// subsequence walk is both exact and quick enough. Anything unreasonably long falls back to
// "all of this went, all of that arrived", which is what a whole-file rewrite is anyway.

/** Past this many lines on a side, the LCS table is not worth building. */
const LCS_MAX = 600
/** Unchanged lines kept either side of a change. A longer run is folded away. */
export const CONTEXT = 3
/** A line longer than this is cut: the board can't show it, and neither can a reader. */
const LINE_MAX = 400

const clip = (s) => (s.length > LINE_MAX ? s.slice(0, LINE_MAX - 1) + '…' : s)

/** Text as lines, with the trailing newline's empty last line dropped. */
export function lines(text) {
  const s = String(text ?? '')
  if (!s) return []
  const out = s.split('\n')
  if (out.length && out.at(-1) === '') out.pop()
  return out
}

/**
 * Every line of both sides, marked: ' ' unchanged, '-' gone, '+' arrived. Nothing is folded away
 * yet — that is `foldContext`'s job — so this stays the plain truth about the two texts.
 * @returns {{ sign: ' '|'-'|'+', text: string }[]}
 */
export function diffLines(before, after) {
  const a = lines(before)
  const b = lines(after)
  if (!a.length && !b.length) return []
  if (!a.length) return b.map((text) => ({ sign: '+', text: clip(text) }))
  if (!b.length) return a.map((text) => ({ sign: '-', text: clip(text) }))
  if (a.length > LCS_MAX || b.length > LCS_MAX) {
    return [...a.map((text) => ({ sign: '-', text: clip(text) })), ...b.map((text) => ({ sign: '+', text: clip(text) }))]
  }
  // Longest common subsequence, then walked back into a diff.
  const n = a.length
  const m = b.length
  const dp = new Uint32Array((n + 1) * (m + 1))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i * (m + 1) + j] = a[i] === b[j]
        ? dp[(i + 1) * (m + 1) + j + 1] + 1
        : Math.max(dp[(i + 1) * (m + 1) + j], dp[i * (m + 1) + j + 1])
    }
  }
  const out = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ sign: ' ', text: clip(a[i]) })
      i++
      j++
    } else if (dp[(i + 1) * (m + 1) + j] >= dp[i * (m + 1) + j + 1]) {
      // A line that went is shown before the one that replaced it, the way a diff reads.
      out.push({ sign: '-', text: clip(a[i++]) })
    } else {
      out.push({ sign: '+', text: clip(b[j++]) })
    }
  }
  while (i < n) out.push({ sign: '-', text: clip(a[i++]) })
  while (j < m) out.push({ sign: '+', text: clip(b[j++]) })
  return out
}

/**
 * The same lines with long runs of unchanged ones folded into a single line saying how many were
 * skipped, so a small change inside a big block is still one screen to read.
 * @param {{ sign: string, text: string }[]} rows
 */
export function foldContext(rows, context = CONTEXT) {
  const keep = new Array(rows.length).fill(false)
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].sign === ' ') continue
    for (let k = Math.max(0, i - context); k <= Math.min(rows.length - 1, i + context); k++) keep[k] = true
  }
  const out = []
  let skipped = 0
  for (let i = 0; i < rows.length; i++) {
    if (keep[i]) {
      if (skipped) {
        out.push({ sign: '…', text: `${skipped} unchanged line${skipped === 1 ? '' : 's'}` })
        skipped = 0
      }
      out.push(rows[i])
    } else {
      skipped++
    }
  }
  if (skipped) out.push({ sign: '…', text: `${skipped} unchanged line${skipped === 1 ? '' : 's'}` })
  return out
}

/** How much a diff added and took away, for a line saying so above it. */
export function countDiff(rows) {
  let added = 0
  let removed = 0
  for (const r of rows) {
    if (r.sign === '+') added++
    else if (r.sign === '-') removed++
  }
  return { added, removed }
}
