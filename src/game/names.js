// Pure: the names a person gave their threads, over the titles the harnesses gave them.
// Saved in village.json as `names`, thread id → name. A harness's own files are never touched.

/** Long enough for a sentence, short enough that a pasted transcript can't become a name. */
export const NAME_MAX = 120

/** A name as it is kept: one line, trimmed, capped. '' means none. */
export function cleanName(v) {
  if (typeof v !== 'string') return ''
  return v.replace(/\s+/g, ' ').trim().slice(0, NAME_MAX).trim()
}

/** Thread id → name, with anything that isn't one dropped. A hand-edited file cannot crash the page. */
export function cleanNames(v) {
  const out = {}
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out
  for (const [k, n] of Object.entries(v)) {
    const name = cleanName(n)
    if (k !== '__proto__' && name) out[k] = name
  }
  return out
}

/**
 * Each thread wearing its given name, if it has one. The harness's title is kept as
 * `harnessTitle`, so a renamed thread can still say what it was called.
 */
export function withNames(threads, names = {}) {
  return threads.map((t) => {
    const name = Object.hasOwn(names, t.id) ? cleanName(names[t.id]) : ''
    return name ? { ...t, title: name, harnessTitle: t.title } : t
  })
}
