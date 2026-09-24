// The thread card: parked beside the selected villager, following it around the screen.
import { esc, ago, bytes, openLabel } from './dom.js'
import { STATUS_LABEL, needsInputLabel, transcriptProgress } from '../sim/status.js'
import { sprites } from '../render/sprites/registry.js'
import { BADGE, PALETTE as P, PETALS } from '../render/sprites/palette.js'
import { DEFAULT_THEME, finishedWords } from '../sim/themes.js'
import { NAME_MAX } from '../game/names.js'

const GAP = 18
/** Files listed in a card's Built section before it offers the rest. */
const BUILT_MAX = 6
/** What each kind of change did to the file, in one character. */
const KIND_MARK = { created: '+', edited: '·', deleted: '−', renamed: '→' }

/** Issues listed on a board's card to start with, and how many more each Load more adds. */
const ISSUE_CARD_MAX = 8
const ISSUE_CARD_STEP = 8

export function createCard(root, village, { onTranscript = () => {}, onEditTasks = () => {}, onRecruit = () => {} } = {}) {
  const card = document.createElement('div')
  card.className = 'card'
  card.hidden = true
  root.appendChild(card)
  let shownId = null
  let shownKey = ''
  let tasksOpen = false // the task list stays open across re-renders of the same thread
  let handTo = '' // on a board's card: which free villager Send goes to, kept across re-renders
  let issuesShown = ISSUE_CARD_MAX // how far down a board's issue list we've loaded, reset per board
  let builtId = null // which thread the Built section is about
  let builtAt = 0 // the activity it was read at: a thread that has moved is read again
  let built = null // the last answer, or null while it is being read
  let builtAll = false // Show all: the whole list rather than the first few
  let renaming = null // the thread whose name is being typed; the card isn't redrawn under it

  /** Swap the title for a box to type a name in. */
  function startRename() {
    const t = village.thread(village.selected)
    const b = card.querySelector('.head b')
    if (!t || !b) return
    renaming = t.id
    const input = document.createElement('input')
    input.className = 'rename'
    input.maxLength = NAME_MAX
    input.value = t.title
    input.placeholder = t.harnessTitle || t.title
    input.title = 'Enter to keep, Esc to leave it. Empty gives back the name it came with.'
    input.setAttribute('aria-label', 'Name this session')
    b.replaceWith(input)
    input.focus()
    input.select()
  }

  function endRename(keep) {
    const input = card.querySelector('input.rename')
    const id = renaming
    renaming = null
    shownKey = '' // redraw with the title back in place
    if (keep && input && id) village.rename(id, input.value)
    else village.onChange()
  }

  card.addEventListener('keydown', (e) => {
    if (!e.target.matches('input.rename')) return
    if (e.key === 'Enter') endRename(true)
    else if (e.key === 'Escape') endRename(false)
    else return
    e.preventDefault()
    e.stopPropagation()
  })

  // Clicking away keeps what was typed, as a rename in a file list does.
  card.addEventListener('focusout', (e) => {
    if (e.target.matches('input.rename') && renaming) endRename(true)
  })

  card.addEventListener('dblclick', (e) => {
    if (e.target.closest('.head b') && village.thread(village.selected) && !village.isFinished(village.selected)) startRename()
  })

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
    else if (act === 'inside') village.enter(village.selected)
    else if (act === 'close') village.select(null)
    else if (act === 'rename') startRename()
    else if (act === 'file') village.openFile(builtId, b.dataset.path)
    else if (act === 'moreFiles') {
      builtAll = true
      paintBuilt()
    } else if (act === 'openIssue') village.openIssue(b.dataset.issue)
    else if (act === 'sendIssue') village.sendIssue(b.dataset.issue, card.querySelector('select[data-f="to"]')?.value || '')
    else if (act === 'recruit') {
      const bd = village.board(village.selected)
      if (bd) onRecruit(bd.project, village.issuePrompt(b.dataset.issue))
    } else if (act === 'moreIssues') {
      const bd = village.board(village.selected)
      if (bd) {
        issuesShown += ISSUE_CARD_STEP
        const top = card.querySelector('ul.issues')?.scrollTop || 0
        fillBoard(bd)
        const list = card.querySelector('ul.issues')
        if (list) list.scrollTop = top // the refill resets it; stay where the reader was
      }
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
          <b title="${esc(t.harnessTitle ? `${t.title} — was “${t.harnessTitle}”` : t.title)}">${esc(t.title)}</b>
          <span class="status" ${statusColor ? `style="color:${statusColor}"` : ''}>${esc(needsInputLabel(t.needsInput) || STATUS_LABEL[t.status] || '')}</span>
        </div>
        <button class="btn" data-act="rename" title="Rename (or double-click the name)" aria-label="Rename">✎</button>
        <button class="btn" data-act="close" title="Close (Esc)">✕</button>
      </div>
      <ul class="meta">${meta.map(([k, v]) => `<li><span>${esc(k)}</span><span title="${esc(v)}">${esc(v)}</span></li>`).join('')}</ul>
      <div class="bar" title="How far along the transcript is"><i style="width:${Math.round(transcriptProgress(t.sizeBytes) * 100)}%"></i></div>
      <div class="actions">
        <button class="btn primary" data-act="open" ${t.canOpen ? '' : 'disabled'}>${esc(openLabel(t, village.settings.openIn))}<kbd>↵</kbd></button>
        <button class="btn" data-act="transcript">Transcript<kbd>T</kbd></button>
        <button class="btn" data-act="inside" title="Step inside and see everything it has changed">Go inside<kbd>B</kbd></button>
        ${t.unread && !t.needsInput ? '<button class="btn" data-act="viewed" title="Mark it reviewed until it does something new">Reviewed<kbd>V</kbd></button>' : ''}
        <button class="btn" data-act="tasks" aria-expanded="${tasksOpen}">Tasks ${tasksOpen ? '▴' : '▾'}</button>
        <button class="btn danger" data-act="archive">Archive<kbd>⌫</kbd></button>
      </div>
      <div class="built"><h4>Built</h4>${builtSection()}</div>
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

  /**
   * Read what the thread changed, unless we already have it for exactly this thread at exactly
   * this activity. A thread that has moved on has more to show, so it is read again; the server
   * caches on the transcript's own mtime and size, so a read that finds nothing new is cheap.
   */
  function ensureBuilt(t) {
    if (builtId === t.id && builtAt === t.lastActivityAt) return
    // A different thread: start blank. The same one, moved on: keep what is up while it re-reads.
    if (builtId !== t.id) {
      built = null
      builtAll = false
    }
    builtId = t.id
    builtAt = t.lastActivityAt
    const forId = t.id
    const forAt = t.lastActivityAt
    village.changes(t.id).then((r) => {
      // The selection moved on while this was in flight: that answer is about someone else now.
      if (builtId !== forId || builtAt !== forAt) return
      built = r
      paintBuilt()
    })
  }

  /** The files this session touched, most worked-over first. Clicking one opens it in the editor. */
  function builtSection() {
    if (!built) return '<p class="note">Reading what it changed…</p>'
    if (!built.ok) return `<p class="note">${esc(built.error || 'Nothing to read.')}</p>`
    const files = built.files || []
    if (!files.length) return '<p class="note">No files changed yet.</p>'
    const shown = builtAll ? files : files.slice(0, BUILT_MAX)
    const rest = files.length - shown.length + (built.more || 0)
    const row = (f) => {
      const why = `${f.kind} · ${f.edits} edit${f.edits === 1 ? '' : 's'} · ${ago(f.at)}${f.outside ? ' · outside this repo' : ''}`
      // A path outside the repo is shown for what it says, but there is no folder to open it under.
      // The folder is what gives way when the card is narrow; the file's own name always shows.
      const cut = f.path.lastIndexOf('/') + 1
      return `<li><button class="btn link file" data-act="file" data-path="${esc(f.path)}" title="${esc(`${f.path} — ${why}`)}" ${f.outside ? 'disabled' : ''}>
        <span class="mark">${esc(KIND_MARK[f.kind] || '·')}</span><span class="dir">${esc(f.path.slice(0, cut))}</span><span class="name">${esc(f.path.slice(cut))}</span>${f.edits > 1 ? `<span class="n">${f.edits}</span>` : ''}
      </button></li>`
    }
    return `<ul class="files">${shown.map(row).join('')}</ul>${
      rest > 0 ? `<button class="btn link" data-act="moreFiles">${rest} more</button>` : ''
    }`
  }

  /** Redraw only the Built section, so a slow read never rebuilds the card under the pointer. */
  function paintBuilt() {
    const slot = card.querySelector('.built')
    if (slot) slot.innerHTML = `<h4>Built</h4>${builtSection()}`
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
      </div>
      <div class="built"><h4>Built</h4>${builtSection()}</div>`
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
      <ul class="issues">${b.issues.slice(0, issuesShown).map(row).join('')}</ul>
      ${n > issuesShown
        ? `<button class="btn link" data-act="moreIssues">Load ${Math.min(ISSUE_CARD_STEP, n - issuesShown)} more · ${n - issuesShown} left</button>`
        : n > ISSUE_CARD_MAX ? `<button class="btn link" data-act="issuesPage">All ${n} on GitHub</button>` : ''}`
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
      // Picking something else keeps what was typed; staying put leaves the box alone while you type.
      if (renaming && (renaming !== village.selected || village.focused)) endRename(true)
      else if (renaming) return
      // Inside a building the room's own panel says everything the card would, in more room.
      if (village.focused) {
        card.hidden = true
        shownId = null
        return
      }
      const id = village.selected
      const bd = id && village.board(id)
      if (bd) {
        const key = `board|${bd.issues.map((i) => `${i.number}:${i.updatedAt}`).join()}|${bd.candidates.map((t) => `${t.id}:${t.title}`).join()}`
        if (id !== shownId || key !== shownKey) {
          if (id !== shownId) issuesShown = ISSUE_CARD_MAX
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
      ensureBuilt(t)
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
