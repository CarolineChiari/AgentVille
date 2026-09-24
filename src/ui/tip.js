// The quick look: hold the pointer on a building a moment and it says whose it is and when it
// last did anything, without selecting it or stepping inside.
import { ago } from './dom.js'

// Long enough that sweeping the pointer across the village doesn't flicker a tip at every roof,
// short enough that resting on one feels answered.
export const TIP_DELAY_MS = 250
// Clear of the cursor, so the tip never sits under the pointer it answers.
const OFFSET_PX = 14

/**
 * What the tip says about a thread: its name, its folder, and when it last did anything. Working
 * and waiting say so instead of a time, since "just now" would undersell both.
 * @param {object} t a Thread
 * @returns {{ title: string, where: string, when: string } | null}
 */
export function tipOf(t, now = Date.now()) {
  if (!t) return null
  const when = t.needsInput ? 'Waiting on you'
    : t.running ? 'Working now'
    : `Last active ${ago(t.lastActivityAt, now)}`
  return { title: t.title || 'Untitled', where: t.project || '', when }
}

/** The dwell: `hover(id, x, y)` on every move, and the tip shows once the same id has held for the delay. */
export function createTip(root, village) {
  const box = document.createElement('div')
  box.className = 'tip'
  box.hidden = true
  box.setAttribute('role', 'tooltip')
  const title = document.createElement('b')
  const where = document.createElement('span')
  const when = document.createElement('span')
  box.append(title, where, when)
  root.appendChild(box)

  let id = null
  let timer = 0
  let at = { x: 0, y: 0 }

  function place() {
    // Flip to the other side of the cursor near the right or bottom edge, so it stays on screen.
    const w = box.offsetWidth
    const h = box.offsetHeight
    const x = at.x + OFFSET_PX + w > innerWidth ? at.x - OFFSET_PX - w : at.x + OFFSET_PX
    const y = at.y + OFFSET_PX + h > innerHeight ? at.y - OFFSET_PX - h : at.y + OFFSET_PX
    box.style.transform = `translate(${Math.max(0, x)}px, ${Math.max(0, y)}px)`
  }

  function show() {
    const tip = tipOf(village.thread(id))
    if (!tip) return
    title.textContent = tip.title
    where.textContent = tip.where
    where.hidden = !tip.where
    when.textContent = tip.when
    box.hidden = false
    place()
  }

  function hide() {
    clearTimeout(timer)
    id = null
    box.hidden = true
  }

  return {
    hide,
    /** @param {string|null} next the thread whose building is under the pointer, or null */
    hover(next, x, y) {
      at = { x, y }
      if (next !== id) {
        hide()
        if (!next) return
        id = next
        timer = setTimeout(show, TIP_DELAY_MS)
      } else if (!box.hidden) place()
    },
  }
}
