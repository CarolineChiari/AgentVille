// The sidebar, the settings and help sheets, and the hint. Plain DOM with event delegation; it is
// re-rendered from `village` whenever the scan or the selection changes, never per frame.
import { esc, ago } from './dom.js'
import { ACCENTS } from '../render/sprites/palette.js'
import { formatHour } from '../render/daynight.js'
import { STATUS_LABEL, needsInputLabel } from '../sim/status.js'
import { pageTitle } from '../game/notify.js'
import { THEMES, THEME_IDS, finishedWords, landmarkWords } from '../sim/themes.js'
import { TIER_AT } from '../sim/progress.js'
import { landmarkSpotOf } from '../sim/shape.js'

const COUNT_KEYS = [
  ['working', 'Working'],
  ['waiting', 'Needs you'],
  ['blocked', 'Stuck'],
  ['done', 'Done'],
  ['openPrs', 'PRs'],
  ['openIssues', 'Issues'],
  ['idle', 'Idle'],
  ['sleeping', 'Asleep'],
]

/** Where a plot can stand its landmark in its field, as the settings put it; the ids are shape.js's. */
const SPOT_LABELS = [['top', 'At the head'], ['middle', 'In the middle'], ['bottom', 'At the foot']]

/** Tooltips for the counts that aren't a villager's status. */
const COUNT_TITLE = { openPrs: 'Open pull requests', openIssues: 'Open issues on the notice boards' }

const HELP = [
  ['N', 'Next villager who needs you (?)'],
  ['R', 'Next finished thread to review (✓)'],
  ['V', 'Mark it reviewed'],
  ['P', 'Next open PR'],
  ['I', 'Next notice board with open issues'],
  ['Enter', 'Open the selected thread'],
  ['⌫', 'Archive it'],
  ['C', 'New session (optionally with a first prompt)'],
  ['T', 'Transcript of the selected thread'],
  ['H', 'Hide the panels'],
  [',', 'Settings'],
  ['Esc', 'Deselect'],
  ['W A S D', 'Move around; hold Shift to hurry'],
  ['Drag / Arrows', 'Move around too'],
  ['Scroll / + −', 'Zoom'],
  ['0', 'Back to the square'],
]

export function createHud(root, { village, settings, onSettings, onFly, onNewSession = () => {}, onEditTasks = () => {}, canNotify = false }) {
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
  let stale = false

  const folderWord = () => (village.platform === 'win32' ? 'Explorer' : village.platform === 'darwin' ? 'Finder' : 'Folder')

  /** A sub-theme choice as an option, its blurb as the tooltip. */
  const subOption = (s, selected) => `<option value="${esc(s.id)}" title="${esc(s.blurb)}" ${selected ? 'selected' : ''}>${esc(s.label)}</option>`
  const subLabel = (theme, id) => THEMES[theme].subthemes.find((s) => s.id === id)?.label || id

  function render() {
    // Replacing the sidebar under an open dropdown would shut it; catch up once it's let go.
    if (side.querySelector('select:focus')) {
      stale = true
      return
    }
    stale = false
    const counts = { ...village.counts(), openPrs: village.openPrs().length, openIssues: village.openIssues().length }
    const repos = village.repos()
    const { folded, hidden, archived } = village.view
    const sel = village.selectedPlot
    const selRepo = repos.find((r) => r.name === sel)
    const foldedNames = [...new Set(folded.map((t) => t.project))]
    const hiddenNames = [...new Set(hidden.map((t) => t.project))]
    const total = village.view.live.length
    const bloomed = [...village.gardens.values()].reduce((n, l) => n + l.length, 0)
    const words = finishedWords(village.theme)
    // Only when it changes: the desktop app turns every title update into a dock badge call.
    const title = pageTitle(counts)
    if (document.title !== title) document.title = title

    side.innerHTML = `
      <div class="brand"><h1>AgentVille</h1><button class="btn primary new" data-act="newAny" title="Start a new session (C)">+ New session</button></div>
      <div class="brand-sub"><span class="sub">${total} villager${total === 1 ? '' : 's'} · ${bloomed} ${bloomed === 1 ? words.one : words.many}</span></div>
      <div class="counts">${COUNT_KEYS.map(([k, l]) => `<button class="${k}" data-act="status" data-status="${k}" title="${esc(STATUS_LABEL[k] || COUNT_TITLE[k] || l)}"><span class="n">${counts[k] || 0}</span><span class="l">${l}</span></button>`).join('')}</div>
      ${selRepo ? detail(selRepo) : ''}
      <div class="list">
        ${repos.length ? '' : `<p style="color:var(--muted)">${village.loaded ? 'No sessions found yet. Start one and it will walk in.' : 'Reading your sessions…'}</p>`}
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
        : 'WASD or drag to look around · scroll to zoom · click a villager'
    if (sheetMode) renderSheet()
  }

  function section(key, title, body, n) {
    if (!n) return ''
    return `<h3><button class="foot-toggle" data-act="toggle" data-key="${key}" style="all:unset;cursor:pointer">${open[key] ? '▾' : '▸'} ${title}</button></h3>${open[key] ? body : ''}`
  }

  function repoRow(r, selected) {
    const words = finishedWords(village.lookOf(r.name).theme)
    const b = []
    if (r.counts.blocked) b.push(`<span class="blocked">${r.counts.blocked} !</span>`)
    if (r.counts.waiting) b.push(`<span class="waiting">${r.counts.waiting} ?</span>`)
    if (r.counts.done) b.push(`<span class="done" title="Done, ready for review">${r.counts.done} ✓</span>`)
    if (r.counts.working) b.push(`<span class="working">${r.counts.working}</span>`)
    if (r.openPrs) b.push(`<span class="open-pr" title="Open PRs">✦ ${r.openPrs}</span>`)
    if (r.openIssues) b.push(`<span class="open-issue" title="Open issues">⚑ ${r.openIssues}</span>`)
    // The landmark's name only in the tooltip: a row has no room to spare beside the repo's own name.
    return `<button class="repo ${selected ? 'selected' : ''}" data-act="repo" data-name="${esc(r.name)}" title="${esc(`${r.name}: ${r.progress.word}`)}">
      <span class="dot" style="background:${ACCENTS[r.accent % ACCENTS.length]}"></span>
      <span class="name">${esc(r.name)}</span>
      <span class="badges">${b.join('')}${r.threads.length ? `<span title="Villagers">${r.threads.length}</span>` : ''}${r.flowers ? `<span class="flowers" title="Finished threads in the ${esc(words.place)}">${esc(words.glyph)} ${r.flowers}</span>` : ''}</span></button>`
  }

  function detail(r) {
    const words = finishedWords(village.lookOf(r.name).theme)
    return `<div class="detail">
      <div class="title"><span class="dot" style="width:10px;height:10px;border-radius:50%;background:${ACCENTS[r.accent % ACCENTS.length]}"></span><b>${esc(r.name)}</b><button class="btn" data-act="closeRepo" title="Close (Esc)">✕</button></div>
      <div class="path" title="${esc(r.path)}">${esc(r.path)}</div>
      <div class="actions">
        <button class="btn primary" data-act="new">New session<kbd>C</kbd></button>
        <button class="btn" data-act="reveal">${folderWord()}</button>
        <button class="btn" data-act="copy">Copy path</button>
        <button class="btn" data-act="tasks" title="The ready-made jobs this repo's villagers can be sent">Tasks${village.customTasks(r.name).length ? ` (${village.customTasks(r.name).length})` : ''}</button>
        <button class="btn" data-act="hide">Hide</button>
      </div>
      ${look(r.name)}
      ${landmark(r)}
      ${r.flowers ? `<div class="garden-note">${esc(words.glyph)} ${r.flowers} finished — click a ${esc(words.one)} in the ${esc(words.place)} to look back</div>` : ''}
      <div class="threads">${r.threads.map((t) => `<button class="thread-row ${t.id === village.selected ? 'selected' : ''}" data-act="thread" data-id="${esc(t.id)}"><span class="t" title="${esc(t.title)}">${esc(t.title)}</span><span class="s">${esc(needsInputLabel(t.needsInput) || STATUS_LABEL[t.status])} · ${ago(t.lastActivityAt)}</span></button>`).join('')}</div>
    </div>`
  }

  /**
   * The landmark in a plot's field: what stands there now, how far it is to the next tier, and
   * where the points came from, each kind of work on a line of its own.
   */
  function landmark(r) {
    const p = r.progress
    const words = finishedWords(village.lookOf(r.name).theme)
    const from = TIER_AT[p.tier]
    const to = TIER_AT[p.tier + 1]
    const share = to === undefined ? 1 : Math.max(0, Math.min(1, (p.points - from) / (to - from)))
    const n = (x) => x.toLocaleString()
    const mb = (bytes) => (bytes >= 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${Math.round(bytes / 1e3)} KB`)
    const lines = [
      [`${esc(words.glyph)} ${n(p.work.finished)} finished`, p.breakdown.finished],
      [`${n(p.work.sessions)} session${p.work.sessions === 1 ? '' : 's'}`, p.breakdown.sessions],
      [`${mb(p.work.bytes)} of transcripts`, p.breakdown.bytes],
      [{ counted: `${n(p.work.lines)} lines of code`, 'not a repo': 'Lines of code: not a git repo', counting: 'Lines of code: counting…', off: 'Lines of code: not counted' }[p.lines], p.breakdown.lines],
    ]
    const next = p.nextWord ? `Next: ${esc(p.nextWord)}, ${n(p.next)} more point${p.next === 1 ? '' : 's'}` : 'The top tier'
    return `<div class="landmark" title="Every finished thread counts 2, every session 1, every 250 KB of transcript 1, every 1,000 lines of code 1 (up to 50)">
      <div class="lm-head"><b>${esc(p.word)}</b><span>${n(p.points)} points</span></div>
      <div class="bar"><i style="width:${Math.round(share * 100)}%"></i></div>
      <div class="lm-next">${next}</div>
      <ul>${lines.map(([what, pts]) => `<li><span>${what}</span><span>${pts ? `+${n(pts)}` : ''}</span></li>`).join('')}</ul>
    </div>`
  }

  /**
   * A folder's look: the village's (Auto), or any sub-theme of any theme, grouped by theme. A pick
   * is `<theme>/<sub-theme>`; ids can't hold a slash, so it splits cleanly.
   */
  function look(name) {
    const pick = village.lookPick(name)
    const picked = pick ? `${pick.theme}/${pick.sub}` : ''
    const handed = village.lookHanded(name)
    const groups = THEME_IDS.map((t) => `<optgroup label="${esc(THEMES[t].label)}">${THEMES[t].subthemes.map((s) => {
      const v = `${t}/${s.id}`
      return `<option value="${esc(v)}" title="${esc(s.blurb)}" ${v === picked ? 'selected' : ''}>${esc(s.label)}</option>`
    }).join('')}</optgroup>`).join('')
    return `<label class="look" title="How this folder's plot looks: like the rest of the village, or any theme's look of its own">Look
      <select data-look="${esc(name)}"><option value="" ${picked ? '' : 'selected'}>Auto: ${esc(subLabel(handed.theme, handed.sub))}</option>${groups}</select></label>`
  }

  function renderSheet() {
    if (sheetMode === 'help') {
      sheet.innerHTML = `<h2>Keys</h2><table>${HELP.map(([k, d]) => `<tr><td>${esc(k)}</td><td>${esc(d)}</td></tr>`).join('')}</table>
        <div class="actions"><button class="btn" data-act="closeSheet">Close</button></div>`
    } else {
      const s = settings
      const theme = village.theme
      const every = s.subthemes?.[theme] || ''
      const spot = landmarkSpotOf(s.landmarkSpot)
      const place = finishedWords(theme).place
      sheet.innerHTML = `<h2>Settings</h2>
        <label>Theme
          <select data-set="theme">${THEME_IDS.map((id) => `<option value="${id}" ${id === theme ? 'selected' : ''}>${esc(THEMES[id].label)}</option>`).join('')}</select></label>
        <label title="Every folder that hasn't picked a look of its own, from its panel">Every folder
          <select data-set="everywhere"><option value="" ${every ? '' : 'selected'}>Its own look</option>${THEMES[theme].subthemes.map((x) => subOption(x, x.id === every)).join('')}</select></label>
        <label title="Where every plot stands the ${esc(landmarkWords(theme).one)} its work has raised. At the head of the ${esc(place)} it hides none of the ${esc(finishedWords(theme).many)} growing there.">Landmarks stand
          <select data-set="landmarkSpot">${SPOT_LABELS.map(([id, label]) => `<option value="${id}" ${id === spot ? 'selected' : ''}>${esc(`${label} of the ${place}`)}</option>`).join('')}</select></label>
        <label>Open Claude Code threads in
          <select data-set="openIn"><option value="vscode" ${s.openIn === 'vscode' ? 'selected' : ''}>VS Code</option><option value="app" ${s.openIn === 'app' ? 'selected' : ''}>Claude app</option></select></label>
        <label title="${canNotify ? 'A desktop notification when a villager stops on a question or an error while AgentVille is in the background' : 'This browser can’t show notifications'}">Notify me when a villager needs me <input type="checkbox" data-set="notify" ${s.notify && canNotify ? 'checked' : ''} ${canNotify ? '' : 'disabled'}></label>
        <label>${esc(finishedWords(theme).grow)} <input type="checkbox" data-set="prGardens" ${s.prGardens ? 'checked' : ''}></label>
        <label>Pin open issues on notice boards <input type="checkbox" data-set="issueBoards" ${s.issueBoards ? 'checked' : ''}></label>
        <label title="Reads the files in each repo to count its lines of code, for its landmark. Nothing is run and nothing leaves this machine.">Count the lines of code in each repo <input type="checkbox" data-set="repoLines" ${s.repoLines ? 'checked' : ''}></label>
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
      case 'tasks': onEditTasks(village.selectedPlot); break
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
        if (status === 'openIssues') {
          const id = village.nextIssueBoard()
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
    // The whole village's sub-theme is kept per theme, so switching themes back finds it again.
    if (k === 'everywhere') settings.subthemes = { ...settings.subthemes, [village.theme]: e.target.value }
    else settings[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.type === 'range' ? Number(e.target.value) : e.target.value
    onSettings(k)
    renderSheet()
  })

  side.addEventListener('change', (e) => {
    const name = e.target.dataset?.look
    if (name === undefined) return
    e.target.blur()
    const [theme, sub] = e.target.value.split('/')
    village.setLook(name, e.target.value ? { theme, sub } : null)
  })
  side.addEventListener('focusout', (e) => {
    if (stale && e.target.tagName === 'SELECT') requestAnimationFrame(render)
  })

  return { render, showSheet, get sheetOpen() { return Boolean(sheetMode) }, closeSheet: () => sheetMode && showSheet(sheetMode) }
}
