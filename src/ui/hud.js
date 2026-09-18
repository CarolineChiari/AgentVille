// The sidebar, the settings and help sheets, and the hint. Plain DOM with event delegation; it is
// re-rendered from `village` whenever the scan or the selection changes, never per frame.
import { esc, ago } from './dom.js'
import { ACCENTS } from '../render/sprites/palette.js'
import { formatHour } from '../render/daynight.js'
import { STATUS_LABEL, needsInputLabel } from '../sim/status.js'

const COUNT_KEYS = [
  ['working', 'Working'],
  ['waiting', 'Needs you'],
  ['blocked', 'Stuck'],
  ['done', 'Done'],
  ['openPrs', 'PRs'],
  ['idle', 'Idle'],
  ['sleeping', 'Asleep'],
]

const HELP = [
  ['N', 'Next villager who needs you (?)'],
  ['R', 'Next finished thread to review (✓)'],
  ['V', 'Mark it reviewed'],
  ['P', 'Next open PR'],
  ['Enter', 'Open the selected thread'],
  ['A', 'Archive it'],
  ['C', 'New session (optionally with a first prompt)'],
  ['T', 'Transcript of the selected thread'],
  ['H', 'Hide the panels'],
  ['S', 'Settings'],
  ['Esc', 'Deselect'],
  ['Drag', 'Move around'],
  ['Scroll / + −', 'Zoom'],
  ['Arrows', 'Pan'],
  ['0', 'Back to the square'],
]

export function createHud(root, { village, settings, onSettings, onFly, onNewSession = () => {} }) {
  const side = document.createElement('div')
  side.className = 'side'
  const sheet = document.createElement('div')
  sheet.className = 'sheet'
  sheet.hidden = true
  const hint = document.createElement('div')
  hint.className = 'hint'
  root.append(side, sheet, hint)
  const open = { archived: false, hidden: true, folded: false }
  let sheetMode = null

  const folderWord = () => (village.platform === 'win32' ? 'Explorer' : village.platform === 'darwin' ? 'Finder' : 'Folder')

  function render() {
    const counts = { ...village.counts(), openPrs: village.openPrs().length }
    const repos = village.repos()
    const { folded, hidden, archived } = village.view
    const sel = village.selectedPlot
    const selRepo = repos.find((r) => r.name === sel)
    const foldedNames = [...new Set(folded.map((t) => t.project))]
    const hiddenNames = [...new Set(hidden.map((t) => t.project))]
    const total = village.view.live.length
    const bloomed = [...village.gardens.values()].reduce((n, l) => n + l.length, 0)

    side.innerHTML = `
      <div class="brand"><h1>AgentVille</h1><button class="btn primary new" data-act="newAny" title="Start a new Claude Code session (C)">+ New session</button></div>
      <div class="brand-sub"><span class="sub">${total} villager${total === 1 ? '' : 's'} · ${bloomed} flower${bloomed === 1 ? '' : 's'}</span></div>
      <div class="counts">${COUNT_KEYS.map(([k, l]) => `<button class="${k}" data-act="status" data-status="${k}" title="${esc(STATUS_LABEL[k])}"><span class="n">${counts[k] || 0}</span><span class="l">${l}</span></button>`).join('')}</div>
      ${selRepo ? detail(selRepo) : ''}
      <div class="list">
        ${repos.length ? '' : `<p style="color:var(--muted)">${village.loaded ? 'No sessions found yet. Start one in Claude Code and it will walk in.' : 'Reading your sessions…'}</p>`}
        ${repos.map((r) => repoRow(r, r.name === sel)).join('')}
        ${section('folded', `Resting (${foldedNames.length})`, foldedNames.map((n) => `<button class="repo" data-act="wake" data-name="${esc(n)}" title="Every thread here has been quiet for three days"><span class="dot" style="background:var(--muted)"></span><span class="name">${esc(n)}</span></button>`).join(''), foldedNames.length)}
        ${section('hidden', `Hidden (${hiddenNames.length})`, hiddenNames.map((n) => `<button class="repo" data-act="unhide" data-name="${esc(n)}"><span class="dot" style="background:var(--muted)"></span><span class="name">${esc(n)}</span><span class="badges"><span>Show</span></span></button>`).join(''), hiddenNames.length)}
        ${section('archived', `Archived (${archived.length})`, archived.slice(0, 60).map((t) => `<button class="thread-row" data-act="unarchive" data-id="${esc(t.id)}" title="Bring back"><span class="t">${esc(t.title)}</span><span class="s">${esc(t.project)}</span></button>`).join(''), archived.length)}
      </div>
      <div class="foot">
        <button data-act="settings">Settings</button>
        <button data-act="help">Keys</button>
        <span class="spacer"></span>
        <span>${village.demo ? 'Demo' : village.harnesses.filter((h) => h.detected).map((h) => esc(h.name)).join(', ') || 'No harness found'}</span>
      </div>`
    hint.hidden = Boolean(village.selected || village.selectedPlot)
    hint.textContent = counts.waiting || counts.blocked
      ? 'Press N to visit whoever needs you'
      : counts.done
        ? 'Press R to review finished work'
        : 'Drag to look around · scroll to zoom · click a villager'
    if (sheetMode) renderSheet()
  }

  function section(key, title, body, n) {
    if (!n) return ''
    return `<h3><button class="foot-toggle" data-act="toggle" data-key="${key}" style="all:unset;cursor:pointer">${open[key] ? '▾' : '▸'} ${title}</button></h3>${open[key] ? body : ''}`
  }

  function repoRow(r, selected) {
    const b = []
    if (r.counts.blocked) b.push(`<span class="blocked">${r.counts.blocked} !</span>`)
    if (r.counts.waiting) b.push(`<span class="waiting">${r.counts.waiting} ?</span>`)
    if (r.counts.done) b.push(`<span class="done" title="Done, ready for review">${r.counts.done} ✓</span>`)
    if (r.counts.working) b.push(`<span class="working">${r.counts.working}</span>`)
    if (r.openPrs) b.push(`<span class="open-pr" title="Open PRs">✦ ${r.openPrs}</span>`)
    return `<button class="repo ${selected ? 'selected' : ''}" data-act="repo" data-name="${esc(r.name)}">
      <span class="dot" style="background:${ACCENTS[r.accent % ACCENTS.length]}"></span>
      <span class="name">${esc(r.name)}</span>
      <span class="badges">${b.join('')}${r.threads.length ? `<span title="Villagers">${r.threads.length}</span>` : ''}${r.flowers ? `<span class="flowers" title="Finished threads in the garden">✿ ${r.flowers}</span>` : ''}</span></button>`
  }

  function detail(r) {
    return `<div class="detail">
      <div class="title"><span class="dot" style="width:10px;height:10px;border-radius:50%;background:${ACCENTS[r.accent % ACCENTS.length]}"></span><b>${esc(r.name)}</b><button class="btn" data-act="closeRepo" title="Close (Esc)">✕</button></div>
      <div class="path" title="${esc(r.path)}">${esc(r.path)}</div>
      <div class="actions">
        <button class="btn primary" data-act="new">New session<kbd>C</kbd></button>
        <button class="btn" data-act="reveal">${folderWord()}</button>
        <button class="btn" data-act="copy">Copy path</button>
        <button class="btn" data-act="hide">Hide</button>
      </div>
      ${r.flowers ? `<div class="garden-note">✿ ${r.flowers} finished — click a flower in the garden to look back</div>` : ''}
      <div class="threads">${r.threads.map((t) => `<button class="thread-row ${t.id === village.selected ? 'selected' : ''}" data-act="thread" data-id="${esc(t.id)}"><span class="t" title="${esc(t.title)}">${esc(t.title)}</span><span class="s">${esc(needsInputLabel(t.needsInput) || STATUS_LABEL[t.status])} · ${ago(t.lastActivityAt)}</span></button>`).join('')}</div>
    </div>`
  }

  function renderSheet() {
    if (sheetMode === 'help') {
      sheet.innerHTML = `<h2>Keys</h2><table>${HELP.map(([k, d]) => `<tr><td>${esc(k)}</td><td>${esc(d)}</td></tr>`).join('')}</table>
        <div class="actions"><button class="btn" data-act="closeSheet">Close</button></div>`
    } else {
      const s = settings
      sheet.innerHTML = `<h2>Settings</h2>
        <label>Open threads in
          <select data-set="openIn"><option value="vscode" ${s.openIn === 'vscode' ? 'selected' : ''}>VS Code</option><option value="app" ${s.openIn === 'app' ? 'selected' : ''}>Claude app</option></select></label>
        <label>Grow flowers from pull requests <input type="checkbox" data-set="prGardens" ${s.prGardens ? 'checked' : ''}></label>
        <label>Fold away repos asleep for 3 days <input type="checkbox" data-set="hideDormant" ${s.hideDormant ? 'checked' : ''}></label>
        <label>Only name busy plots <input type="checkbox" data-set="quietNames" ${s.quietNames ? 'checked' : ''}></label>
        <label>Time of day
          <select data-set="timeMode"><option value="live" ${s.timeMode === 'live' ? 'selected' : ''}>Follow my clock</option><option value="manual" ${s.timeMode === 'manual' ? 'selected' : ''}>Set by hand</option></select></label>
        ${s.timeMode === 'manual' ? `<label>${formatHour(s.hour)} <input type="range" min="0" max="23.75" step="0.25" value="${s.hour}" data-set="hour"></label>` : ''}
        <div class="actions"><button class="btn" data-act="closeSheet">Close</button></div>`
    }
  }

  function showSheet(mode) {
    sheetMode = sheetMode === mode ? null : mode
    sheet.hidden = !sheetMode
    if (sheetMode) renderSheet()
  }

  side.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]')
    if (!b) return
    const { act, name, id, key, status } = b.dataset
    switch (act) {
      case 'repo': village.selectPlot(name === village.selectedPlot ? null : name); onFly({ plot: name }); break
      case 'closeRepo': village.selectPlot(null); break
      case 'thread': village.select(id); onFly({ villager: id }); break
      case 'new': onNewSession(village.selectedPlot); break
      case 'newAny': onNewSession(village.selectedPlot); break
      case 'reveal': village.reveal(); break
      case 'copy': village.copyPath(); break
      case 'hide': village.hide(); break
      case 'unhide': village.unhide(name); break
      case 'unarchive': village.unarchive(id); break
      case 'wake': settings.hideDormant = false; onSettings(); break
      case 'toggle': open[key] = !open[key]; render(); break
      case 'settings': showSheet('settings'); break
      case 'help': showSheet('help'); break
      case 'status': {
        if (status === 'done') {
          const id = village.nextDone()
          if (id) onFly({ villager: id })
          break
        }
        if (status === 'openPrs') {
          const id = village.nextOpenPr()
          if (id) onFly({ villager: id })
          break
        }
        if (status === 'waiting' || status === 'blocked') {
          const v = village.nextWaiting()
          if (v) onFly({ villager: v })
        } else {
          const t = village.view.live.find((x) => x.status === status)
          if (t) { village.select(t.id); onFly({ villager: t.id }) }
        }
        break
      }
    }
  })

  sheet.addEventListener('click', (e) => {
    if (e.target.closest('[data-act="closeSheet"]')) showSheet(sheetMode)
  })
  sheet.addEventListener('input', (e) => {
    const k = e.target.dataset.set
    if (!k) return
    settings[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.type === 'range' ? Number(e.target.value) : e.target.value
    onSettings()
    renderSheet()
  })

  return { render, showSheet, get sheetOpen() { return Boolean(sheetMode) }, closeSheet: () => sheetMode && showSheet(sheetMode) }
}
