// Which files a repo ignores, from its .gitignore files, read as text: no git process. The common
// part of gitignore(5): comments, `!` to take a file back, a trailing `/` for directories only, a
// leading or inner `/` to anchor a pattern where its .gitignore is, `*`, `?`, `[…]` and `**`.
// Anything rarer that fails to match only means a few more files counted.

const SPECIAL = /[.+^${}()|\\]/

/** A gitignore glob as a regular expression over a path relative to its .gitignore's folder. */
function globToRegex(glob) {
  let re = ''
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]
    if (c === '*') {
      if (glob[i + 1] === '*') {
        const before = i === 0 || glob[i - 1] === '/'
        const after = glob[i + 2] === '/' || i + 2 === glob.length
        if (before && after) {
          // `**/` is any number of folders, none included; a trailing `/**` everything inside.
          if (i + 2 === glob.length) re += '.*'
          else {
            re += '(?:.*/)?'
            i++
          }
          i++
          continue
        }
      }
      re += '[^/]*'
    } else if (c === '?') re += '[^/]'
    else if (c === '[') {
      const end = glob.indexOf(']', i + 2)
      if (end < 0) {
        re += '\\['
        continue
      }
      let body = glob.slice(i + 1, end).replace(/\\/g, '\\\\')
      if (body[0] === '!') body = `^${body.slice(1)}`
      re += `[${body}]`
      i = end
    } else if (c === '\\' && i + 1 < glob.length) {
      i++
      re += SPECIAL.test(glob[i]) || glob[i] === '[' || glob[i] === '*' || glob[i] === '?' ? `\\${glob[i]}` : glob[i]
    } else re += SPECIAL.test(c) ? `\\${c}` : c
  }
  return re
}

/**
 * One .gitignore's rules, in order.
 * @param {string} text
 * @returns {{ re: RegExp, negate: boolean, dirOnly: boolean }[]}
 */
export function parseIgnore(text) {
  const rules = []
  for (let line of String(text).split(/\r?\n/)) {
    if (!line || line[0] === '#') continue
    // Trailing spaces go, unless the last one is escaped.
    line = line.replace(/(?<!\\)\s+$/, '')
    if (!line) continue
    let negate = false
    if (line[0] === '!') {
      negate = true
      line = line.slice(1)
    } else if (line[0] === '\\' && (line[1] === '!' || line[1] === '#')) line = line.slice(1)
    const dirOnly = line.endsWith('/')
    if (dirOnly) line = line.slice(0, -1)
    if (!line) continue
    // A slash anywhere but the end ties the pattern to this folder; without one it matches a name at any depth.
    const anchored = line.includes('/')
    if (line[0] === '/') line = line.slice(1)
    const body = globToRegex(line)
    try {
      rules.push({ re: new RegExp(anchored ? `^${body}$` : `^(?:.*/)?${body}$`), negate, dirOnly })
    } catch {
      // A pattern this reading can't make sense of ignores nothing.
    }
  }
  return rules
}

/**
 * Is `rel`, a path under the repo with `/` between its parts, ignored by these rule sets? Each set
 * is one .gitignore's, with `base`, its folder relative to the repo ('' for the top). The last rule
 * to match wins, deeper .gitignore files after shallower ones, as git reads them.
 * @param {{ base: string, rules: ReturnType<typeof parseIgnore> }[]} sets  shallowest first
 */
export function isIgnored(sets, rel, isDir) {
  let ignored = false
  for (const { base, rules } of sets) {
    if (base && !rel.startsWith(`${base}/`)) continue
    const sub = base ? rel.slice(base.length + 1) : rel
    for (const r of rules) {
      if (r.dirOnly && !isDir) continue
      if (r.re.test(sub)) ignored = !r.negate
    }
  }
  return ignored
}
