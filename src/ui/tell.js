// Tell another agent: from one villager's card, write a note about it and send it into another
// Claude Code conversation, with its last reply along if you like. The rules are src/game/tell.js.
import { esc, submitKey } from './dom.js'
import { MESSAGE_MAX } from '../game/tell.js'

export function createTell(root, village) {
  const box = document.createElement('div')
  box.className = 'sheet newsession tell'
  box.hidden = true
  root.appendChild(box)
  let fromId = ''
  let sending = false

  function render() {
    const from = village.thread(fromId)
    if (!from) return close()
    const targets = village.tellTargets(fromId)
    const free = targets.filter((t) => !t.busy)
    const option = (t) => `<option value="${esc(t.id)}" ${t.busy ? 'disabled' : ''}>${esc(t.title)}${t.project !== from.project ? ` — ${esc(t.project)}` : ''}${t.busy ? ' (busy)' : ''}</option>`
    box.innerHTML = `<h2>Tell another agent about “${esc(from.title)}”</h2>
      ${targets.length ? `
      <label class="stack">To
        <select data-f="to">${targets.map(option).join('')}</select></label>
      <label class="stack">Message
        <textarea data-f="message" rows="5" maxlength="${MESSAGE_MAX}" placeholder="What it should know, e.g. “This one changed the login API. Update your client to match.”"></textarea></label>
      <label class="check"><span>Include its last reply</span><input type="checkbox" data-f="reply" checked></label>
      <p class="note">Continues that conversation in a terminal, with who this is about and where it works, so it can look for itself.</p>`
    : '<p class="note">No other Claude Code session can take a message: it needs one started from the terminal, not archived.</p>'}
      <div class="actions">
        ${targets.length ? `<button class="btn primary" data-act="send" ${free.length ? '' : 'disabled'}>Send<kbd>${submitKey()}</kbd></button>` : ''}
        <button class="btn" data-act="close">Cancel</button>
      </div>`
    const pick = box.querySelector('[data-f="to"]')
    if (pick && free[0]) pick.value = free[0].id
  }

  async function send() {
    if (sending) return
    const to = box.querySelector('[data-f="to"]')?.value || ''
    const message = box.querySelector('[data-f="message"]')?.value || ''
    const withReply = Boolean(box.querySelector('[data-f="reply"]')?.checked)
    if (!to) return
    sending = true
    const sent = await village.tell(fromId, to, message, { withReply }).finally(() => (sending = false))
    if (sent) close()
  }

  box.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]')
    if (!b) return
    if (b.dataset.act === 'send') send()
    else if (b.dataset.act === 'close') close()
  })
  box.addEventListener('keydown', (e) => {
    e.stopPropagation() // typing here must not steer the village
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send()
    else if (e.key === 'Escape') close()
  })

  function open(id) {
    if (!village.canTell(id)) return
    fromId = id
    render()
    box.hidden = false
    ;(box.querySelector('[data-f="message"]') || box.querySelector('[data-act="close"]'))?.focus()
  }
  function close() {
    box.hidden = true
  }
  return { open, close, get isOpen() { return !box.hidden } }
}
