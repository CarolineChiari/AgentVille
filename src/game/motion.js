// Pure: whether the village should keep still, and what a screen reader is told about it. Reading
// the OS flag and touching the DOM is the page's business, in src/main.js.

/**
 * `motion` is the Settings choice: 'system' follows the OS's prefers-reduced-motion, 'reduce' and
 * 'full' override it. The OS flag is passed in rather than read here so this runs under node.
 * @param {{ motion?: string }} settings
 * @param {boolean} systemReduces
 */
export function reducedMotion(settings, systemReduces) {
  if (settings?.motion === 'reduce') return true
  if (settings?.motion === 'full') return false
  return Boolean(systemReduces)
}

/** The sentence the canvas carries as its aria-label, from the sidebar's counts. */
export function villageSummary(counts) {
  const n = (k) => counts?.[k] || 0
  const parts = []
  if (n('blocked')) parts.push(`${n('blocked')} stuck on an error`)
  if (n('waiting')) parts.push(`${n('waiting')} need you`)
  if (n('working')) parts.push(`${n('working')} working`)
  if (n('done')) parts.push(`${n('done')} done`)
  return parts.length ? `The village: ${parts.join(', ')}.` : 'The village: no villagers need you.'
}
