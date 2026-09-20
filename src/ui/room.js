// The panel that stands in the room with you: who lives here, and the change log — every file the
// session wrote, grouped by file or laid out in the order it happened with the commits between.
// Text reads better as DOM than on a canvas, so the room is drawn and this is written over it.
import { esc, ago, bytes, openLabel, agentName } from './dom.js'
import { STATUS_LABEL, needsInputLabel } from '../sim/status.js'

/** How often the log is read again while the session is still going. */
const LIVE_REFRESH_MS = 3000
/** Files listed before the panel offers the rest, and edits shown under one opened file. */
const FILE_PAGE = 40
const EDITS_PER_FILE = 12

const KIND_WORD = { created: 'created', edited: 'edited', deleted: 'deleted', renamed: 'renamed' }

/** The log of one file, newest last, as it happened. */
const entriesFor = (log, path) => (log.entries || []).filter((e) => e.path === path)

/**
 * The whole log in the order it happened, with each commit slotted in where it was made. A commit
 * between two edits is what turns a list of writes into a story.
 */
export function timeline(log) {
  const items = [
    ...(log.entries || []).map((e) => ({ ...e, row: 'entry' })),
    ...(log.commits || []).map((c) => ({ ...c, row: 'commit' })),
  ]
  // A commit made in the same millisecond as an edit comes after it: it is what committed it.
  return items.sort((a, b) => a.at - b.at || (a.row === 'commit' ? 1 : -1))
}

export function createRoomPanel(root, village, { onTranscript = () => {} } = {}) {
  const panel = document.createElement('div')
  panel.className = 'roompanel'
  panel.hidden = true
  root.appendChild(panel)
  let id = null
  let log = null
  let timer = null
  let view = 'files' // 'files' | 'order'
  let openPath = '' // the one file whose edits are unfolded
  let shown = FILE_PAGE
  let lastKey = ''

  panel.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]')
    if (!b) return
    const act = b.dataset.act
    if (act === 'leave') village.leave()
    else if (act === 'open') village.open(id)
    else if (act === 'transcript') onTranscript(id)
    else if (act === 'view') {
      view = b.dataset.view
      paint()
    } else if (act === 'fold') {
      openPath = openPath === b.dataset.path ? '' : b.dataset.path
      paint()
    } else if (act === 'file') village.openFile(id, b.dataset.path)
    else if (act === 'more') {
      shown += FILE_PAGE
      paint()
    }
  })

  function header(t) {
    const status = needsInputLabel(t.needsInput) || STATUS_LABEL[t.status] || ''
    return `<div class="r-head">
      <div style="min-width:0;flex:1">
        <b title="${esc(t.title)}">${esc(t.title)}</b>
        <span class="t-sub">${esc(t.project)}${status ? ` · ${esc(status)}` : ''} · ${ago(t.lastActivityAt)}</span>
      </div>
      <button class="btn primary" data-act="open" ${t.canOpen ? '' : 'disabled'}>${esc(openLabel(t, village.settings.openIn))}</button>
      <button class="btn" data-act="transcript">Transcript<kbd>T</kbd></button>
      <button class="btn" data-act="leave" title="Back outside (Esc)">Leave</button>
    </div>`
  }

  /** The facts a card is too small for. */
  function facts(t) {
    const rows = [
      ['Repo', t.project],
      ['Agent', `${t.harnessName}${t.model ? ` · ${t.model}` : ''}${t.effort ? ` · ${t.effort}` : ''}`],
      t.worktree && ['Worktree', t.worktree],
      t.gitBranch && ['Branch', t.gitBranch],
      t.createdAt && ['Started', ago(t.createdAt)],
      ['Last active', ago(t.lastActivityAt)],
      ['Transcript', bytes(t.sizeBytes)],
    ].filter(Boolean)
    return `<ul class="meta">${rows.map(([k, v]) => `<li><span>${esc(k)}</span><span title="${esc(v)}">${esc(v)}</span></li>`).join('')}</ul>`
  }

  /** One line of the log: what a tool did to a file, and the before → after it wrote. */
  const entryLine = (e) => `<div class="r-entry">
    <span class="r-kind ${esc(e.kind)}">${esc(KIND_WORD[e.kind] || e.kind)}</span>
    <span class="r-when">${e.at ? ago(e.at) : ''}</span>
    <span class="r-tool">${esc(e.tool)}</span>
    ${e.excerpt ? `<span class="r-excerpt" title="${esc(e.excerpt)}">${esc(e.excerpt)}</span>` : ''}
  </div>`

  /** Grouped by file, the file touched most recently first, each one unfolding into its own log. */
  function byFile() {
    const files = log.files || []
    if (!files.length) return '<p class="t-empty">This session hasn’t changed a file yet.</p>'
    const rows = [...files].sort((a, b) => b.at - a.at).slice(0, shown)
    return `${rows.map((f) => {
      const open = openPath === f.path
      const mine = open ? entriesFor(log, f.path).slice(-EDITS_PER_FILE) : []
      return `<div class="r-file">
        <button class="btn link r-row" data-act="fold" data-path="${esc(f.path)}" aria-expanded="${open}">
          <span class="r-arrow">${open ? '▾' : '▸'}</span>
          <span class="r-path" title="${esc(f.path)}">${esc(f.path)}</span>
          <span class="r-count">${f.edits}</span>
        </button>
        ${open ? `<div class="r-log">${mine.map(entryLine).join('')}
          <button class="btn link" data-act="file" data-path="${esc(f.path)}" ${f.outside ? 'disabled' : ''} title="${f.outside ? 'This file is outside the repo' : 'Open it in your editor'}">Open this file</button>
        </div>` : ''}
      </div>`
    }).join('')}${files.length > shown ? `<button class="btn link" data-act="more">${files.length - shown} more files</button>` : ''}`
  }

  /** Everything in the order it happened, commits and all. */
  function inOrder() {
    const items = timeline(log)
    if (!items.length) return '<p class="t-empty">Nothing written down yet.</p>'
    // The tail is the interesting end of a long session, so the newest entries are the ones kept.
    return items.slice(-shown * 2).map((it) => (it.row === 'commit'
      ? `<div class="r-commit"><span class="r-kind commit">commit</span><span class="r-when">${it.at ? ago(it.at) : ''}</span><span class="r-message">${esc(it.message || '(no message)')}</span></div>`
      : `<div class="r-file">
          <button class="btn link r-row" data-act="file" data-path="${esc(it.path)}" ${it.outside ? 'disabled' : ''}>
            <span class="r-kind ${esc(it.kind)}">${esc(KIND_WORD[it.kind] || it.kind)}</span>
            <span class="r-path" title="${esc(it.path)}">${esc(it.path)}</span>
            <span class="r-when">${it.at ? ago(it.at) : ''}</span>
          </button>
          ${it.excerpt ? `<div class="r-log"><span class="r-excerpt" title="${esc(it.excerpt)}">${esc(it.excerpt)}</span></div>` : ''}
        </div>`)).join('')
  }

  function paint() {
    const t = village.thread(id)
    if (!t) return
    const list = panel.querySelector('.r-list')
    const top = list?.scrollTop ?? 0
    const body = !log
      ? '<p class="t-empty">Reading the log…</p>'
      : !log.ok
        ? `<p class="t-empty">${esc(log.error || 'Nothing to read.')}</p>`
        : `${view === 'files' ? byFile() : inOrder()}${log.more ? `<p class="t-empty">${log.more} more not shown.</p>` : ''}`
    panel.innerHTML = `${header(t)}
      <div class="r-body">
        ${facts(t)}
        <div class="r-tabs">
          <button class="btn${view === 'files' ? ' primary' : ''}" data-act="view" data-view="files">By file${log?.files ? ` (${log.files.length})` : ''}</button>
          <button class="btn${view === 'order' ? ' primary' : ''}" data-act="view" data-view="order">In order${log?.commits?.length ? ` · ${log.commits.length} commit${log.commits.length === 1 ? '' : 's'}` : ''}</button>
        </div>
        <div class="r-list">${body}</div>
      </div>`
    const next = panel.querySelector('.r-list')
    if (next) next.scrollTop = top
  }

  async function load() {
    if (!id) return
    const t = village.thread(id)
    if (!t) return village.leave()
    const r = await village.changes(id, true)
    if (!id) return
    const key = `${r.ok}|${r.updatedAt}|${r.files?.length}|${r.entries?.length}`
    if (key !== lastKey) {
      lastKey = key
      log = r
      paint()
    }
    clearTimeout(timer)
    const live = t.status === 'working' || t.status === 'waiting' || t.status === 'blocked'
    if (live) timer = setTimeout(load, LIVE_REFRESH_MS)
  }

  return {
    /** Called whenever `village.focused` may have changed. */
    sync() {
      const next = village.focused
      if (next === id) {
        if (id) paint()
        return
      }
      id = next
      clearTimeout(timer)
      if (!id) {
        panel.hidden = true
        log = null
        return
      }
      log = null
      lastKey = ''
      view = 'files'
      openPath = ''
      shown = FILE_PAGE
      panel.hidden = false
      paint()
      load()
    },
    /** Left edge of the panel in device-independent px, so the room is centred in what's left. */
    get rightEdge() {
      return panel.hidden ? 0 : panel.getBoundingClientRect().right
    },
  }
}
