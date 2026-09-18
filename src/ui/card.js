// The thread card: parked beside the selected villager, following it around the screen.
import { esc, ago, bytes } from './dom.js'
import { STATUS_LABEL, needsInputLabel, transcriptProgress } from '../sim/status.js'
import { sprites } from '../render/sprites/registry.js'
import { BADGE, PALETTE as P, PETALS } from '../render/sprites/palette.js'

const GAP = 18

export function createCard(root, village, { onTranscript = () => {} } = {}) {
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
    else if (act === 'restore') village.unarchive(village.selected)
    else if (act === 'openPr') village.openPr()
    else if (act === 'openThread') village.open(b.dataset.id)
    else if (act === 'transcript') onTranscript(b.dataset.id || village.selected)
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
          <span class="status" ${statusColor ? `style="color:${statusColor}"` : ''}>${esc(needsInputLabel(t.needsInput) || STATUS_LABEL[t.status] || '')}</span>
        </div>
        <button class="btn" data-act="close" title="Close (Esc)">✕</button>
      </div>
      <ul class="meta">${meta.map(([k, v]) => `<li><span>${esc(k)}</span><span title="${esc(v)}">${esc(v)}</span></li>`).join('')}</ul>
      <div class="bar" title="How far along the transcript is"><i style="width:${Math.round(transcriptProgress(t.sizeBytes) * 100)}%"></i></div>
      <div class="actions">
        <button class="btn primary" data-act="open" ${t.canOpen ? '' : 'disabled'}>${village.settings.openIn === 'vscode' ? 'Open in VS Code' : 'Open'}<kbd>↵</kbd></button>
        <button class="btn" data-act="transcript">Transcript<kbd>T</kbd></button>
        ${t.status === 'waiting' ? '<button class="btn" data-act="viewed">Viewed<kbd>V</kbd></button>' : ''}
        <button class="btn danger" data-act="archive">Archive<kbd>A</kbd></button>
      </div>`
  }

  /** Looking back at a finished thread: its flower, what kind of work it was, and when. */
  function fillFinished(t, f) {
    const color = PETALS[f.color % PETALS.length]
    const meta = [
      ['Repo', t.project],
      t.worktree && ['Worktree', t.worktree],
      t.gitBranch && ['Branch', t.gitBranch],
      t.model && ['Model', t.model],
      t.createdAt && ['Started', ago(t.createdAt)],
      ['Finished', ago(f.finishedAt)],
      ['Transcript', bytes(t.sizeBytes)],
    ].filter(Boolean)
    // Archived in the Claude app itself can only be undone there.
    const restorable = !t.archived
    card.innerHTML = `
      <div class="head">
        <canvas class="avatar" width="16" height="24"></canvas>
        <div style="min-width:0;flex:1">
          <b title="${esc(t.title)}">${esc(t.title)}</b>
          <span class="status"><span style="color:${color}">✿</span> ${esc(f.name)} · ${esc(f.workLabel)}</span>
        </div>
        <button class="btn" data-act="close" title="Close (Esc)">✕</button>
      </div>
      ${t.preview && t.preview !== t.title ? `<p class="preview">${esc(t.preview)}</p>` : ''}
      <ul class="meta">${meta.map(([k, v]) => `<li><span>${esc(k)}</span><span title="${esc(v)}">${esc(v)}</span></li>`).join('')}</ul>
      <div class="actions">
        <button class="btn primary" data-act="open" ${t.canOpen ? '' : 'disabled'}>${village.settings.openIn === 'vscode' ? 'Open in VS Code' : 'Open'}<kbd>↵</kbd></button>
        <button class="btn" data-act="transcript">Transcript<kbd>T</kbd></button>
        ${restorable ? '<button class="btn" data-act="restore" title="Bring the villager back">Restore</button>' : '<span class="note">Archived in Claude</span>'}
      </div>`
    const c = card.querySelector('canvas.avatar')
    const g = c.getContext('2d')
    g.drawImage(sprites.get(`flower.${f.kind}.2`, 0, { color }), 3, 8)
  }

  /** A pull request: what it was, who wrote it, and a way to it. Open ones are asking for you. */
  function fillPr(f) {
    const pr = f.pr
    const color = f.white ? P.petalWhite : PETALS[f.color % PETALS.length]
    const status = f.open
      ? `<span style="color:${P.glitter}">✦</span> ${pr.draft ? 'Draft PR' : 'Open PR'} #${pr.number} · waiting to merge`
      : `<span style="color:${color}">✿</span> ${esc(f.name)} · ${esc(f.workLabel)} · PR #${pr.number}`
    const meta = [
      ['Repo', f.slug],
      pr.author && ['Author', pr.author],
      pr.branch && ['Branch', pr.branch],
      f.open ? ['Opened', ago(pr.createdAt)] : ['Merged', ago(pr.mergedAt)],
      ['Changes', `+${pr.additions} −${pr.deletions}`],
      ['Labels', pr.labels.length ? pr.labels.join(', ') : 'none (white flower)'],
    ].filter(Boolean)
    card.innerHTML = `
      <div class="head">
        <canvas class="avatar" width="16" height="24"></canvas>
        <div style="min-width:0;flex:1">
          <b title="${esc(pr.title)}">${esc(pr.title)}</b>
          <span class="status">${status}</span>
        </div>
        <button class="btn" data-act="close" title="Close (Esc)">✕</button>
      </div>
      <ul class="meta">${meta.map(([k, v]) => `<li><span>${esc(k)}</span><span title="${esc(v)}">${esc(v)}</span></li>`).join('')}</ul>
      <div class="actions">
        <button class="btn primary" data-act="openPr" ${pr.url ? '' : 'disabled'}>Open PR<kbd>↵</kbd></button>
        ${f.threadId ? `<button class="btn" data-act="transcript" data-id="${esc(f.threadId)}">Transcript</button><button class="btn" data-act="openThread" data-id="${esc(f.threadId)}">Open thread</button>` : ''}
      </div>`
    const g = card.querySelector('canvas.avatar').getContext('2d')
    g.drawImage(sprites.get(`flower.${f.kind}.${f.open ? 1 : 2}`, 0, { color }), 3, 8)
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
      const f = id && village.flower(id)
      if (f?.pr) {
        const key = `pr|${f.open}|${f.pr.title}|${f.pr.labels.join()}`
        if (id !== shownId || key !== shownKey) {
          fillPr(f)
          shownId = id
          shownKey = key
        }
        card.hidden = false
        return
      }
      const t = id && village.thread(id)
      if (!t) {
        card.hidden = true
        shownId = null
        return
      }
      const flower = village.isFinished(id) ? village.flower(id) : null
      const key = `${flower ? 'f' : t.status}|${t.needsInput || ''}|${t.title}|${t.lastActivityAt}|${t.canOpen}|${village.settings.openIn}`
      if (id !== shownId || key !== shownKey) {
        if (flower) fillFinished(t, flower)
        else {
          fill(t)
          drawAvatar(village.world.villager(id))
        }
        shownId = id
        shownKey = key
      }
      card.hidden = false
    },

    /**
     * Position: called every frame. Right of a villager, flipping left rather than under the
     * sidebar; above a flower, so the card never covers the garden it is about.
     */
    place(screen, sidebarLeft, mobile, above = false, leftBound = 0) {
      if (card.hidden || !screen) return
      const w = card.offsetWidth
      const h = card.offsetHeight
      if (mobile) {
        card.style.transform = `translate(12px, ${window.innerHeight - h - 12 - (window.innerHeight * 0.45)}px)`
        return
      }
      if (above) {
        const x = Math.max(leftBound + 12, Math.min(screen.x - w / 2, sidebarLeft - w - 12))
        let y = screen.y - h - GAP * 2
        if (y < 12) y = screen.y + GAP // no room above: go below instead
        card.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`
        return
      }
      let x = screen.x + GAP
      if (x + w > sidebarLeft - 12) x = screen.x - GAP - w
      if (x < leftBound + 12) x = screen.x + GAP // don't slide under the transcript panel
      x = Math.max(leftBound + 12, Math.min(x, sidebarLeft - w - 12))
      const y = Math.max(12, Math.min(screen.y - h / 2, window.innerHeight - h - 12))
      card.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`
    },
  }
}
