// Pure: the line of words a speech bubble over a waiting villager holds. No canvas: the renderer
// passes in how wide a string comes out, so this runs under `node --test`.

/**
 * How wide a bubble's line may be, in CSS pixels. Much wider and it covers the plot next door; the
 * card has the whole question, so the bubble only has to say what it's about.
 */
export const BUBBLE_MAX_PX = 220

const ELLIPSIS = '…'

/**
 * The longest start of `text` that fits in `maxWidth` as one line, ending in an ellipsis if
 * anything was cut. Cut at a word where one ends late enough, so the line doesn't end mid-word.
 * `measure(s)` is how wide `s` is, in the same units as `maxWidth`.
 * @param {string} text
 * @param {number} maxWidth
 * @param {(s: string) => number} measure
 */
export function fitLine(text, maxWidth, measure) {
  const s = String(text ?? '').replace(/\s+/g, ' ').trim()
  if (!s || measure(s) <= maxWidth) return s
  if (measure(ELLIPSIS) > maxWidth) return ''
  // The most characters that still fit with the ellipsis on: a binary search, since measuring is the slow part.
  let lo = 0
  let hi = s.length
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    if (measure(s.slice(0, mid).trimEnd() + ELLIPSIS) <= maxWidth) lo = mid
    else hi = mid - 1
  }
  let cut = s.slice(0, lo)
  // Back to the last space, unless that throws away more than a third of what fits.
  const space = cut.lastIndexOf(' ')
  if (space > (lo * 2) / 3) cut = cut.slice(0, space)
  cut = cut.trimEnd().replace(/[,;:.\-–—]+$/, '')
  return cut ? cut + ELLIPSIS : ''
}
