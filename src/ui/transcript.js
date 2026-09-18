// The transcript panel: a thread's conversation, read from its transcript on disk. Refreshes
// itself while the thread is live, and keeps you at the bottom only if you were already there.
import { esc, ago, openLabel, agentName } from './dom.js'
import { STATUS_LABEL } from '../sim/status.js'

const LIVE_REFRESH_MS = 3000
const PAGE = 300

const inline = (s) =>
  esc(s)
    .replace(/`([^`\n]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')

/** A run of `| a | b |` lines as a table; the `|---|` row marks the one above it as the header. */
function table(lines) {
  const cells = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim())
  const isRule = (l) => /^\s*\|?\s*:?-{2,}/.test(l)
  const head = lines.length > 1 && isRule(lines[1])
  const rows = lines.filter((l) => !isRule(l)).map(cells)
  return `<table>${rows.map((r, i) => `<tr>${r.map((c) => (head && i === 0 ? `<th>${inline(c)}</th>` : `<td>${inline(c)}</td>`)).join('')}</tr>`).join('')}</table>`
}

/** Just enough formatting to read a reply: code fences, tables, inline code, bold. All escaped first. */
export function formatText(text) {
  const parts = String(text).split(/```[^\n]*\n?/)
  return parts
    .map((p, i) => {
      if (i % 2) return `<pre>${esc(p.replace(/\n$/, ''))}</pre>`
      const out = []
      let rows = []
      const flush = () => {
        if (rows.length) out.push(rows.length > 1 ? table(rows) : inline(rows[0]) + '<br>')
        rows = []
      }
      for (const line of p.split('\n')) {
        if (/^\s*\|.*\|\s*$/.test(line)) rows.push(line)
        else {
          flush()
          out.push(inline(line) + '<br>')
        }
      }
      flush()
      return out.join('').replace(/(<br>)+$/, '')
    })
    .join('')
}

export function createTranscript(root, village) {
  const panel = document.createElement('div')
  panel.className = 'transcript'
  panel.hidden = true
  root.appendChild(panel)
  let id = null
  let timer = null
  let lastKey = ''
  let limit = PAGE
  let loadingMore = false

  panel.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]')
    if (!b) return
    if (b.dataset.act === 'close') close()
    else if (b.dataset.act === 'open') village.open(id)
    else if (b.dataset.act === 'more') {
      limit += PAGE
      lastKey = ''
      loadingMore = true
      load()
    }
  })

  function header(t) {
    return `<div class="t-head">
      <div style="min-width:0;flex:1"><b title="${esc(t.title)}">${esc(t.title)}</b>
        <span class="t-sub">${esc(t.project)}${t.status ? ` · ${esc(STATUS_LABEL[t.status] || '')}` : ''} · ${ago(t.lastActivityAt)}</span></div>
      <button class="btn primary" data-act="open" ${t.canOpen ? '' : 'disabled'}>${esc(openLabel(t, village.settings.openIn))}</button>
      <button class="btn" data-act="close" title="Close (T)">✕</button>
    </div>`
  }

  function message(m, who) {
    if (m.role === 'tool') return `<div class="m tool"><span class="tn">${esc(m.name)}</span> ${esc(m.detail || '')}</div>`
    return `<div class="m ${m.role}"><div class="who">${m.role === 'user' ? 'You' : esc(who)}<span>${m.at ? ago(m.at) : ''}</span></div><div class="body">${formatText(m.text)}</div></div>`
  }

  async function load() {
    if (!id) return
    const t = village.thread(id)
    if (!t) return close()
    const r = await village.transcript(id, limit)
    if (id !== t.id) return
    const key = `${r.ok}|${r.total}|${r.updatedAt}|${t.status}|${limit}`
    if (key === lastKey) return schedule(t)
    lastKey = key
    const list = panel.querySelector('.t-list')
    const atBottom = !list || list.scrollHeight - list.scrollTop - list.clientHeight < 40
    const prevHeight = list?.scrollHeight ?? 0
    const prevTop = list?.scrollTop ?? 0
    panel.innerHTML = `${header(t)}<div class="t-list">${
      !r.ok
        ? `<p class="t-empty">${esc(r.error || 'No transcript.')}</p>`
        : `${r.total > r.messages.length ? `<button class="btn t-more" data-act="more">Show earlier (${r.total - r.messages.length} more)</button>` : ''}${r.messages.map((m) => message(m, agentName(t))).join('') || '<p class="t-empty">Nothing said yet.</p>'}`
    }</div>`
    const next = panel.querySelector('.t-list')
    // Stay pinned to the newest message if you were reading there; after "show earlier", keep the
    // message you were looking at in place; otherwise don't move under you.
    if (loadingMore) next.scrollTop = prevTop + (next.scrollHeight - prevHeight)
    else next.scrollTop = atBottom ? next.scrollHeight : prevTop
    loadingMore = false
    schedule(t)
  }

  function schedule(t) {
    clearTimeout(timer)
    const live = t.status === 'working' || t.status === 'waiting' || t.status === 'blocked'
    if (id && live) timer = setTimeout(load, LIVE_REFRESH_MS)
  }

  function open(threadId) {
    if (!threadId || !village.thread(threadId)) return
    id = threadId
    limit = PAGE
    lastKey = ''
    panel.hidden = false
    panel.innerHTML = `${header(village.thread(id))}<div class="t-list"><p class="t-empty">Reading…</p></div>`
    load()
  }

  function close() {
    id = null
    clearTimeout(timer)
    panel.hidden = true
  }

  return {
    open,
    close,
    toggle: (threadId) => (id && id === threadId ? close() : open(threadId)),
    get openId() {
      return id
    },
    /** Right edge of the panel in CSS px, or 0 when closed: the map and the card keep clear of it. */
    get rightEdge() {
      return panel.hidden ? 0 : panel.getBoundingClientRect().right
    },
    /** The scan changed: refresh the header and pick up anything new. */
    refresh: () => id && load(),
  }
}
