// The transcript panel: a thread's conversation, read from its transcript on disk. Refreshes
// itself while anything is moving, and keeps you at the bottom only if you were already there.
import { esc, ago, openLabel, agentName } from './dom.js'
import { STATUS_LABEL } from '../sim/status.js'

// While the conversation is moving, the panel should read as live. A poll that finds nothing new
// costs the server a stat and a cache hit, so this is cheap even on a big transcript.
const FAST_MS = 2000
// Nothing has moved for a while: keep looking, but rarely. A panel left open on a sleeping thread
// must not poll all afternoon at speed.
const SLOW_MS = 30_000
const PAGE = 300

/**
 * How long to wait before reading the transcript again, paced by what the file is doing rather
 * than by the thread's status alone: a session the scan cannot see as a live process — one in the
 * desktop app, or in another agent — still writes, and a panel that only hurried for threads the
 * village calls "working" sat there stale while it did.
 */
export function nextDelay(prev, { changed = false, live = false } = {}) {
  if (changed || live) return FAST_MS
  return Math.min(SLOW_MS, Math.round((prev || FAST_MS) * 1.6))
}

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
  // The header and the list are their own elements: the header's "3 minutes ago" ticks on its own,
  // and rewriting the list for that alone would throw away the scroll and every unfolded thought.
  const head = document.createElement('div')
  head.className = 't-head'
  const list = document.createElement('div')
  list.className = 't-list'
  panel.append(head, list)
  root.appendChild(panel)
  let id = null
  let timer = null
  let lastHead = ''
  let lastList = ''
  let limit = PAGE
  let loadingMore = false
  let delay = FAST_MS
  let reads = 0 // only the newest read may draw: two can be in flight and finish out of order
  const opened = new Set() // reasoning you have unfolded, remembered so a refresh doesn't shut it

  panel.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]')
    if (!b) return
    if (b.dataset.act === 'close') close()
    else if (b.dataset.act === 'open') village.open(id)
    else if (b.dataset.act === 'more') {
      limit += PAGE
      loadingMore = true
      delay = FAST_MS
      load()
    }
  })

  // `toggle` doesn't bubble, so it is heard on the way down.
  panel.addEventListener(
    'toggle',
    (e) => {
      const key = e.target?.dataset?.key
      if (!key) return
      if (e.target.open) opened.add(key)
      else opened.delete(key)
    },
    true,
  )

  function header(t) {
    return `<div style="min-width:0;flex:1"><b title="${esc(t.title)}">${esc(t.title)}</b>
        <span class="t-sub">${esc(t.project)}${t.status ? ` · ${esc(STATUS_LABEL[t.status] || '')}` : ''} · ${ago(t.lastActivityAt)}</span></div>
      <button class="btn primary" data-act="open" ${t.canOpen ? '' : 'disabled'}>${esc(openLabel(t, village.settings.openIn))}</button>
      <button class="btn" data-act="close" title="Close (T)">✕</button>`
  }

  function message(m, who, key) {
    // Reasoning arrives folded: it is there to be read when you want it, not to bury the reply.
    if (m.role === 'thinking') {
      return `<details class="m think" data-key="${esc(key)}"${opened.has(key) ? ' open' : ''}><summary>Thinking<span>${m.at ? ago(m.at) : ''}</span></summary><div class="body">${formatText(m.text)}</div></details>`
    }
    if (m.role === 'tool') {
      // A command is shown as it was written; for everything else the one line says it all.
      const line = `<span class="tn">${esc(m.name)}</span>${m.code ? '' : ` ${esc(m.detail || '')}`}`
      return `<div class="m tool"><span class="line">${line}</span>${m.code ? `<pre>${esc(m.code)}</pre>` : ''}</div>`
    }
    return `<div class="m ${m.role}"><div class="who">${m.role === 'user' ? 'You' : esc(who)}<span>${m.at ? ago(m.at) : ''}</span></div><div class="body">${formatText(m.text)}</div></div>`
  }

  function body(r, t) {
    if (!r.ok) return `<p class="t-empty">${esc(r.error || 'No transcript.')}</p>`
    const who = agentName(t)
    const earlier = r.total > r.messages.length ? `<button class="btn t-more" data-act="more">Show earlier (${r.total - r.messages.length} more)</button>` : ''
    // A reasoning block's key comes from its own record, so folding it open survives both a refresh
    // and a "show earlier" that shifts everything down the list.
    const said = r.messages.map((m, i) => message(m, who, m.key || `${m.at}:${i}`)).join('')
    return earlier + (said || '<p class="t-empty">Nothing said yet.</p>')
  }

  async function load() {
    if (!id) return
    const t = village.thread(id)
    if (!t) return close()
    const mine = ++reads
    const want = id
    const r = await village.transcript(id, limit)
    // An earlier read that came back late must not draw over a newer one, or over another thread's
    // panel: a scan landing mid-read starts a second one, and the two can finish either way round.
    if (mine !== reads || want !== id) return
    const headHtml = header(t)
    if (headHtml !== lastHead) {
      lastHead = headHtml
      head.innerHTML = headHtml
    }
    const listHtml = body(r, t)
    const changed = listHtml !== lastList
    if (changed) {
      const atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 40
      const prevHeight = list.scrollHeight
      const prevTop = list.scrollTop
      lastList = listHtml
      list.innerHTML = listHtml
      // Stay pinned to the newest message if you were reading there; after "show earlier", keep the
      // message you were looking at in place; otherwise don't move under you.
      if (loadingMore) list.scrollTop = prevTop + (list.scrollHeight - prevHeight)
      else list.scrollTop = atBottom ? list.scrollHeight : prevTop
    }
    loadingMore = false
    schedule(t, changed)
  }

  function schedule(t, changed) {
    clearTimeout(timer)
    if (!id) return
    const live = t.status === 'working' || t.status === 'waiting' || t.status === 'blocked'
    delay = nextDelay(delay, { changed, live })
    timer = setTimeout(load, delay)
  }

  // A hidden tab has its timers throttled to about one a minute, so the panel you come back to is
  // as old as the tab was away. Read again the moment it is on screen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden || !id) return
    delay = FAST_MS
    load()
  })

  function open(threadId) {
    if (!threadId || !village.thread(threadId)) return
    id = threadId
    limit = PAGE
    delay = FAST_MS
    loadingMore = false
    opened.clear()
    panel.hidden = false
    lastHead = header(village.thread(id))
    head.innerHTML = lastHead
    lastList = ''
    list.innerHTML = '<p class="t-empty">Reading…</p>'
    load()
  }

  function close() {
    id = null
    reads++ // whatever is in flight is no longer wanted
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
