// The thread card: parked beside the selected villager, following it around the screen.
import { esc, ago, bytes } from './dom.js'
import { STATUS_LABEL, transcriptProgress } from '../sim/status.js'
import { sprites } from '../render/sprites/registry.js'
import { BADGE } from '../render/sprites/palette.js'

const GAP = 18

export function createCard(root, village) {
  const card = document.createElement('div')
  card.className = 'card'
  card.hidden = true
  root.appendChild(card)
  let shownId = null
  let shownKey = ''

  card.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]')
    if (!b) return
    const act = b.dataset.act
    if (act === 'open') village.open()
    else if (act === 'viewed') village.viewed()
    else if (act === 'archive') village.archive()
    else if (act === 'close') village.select(null)
  })

  function fill(t) {
    const statusColor = { waiting: BADGE.waiting, blocked: BADGE.blocked, working: BADGE.working, celebrating: BADGE.done }[t.status]
    const meta = [
      ['Repo', t.project],
      t.worktree && ['Worktree', t.worktree],
      t.gitBranch && ['Branch', t.gitBranch],
      t.model && ['Model', t.model],
      ['Last activity', ago(t.lastActivityAt)],
      ['Transcript', bytes(t.sizeBytes)],
    ].filter(Boolean)
    card.innerHTML = `
      <div class="head">
        <canvas class="avatar" width="16" height="24"></canvas>
        <div style="min-width:0;flex:1">
          <b title="${esc(t.title)}">${esc(t.title)}</b>
          <span class="status" ${statusColor ? `style="color:${statusColor}"` : ''}>${esc(STATUS_LABEL[t.status] || '')}</span>
        </div>
        <button class="btn" data-act="close" title="Close (Esc)">✕</button>
      </div>
      <ul class="meta">${meta.map(([k, v]) => `<li><span>${esc(k)}</span><span title="${esc(v)}">${esc(v)}</span></li>`).join('')}</ul>
      <div class="bar" title="How far along the transcript is"><i style="width:${Math.round(transcriptProgress(t.sizeBytes) * 100)}%"></i></div>
      <div class="actions">
        <button class="btn primary" data-act="open" ${t.canOpen ? '' : 'disabled'}>${village.settings.openIn === 'vscode' ? 'Open in VS Code' : 'Open'}<kbd>↵</kbd></button>
        ${t.status === 'waiting' ? '<button class="btn" data-act="viewed">Viewed<kbd>V</kbd></button>' : ''}
        <button class="btn danger" data-act="archive">Archive<kbd>A</kbd></button>
      </div>`
  }

  function drawAvatar(v) {
    const c = card.querySelector('canvas.avatar')
    if (!c || !v) return
    const g = c.getContext('2d')
    g.clearRect(0, 0, c.width, c.height)
    g.drawImage(sprites.get('villager.idle.s', 0, { look: v.look }), 0, 0)
  }

  return {
    /** Content: called when the selection or the scan changes. */
    update() {
      const id = village.selected
      const t = id && village.thread(id)
      if (!t) {
        card.hidden = true
        shownId = null
        return
      }
      const key = `${t.status}|${t.title}|${t.lastActivityAt}|${t.canOpen}|${village.settings.openIn}`
      if (id !== shownId || key !== shownKey) {
        fill(t)
        shownId = id
        shownKey = key
        drawAvatar(village.world.villager(id))
      }
      card.hidden = false
    },

    /** Position: called every frame. Right of the villager, flipping left rather than under the sidebar. */
    place(screen, sidebarLeft, mobile) {
      if (card.hidden || !screen) return
      const w = card.offsetWidth
      const h = card.offsetHeight
      if (mobile) {
        card.style.transform = `translate(12px, ${window.innerHeight - h - 12 - (window.innerHeight * 0.45)}px)`
        return
      }
      let x = screen.x + GAP
      if (x + w > sidebarLeft - 12) x = screen.x - GAP - w
      x = Math.max(12, Math.min(x, sidebarLeft - w - 12))
      const y = Math.max(12, Math.min(screen.y - h / 2, window.innerHeight - h - 12))
      card.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`
    },
  }
}
