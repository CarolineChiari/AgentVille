// The thread card: parked beside the selected villager, following it around the screen.
import { esc, ago, bytes, openLabel } from './dom.js'
import { STATUS_LABEL, needsInputLabel, transcriptProgress } from '../sim/status.js'
import { sprites } from '../render/sprites/registry.js'
import { BADGE, PALETTE as P, PETALS } from '../render/sprites/palette.js'
import { DEFAULT_THEME, finishedWords } from '../sim/themes.js'

const GAP = 18
/** Issues listed on a board's card; the rest are a link away on GitHub. */
const ISSUE_CARD_MAX = 8

export function createCard(root, village, { onTranscript = () => {}, onEditTasks = () => {}, onRecruit = () => {} } = {}) {
  const card = document.createElement('div')
  card.className = 'card'
  card.hidden = true
  root.appendChild(card)
  let shownId = null
  let shownKey = ''
  let tasksOpen = false // the task list stays open across re-renders of the same thread
  let handTo = '' // on a board's card: which free villager Send goes to, kept across re-renders

  card.addEventListener('change', (e) => {
    if (e.target.matches('select[data-f="to"]')) handTo = e.target.value
  })

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
    else if (act === 'openIssue') village.openIssue(b.dataset.issue)
    else if (act === 'sendIssue') village.sendIssue(b.dataset.issue, card.querySelector('select[data-f="to"]')?.value || '')
    else if (act === 'recruit') {
      const bd = village.board(village.selected)
      if (bd) onRecruit(bd.project, village.issuePrompt(b.dataset.issue))
    } else if (act === 'issuesPage') {
      const bd = village.board(village.selected)
      if (bd) village.openIssuesPage(bd.project)
    } else if (act === 'tasks') {
      tasksOpen = !tasksOpen
      const t = village.thread(village.selected)
      if (t) {
        fill(t)
        drawAvatar(village.world.villager(village.selected))
      }
    } else if (act === 'editTasks') {
      const t = village.thread(village.selected)
      if (t) onEditTasks(t.project)
    } else if (act === 'task') {
      tasksOpen = false
      village.runTask(village.selected, b.dataset.task)
      shownKey = '' // redraw without the list on the next update
    }
  })

  function fill(t) {
    const statusColor = { waiting: BADGE.waiting, blocked: BADGE.blocked, working: BADGE.working, done: BADGE.done, celebrating: BADGE.party }[t.status]
    const meta = [
      ['Repo', t.project],
      village.harnesses.filter((h) => h.detected).length > 1 && ['Agent', t.harnessName],
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
        <button class="btn primary" data-act="open" ${t.canOpen ? '' : 'disabled'}>${esc(openLabel(t, village.settings.openIn))}<kbd>↵</kbd></button>
        <button class="btn" data-act="transcript">Transcript<kbd>T</kbd></button>
        ${t.unread && !t.needsInput ? '<button class="btn" data-act="viewed" title="Mark it reviewed until it does something new">Reviewed<kbd>V</kbd></button>' : ''}
        <button class="btn" data-act="tasks" aria-expanded="${tasksOpen}">Tasks ${tasksOpen ? '▴' : '▾'}</button>
        <button class="btn danger" data-act="archive">Archive<kbd>A</kbd></button>
      </div>
      ${tasksOpen ? taskList(t) : ''}`
  }

  /** The ready-made tasks, or why there are none right now. */
  function taskList(t) {
    if (t.running || t.needsInput) return '<p class="tasks note">Busy right now. Tasks can go once it stops.</p>'
    // Only Claude Code's CLI resumes a thread with a prompt; the server falls back to a new session.
    const how = t.harness === 'claude-code'
      ? 'Continues this conversation in a terminal, or starts a new session here if it can’t.'
      : `Starts a new ${esc(t.harnessName || 'agent')} session in this folder.`
    return `<div class="tasks">
      ${village.tasksFor(t.project).map((x) => `<button class="btn${x.id.startsWith('c-') ? ' custom' : ''}" data-act="task" data-task="${esc(x.id)}" title="${esc(x.prompt)}">${esc(x.label)}</button>`).join('')}
      <button class="btn link" data-act="editTasks" title="Add tasks of your own for ${esc(t.project)}">+ Edit tasks</button>
      <p class="note">${how}</p>
    </div>`
  }

  /** Sprite params in a flower's own plot's theme, so a card shows what the plot shows. */
  const themed = (p, theme) => (theme === DEFAULT_THEME ? p : { ...p, theme })

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
    // Archived in the harness's own app can only be undone there.
    const restorable = !t.archived
    card.innerHTML = `
      <div class="head">
        <canvas class="avatar" width="16" height="24"></canvas>
        <div style="min-width:0;flex:1">
          <b title="${esc(t.title)}">${esc(t.title)}</b>
          <span class="status"><span style="color:${color}">${esc(finishedWords(f.theme).glyph)}</span> ${esc(f.name)} · ${esc(f.workLabel)}</span>
        </div>
        <button class="btn" data-act="close" title="Close (Esc)">✕</button>
      </div>
      ${t.preview && t.preview !== t.title ? `<p class="preview">${esc(t.preview)}</p>` : ''}
      <ul class="meta">${meta.map(([k, v]) => `<li><span>${esc(k)}</span><span title="${esc(v)}">${esc(v)}</span></li>`).join('')}</ul>
      <div class="actions">
        <button class="btn primary" data-act="open" ${t.canOpen ? '' : 'disabled'}>${esc(openLabel(t, village.settings.openIn))}<kbd>↵</kbd></button>
        <button class="btn" data-act="transcript">Transcript<kbd>T</kbd></button>
        ${restorable ? '<button class="btn" data-act="restore" title="Bring the villager back">Restore</button>' : `<span class="note">Archived in ${esc(t.harnessName || 'Claude')}</span>`}
      </div>`
    const c = card.querySelector('canvas.avatar')
    const g = c.getContext('2d')
    g.drawImage(sprites.get(`flower.${f.kind}.2`, 0, themed({ color }, f.theme)), 3, 8)
  }

  /** A pull request: what it was, who wrote it, and a way to it. Open ones are asking for you. */
  function fillPr(f) {
    const pr = f.pr
    const color = f.white ? P.petalWhite : PETALS[f.color % PETALS.length]
    const words = finishedWords(f.theme)
    const status = f.open
      ? `<span style="color:${P.glitter}">✦</span> ${pr.draft ? 'Draft PR' : 'Open PR'} #${pr.number} · waiting to merge`
      : `<span style="color:${color}">${esc(words.glyph)}</span> ${esc(f.name)} · ${esc(f.workLabel)} · PR #${pr.number}`
    const meta = [
      ['Repo', f.slug],
      pr.author && ['Author', pr.author],
      pr.branch && ['Branch', pr.branch],
      f.open ? ['Opened', ago(pr.createdAt)] : ['Merged', ago(pr.mergedAt)],
      ['Changes', `+${pr.additions} −${pr.deletions}`],
      ['Labels', pr.labels.length ? pr.labels.join(', ') : `none (white ${words.one})`],
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
    g.drawImage(sprites.get(`flower.${f.kind}.${f.open ? 1 : 2}`, 0, themed({ color }, f.theme)), 3, 8)
  }

  /**
   * A notice board: the repo's open issues, newest first, each one a job to hand out. Send gives it
   * to a villager already on the repo; Recruit starts a new one with the issue as its first prompt.
   */
  function fillBoard(b) {
    const n = b.issues.length
    const free = b.candidates
    if (!free.some((t) => t.id === handTo)) handTo = free[0]?.id || ''
    const who = free.length > 1
      ? `<label class="hand-to">Send to <select data-f="to">${free.map((t) => `<option value="${esc(t.id)}" ${t.id === handTo ? 'selected' : ''}>${esc(t.title)}</option>`).join('')}</select></label>`
      : free.length === 1
        ? `<p class="note">Send goes to “${esc(free[0].title)}”.</p>`
        : `<p class="note">Nobody on ${esc(b.project)} is free right now. Recruit a villager to take one on.</p>`
    const sendTitle = free.length ? 'Hand this issue to a villager already on this repo' : 'Nobody here is free'
    const row = (i) => {
      const sub = [i.author && `by ${i.author}`, `opened ${ago(i.createdAt)}`, i.labels.length && i.labels.join(', '), i.assignees.length && `→ ${i.assignees.join(', ')}`].filter(Boolean)
      return `<li class="issue">
        <div class="line"><span class="num">#${i.number}</span> <span class="title" title="${esc(i.title)}">${esc(i.title)}</span></div>
        <div class="sub" title="${esc(sub.join(' · '))}">${esc(sub.join(' · '))}</div>
        <div class="acts">
          <button class="btn" data-act="openIssue" data-issue="${esc(i.id)}" ${i.url ? '' : 'disabled'}>Open</button>
          <button class="btn" data-act="sendIssue" data-issue="${esc(i.id)}" title="${sendTitle}" ${free.length ? '' : 'disabled'}>Send</button>
          <button class="btn" data-act="recruit" data-issue="${esc(i.id)}" title="Start a new session on this repo with the issue as its first prompt">Recruit</button>
        </div>
      </li>`
    }
    card.innerHTML = `
      <div class="head">
        <canvas class="avatar" width="16" height="24"></canvas>
        <div style="min-width:0;flex:1">
          <b title="${esc(b.slug)}">${esc(b.project)}</b>
          <span class="status"><span style="color:${P.pin}">⚑</span> ${n} open issue${n === 1 ? '' : 's'}</span>
        </div>
        <button class="btn" data-act="close" title="Close (Esc)">✕</button>
      </div>
      ${who}
      <ul class="issues">${b.issues.slice(0, ISSUE_CARD_MAX).map(row).join('')}</ul>
      ${n > ISSUE_CARD_MAX ? `<button class="btn link" data-act="issuesPage">+${n - ISSUE_CARD_MAX} more on GitHub</button>` : ''}`
    const g = card.querySelector('canvas.avatar').getContext('2d')
    g.drawImage(sprites.get(`static.board.${Math.min(6, n)}`), 0, 1)
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
      const bd = id && village.board(id)
      if (bd) {
        const key = `board|${bd.issues.map((i) => `${i.number}:${i.updatedAt}`).join()}|${bd.candidates.map((t) => `${t.id}:${t.title}`).join()}`
        if (id !== shownId || key !== shownKey) {
          fillBoard(bd)
          shownId = id
          shownKey = key
        }
        card.hidden = false
        return
      }
      const f = id && village.flower(id)
      if (f?.pr) {
        const key = `pr|${f.open}|${f.pr.title}|${f.pr.labels.join()}|${f.theme}`
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
      const key = `${flower ? `f:${flower.theme}` : t.status}|${t.unread}|${t.needsInput || ''}|${t.title}|${t.lastActivityAt}|${t.canOpen}|${village.settings.openIn}|${JSON.stringify(village.customTasks(t.project))}`
      if (id !== shownId || key !== shownKey) {
        if (id !== shownId) tasksOpen = false
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
