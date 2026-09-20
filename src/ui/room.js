// The one strip of DOM in a room. Everything about the work is written on the board on the wall;
// what is left is the handful of things a room can't do for itself — opening the thread in the
// editor, its conversation, and a way out for anyone who doesn't think to click the door.
import { esc, openLabel } from './dom.js'
import { STATUS_LABEL, needsInputLabel } from '../sim/status.js'

export function createRoomPanel(root, village, { onTranscript = () => {} } = {}) {
  const bar = document.createElement('div')
  bar.className = 'roombar'
  bar.hidden = true
  root.appendChild(bar)
  let id = null
  let key = ''

  bar.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]')
    if (!b) return
    if (b.dataset.act === 'leave') village.leave()
    else if (b.dataset.act === 'open') village.open(id)
    else if (b.dataset.act === 'transcript') onTranscript(id)
  })

  function paint() {
    const t = village.thread(id)
    if (!t) return
    const status = needsInputLabel(t.needsInput) || STATUS_LABEL[t.status] || ''
    bar.innerHTML = `
      <span class="rb-status">${esc(status)}</span>
      <button class="btn primary" data-act="open" ${t.canOpen ? '' : 'disabled'}>${esc(openLabel(t, village.settings.openIn))}<kbd>↵</kbd></button>
      <button class="btn" data-act="transcript">Transcript<kbd>T</kbd></button>
      <button class="btn" data-act="leave" title="Back outside — or click the door">Leave<kbd>Esc</kbd></button>`
  }

  return {
    /** Called whenever `village.focused` may have changed. */
    sync() {
      id = village.focused
      if (!id) {
        bar.hidden = true
        key = ''
        return
      }
      const t = village.thread(id)
      const next = `${id}|${t?.status}|${t?.needsInput}|${t?.canOpen}|${village.settings.openIn}`
      if (next !== key) {
        key = next
        paint()
      }
      bar.hidden = false
    },
  }
}
