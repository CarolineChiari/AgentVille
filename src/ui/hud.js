// The sidebar, the settings and help sheets, and the hint. Plain DOM with event delegation; it is
// re-rendered from `village` whenever the scan or the selection changes, never per frame.
import { esc, ago } from './dom.js'
import { ACCENTS, PALETTE as P } from '../render/sprites/palette.js'
import { formatHour } from '../render/daynight.js'
import { STATUS_LABEL, needsInputLabel } from '../sim/status.js'
import { pageTitle } from '../game/notify.js'
import { THEMES, THEME_IDS, finishedWords, landmarkWords } from '../sim/themes.js'
import { HOLIDAYS, activeHoliday, nextHoliday, ticked, todayOf, ymd } from '../sim/calendar.js'
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

/**
 * Where a plot can stand its landmark in its field; the ids are shape.js's. Short: the field is
 * named in the label beside the picker, and a theme can call it a setting-out yard or a lantern
 * grove, which spilled a picker that spelled the whole thing out.
 */
const SPOT_LABELS = [['top', 'At the head'], ['middle', 'In the middle'], ['bottom', 'At the foot']]
const spotLabel = (id) => (SPOT_LABELS.find(([s]) => s === id) || SPOT_LABELS[0])[1]

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
  ['B', 'Step inside its building (Esc comes back out)'],
  ['G', 'Put it in a group'],
  ['F', 'Next spotlit villager (the big marker over its head)'],
  ['H', 'Hide the panels'],
  [',', 'Settings'],
  ['Esc', 'Deselect'],
  ['W A S D', 'Move around; hold Shift to hurry'],
  ['Drag / Arrows', 'Move around too'],
  ['Scroll / + −', 'Zoom'],
  ['0', 'Back to the square'],
]

// Shown once on first run, and again from Keys. Plain words: the badges mean the same in every theme.
const TOUR = [
  { title: 'Welcome to the village', body: '<p>Every Claude Code (or other harness) session is a villager, and every repo is a plot. New sessions walk in through the square in the middle. Click a villager to see its card.</p>' },
  { title: 'What the badges mean', body: '<p>A <b>?</b> over a villager’s head means it is waiting on you. A lit window means it is working right now. Finished work blooms as flowers, and a PR waits in the garden. N jumps to the next villager who needs you.</p>' },
  { title: 'Getting around', body: '<p>Drag, or use WASD or the arrow keys, to move; scroll to zoom; 0 returns to the square. Press ? any time for every key.</p>' },
]
let tourStep = 0

export function createHud(root, { village, settings, onSettings, onFly, onNewSession = () => {}, onEditTasks = () => {}, onEditGroups = () => {}, onShowPanels = () => {}, canNotify = false }) {
  const side = document.createElement('div')
  side.className = 'side'
  const sheet = document.createElement('div')
  sheet.className = 'sheet'
  sheet.hidden = true
  const hint = document.createElement('div')
  hint.className = 'hint'
  // Only seen while H has hidden the panels (see styles.css): hidden, nothing else says where they went.
  const back = document.createElement('button')
  back.className = 'panels-back'
  back.textContent = 'Press H to see sessions again'
  back.addEventListener('click', () => onShowPanels())
  root.append(side, sheet, hint, back)
  const open = { archived: false, hidden: true, folded: false }
  // A repo's groups folded away in its panel, as `<repo>/<group id>`: a group id can't hold a slash.
  const foldedGroups = new Set()
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
    const release = village.release
    // Only when it changes: the desktop app turns every title update into a dock badge call.
    const title = pageTitle(counts)
    if (document.title !== title) document.title = title

    side.innerHTML = `
      <div class="brand"><h1>AgentVille</h1><button class="btn primary new" data-act="newAny" title="Start a new session (C)">+ New session</button></div>
      <div class="brand-sub"><span class="sub">${total} villager${total === 1 ? '' : 's'} · ${bloomed} ${bloomed === 1 ? words.one : words.many}</span></div>
      <div class="counts">${COUNT_KEYS.map(([k, l]) => `<button class="${k}" data-act="status" data-status="${k}" title="${esc(STATUS_LABEL[k] || COUNT_TITLE[k] || l)}"><span class="n">${counts[k] || 0}</span><span class="l">${l}</span></button>`).join('')}</div>
      ${selRepo ? detail(selRepo) : ''}
      <div class="list">
        ${repos.length ? '' : emptyState()}
        ${repos.map((r) => repoRow(r, r.name === sel)).join('')}
        ${section('folded', `Resting (${foldedNames.length})`, foldedNames.map((n) => `<button class="repo" data-act="wake" data-name="${esc(n)}" title="Every thread here has been quiet for three days"><span class="dot" style="background:var(--muted)"></span><span class="name">${esc(n)}</span></button>`).join(''), foldedNames.length)}
        ${section('hidden', `Hidden (${hiddenNames.length})`, hiddenNames.map((n) => `<button class="repo" data-act="unhide" data-name="${esc(n)}"><span class="dot" style="background:var(--muted)"></span><span class="name">${esc(n)}</span><span class="badges"><span>Show</span></span></button>`).join(''), hiddenNames.length)}
        ${section('archived', `Archived (${archived.length})`, archived.slice(0, 60).map((t) => `<button class="thread-row" data-act="unarchive" data-id="${esc(t.id)}" title="Bring back"><span class="t">${esc(t.title)}</span><span class="s">${esc(t.project)}</span></button>`).join(''), archived.length)}
      </div>
      <div class="foot">
        <button data-act="settings">Settings</button>
        <button data-act="help">Keys</button>
        <span class="spacer"></span>
        ${release.newer ? `<button class="update" data-act="update" title="${esc(`You are running ${release.current}. Open the release notes.`)}">${esc(release.latest)} available</button>` : ''}
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
        ${repoButton(r.name)}
        <button class="btn" data-act="copy">Copy path</button>
        <button class="btn" data-act="tasks" title="The ready-made jobs this repo's villagers can be sent">Tasks${village.customTasks(r.name).length ? ` (${village.customTasks(r.name).length})` : ''}</button>
        <button class="btn" data-act="groups" title="Put this repo's sessions in groups: each group's houses stand together and fly its flag">Groups${r.groups.length ? ` (${r.groups.length})` : ''}</button>
        <button class="btn" data-act="hide">Hide</button>
      </div>
      ${look(r.name)}
      ${spotPicker(r.name)}
      ${landmark(r)}
      ${r.flowers ? `<div class="garden-note">${esc(words.glyph)} ${r.flowers} finished — click a ${esc(words.one)} in the ${esc(words.place)} to look back</div>` : ''}
      <div class="threads">${threadList(r)}</div>
    </div>`
  }

  /** Open repo, for a folder whose origin is on GitHub; nothing for one that isn't, or not yet known. */
  function repoButton(name) {
    const slug = village.githubRepo(name)
    return slug ? `<button class="btn" data-act="openRepo" title="${esc(`${slug} on GitHub`)}">Open repo</button>` : ''
  }

  function threadRow(t) {
    // The spotlight's pink, the colour at a spotlit villager's feet, so the list says who is spotlit too.
    const lit = village.spotlightOf(t.id) ? `<span class="spot" role="img" aria-label="Spotlit" style="color:${P.spotlight}" title="Spotlit (F flies to it)">▼</span>` : ''
    return `<button class="thread-row ${t.id === village.selected ? 'selected' : ''}" data-act="thread" data-id="${esc(t.id)}">${lit}<span class="t" title="${esc(t.title)}">${t.villager ? `<span class="vname">${esc(t.villager)}</span> ` : ''}${esc(t.title)}</span><span class="s">${esc(needsInputLabel(t.needsInput) || STATUS_LABEL[t.status])} · ${ago(t.lastActivityAt)}</span></button>`
  }

  /**
   * A repo's threads, under its groups' headings when it has any, each folding away on a click,
   * and the threads in none after them. A heading says what its group is up to, as a repo's row does.
   */
  function threadList(r) {
    if (!r.groups.length) return r.threads.map(threadRow).join('')
    const heading = (g) => {
      const shut = foldedGroups.has(`${r.name}/${g.id}`)
      const c = g.counts
      const b = []
      if (c.blocked) b.push(`<span class="blocked">${c.blocked} !</span>`)
      if (c.waiting) b.push(`<span class="waiting">${c.waiting} ?</span>`)
      if (c.done) b.push(`<span class="done" title="Done, ready for review">${c.done} ✓</span>`)
      if (c.working) b.push(`<span class="working">${c.working}</span>`)
      return `<div class="group-head">
        <button class="gh-fold" data-act="foldGroup" data-group="${esc(g.id)}" aria-expanded="${!shut}" title="${shut ? 'Show' : 'Fold away'} its sessions">
          <span class="fold">${shut ? '▸' : '▾'}</span><span class="flag" style="background:${ACCENTS[g.color % ACCENTS.length]}"></span><span class="name">${esc(g.name)}</span>
          <span class="badges">${b.join('')}<span title="Sessions in this group">${g.threads.length}</span></span></button>
        <button class="btn gh-new" data-act="newInGroup" data-group="${esc(g.id)}" title="${esc(`New session in ${g.name}`)}" aria-label="${esc(`New session in ${g.name}`)}">+</button>
      </div>${shut ? '' : g.threads.length ? g.threads.map(threadRow).join('') : '<p class="group-empty">No sessions yet. Pick this group on a villager’s card, or start one with +.</p>'}`
    }
    const rest = r.ungrouped.length ? `<div class="group-head rest"><span class="name">In no group</span><span class="badges"><span>${r.ungrouped.length}</span></span></div>${r.ungrouped.map(threadRow).join('')}` : ''
    return r.groups.map(heading).join('') + rest
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

  /** Where this folder stands its landmark: where the village's stand (Auto), or a spot of its own. */
  function spotPicker(name) {
    const picked = village.spotPick(name) || ''
    const theme = village.lookOf(name).theme
    const options = SPOT_LABELS.map(([id, label]) => `<option value="${id}" ${id === picked ? 'selected' : ''}>${esc(label)}</option>`).join('')
    return `<label class="look" title="Where this plot stands its ${esc(landmarkWords(theme).one)} in its ${esc(finishedWords(theme).place)}: where the village's stand, or somewhere of its own">Landmark
      <select data-spot="${esc(name)}"><option value="" ${picked ? '' : 'selected'}>Auto: ${esc(spotLabel(landmarkSpotOf(settings.landmarkSpot)))}</option>${options}</select></label>`
  }

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const dateOf = (day) => `${MONTHS[ymd(day).month - 1]} ${ymd(day).day}`

  /** The holidays to tick, and which theme is on now and which comes next. */
  function calendarRows() {
    const list = ticked(settings.holidays)
    const on = new Set(list.map((h) => h.id))
    const today = todayOf()
    const next = nextHoliday(today, list)
    // From the window itself, not by comparing themes: someone whose base theme is Halloween is
    // still in Halloween's dates.
    const now = activeHoliday(today, list)?.holiday.label
    const line = [now && `${now} is on now.`, next && `${next.holiday.label} next, from ${dateOf(next.start)}.`].filter(Boolean).join(' ')
    return `${line ? `<p style="color:var(--muted);font-size:12px;margin:0">${esc(line)}</p>` : ''}
        ${HOLIDAYS.map((h) => `<label>${esc(h.label)} <input type="checkbox" data-holiday="${h.id}" ${on.has(h.id) ? 'checked' : ''}></label>`).join('')}`
  }

  /** What the sky is following: the place's own weather once heard, else a hint of what went wrong. */
  function weatherNote() {
    const w = village.realWeather
    if (!settings.place) return ''
    return `<p class="note">${esc(w?.ok ? `Following ${w.place}.` : w?.error || 'Looking…')}</p>`
  }

  // What a machine with no sessions sees: where each harness was looked for, and the demo.
  function emptyState() {
    if (!village.loaded) return '<p class="note">Reading your sessions…</p>'
    if (village.demo) return '<p class="note">No sessions in the demo.</p>'
    const rows = village.harnesses.map((h) => {
      const where = h.looked?.length ? ` Looked in ${h.looked.map((p) => `<code>${esc(p)}</code>`).join(', ')}.` : ''
      const state = h.detected ? `Found, with no sessions yet.${where}` : `Not found.${where}`
      const get = !h.detected && h.url ? ` <a href="${esc(h.url)}" data-act="getHarness" data-url="${esc(h.url)}">Get it</a>` : ''
      return `<li><b>${esc(h.name)}</b> ${state}${get}</li>`
    })
    return `<div class="empty-state">
      <p>No sessions found yet. Start one in a harness AgentVille reads and the villager will walk in.</p>
      ${rows.length ? `<ul>${rows.join('')}</ul>` : ''}
      <p><a class="btn" href="?demo=1">Try the demo</a> <button class="btn" data-act="tour">Take the tour</button></p>
    </div>`
  }

  function renderSheet() {
    if (sheetMode === 'tour') {
      const step = TOUR[tourStep]
      const last = tourStep === TOUR.length - 1
      sheet.innerHTML = `<h2>${esc(step.title)}</h2><p class="note">${tourStep + 1} of ${TOUR.length}</p>${step.body}
        <div class="actions">${tourStep ? '<button class="btn" data-act="tourBack">Back</button>' : ''}
          <button class="btn primary" data-act="${last ? 'closeSheet' : 'tourNext'}">${last ? 'Done' : 'Next'}</button>
          ${last ? '' : '<button class="btn" data-act="closeSheet">Skip</button>'}</div>`
    } else if (sheetMode === 'help') {
      sheet.innerHTML = `<h2>Keys</h2><table>${HELP.map(([k, d]) => `<tr><td>${esc(k)}</td><td>${esc(d)}</td></tr>`).join('')}</table>
        <div class="actions"><button class="btn" data-act="tour">Take the tour</button><button class="btn" data-act="closeSheet">Close</button></div>`
    } else {
      const s = settings
      const theme = village.theme
      const every = s.subthemes?.[theme] || ''
      const spot = landmarkSpotOf(s.landmarkSpot)
      const place = finishedWords(theme).place
      sheet.innerHTML = `<h2>Settings</h2>
        <label>Theme
          <select data-set="theme">${THEME_IDS.map((id) => `<option value="${id}" ${id === village.baseTheme ? 'selected' : ''}>${esc(THEMES[id].label)}</option>`).join('')}</select></label>
        <label title="Dress the village for a holiday through its dates, then back to the theme above. Folders with a look of their own keep it.">Follow the calendar <input type="checkbox" data-set="calendar" ${s.calendar ? 'checked' : ''}></label>
        ${s.calendar ? calendarRows() : ''}
        <label title="Every folder that hasn't picked a look of its own, from its panel">Every folder
          <select data-set="everywhere"><option value="" ${every ? '' : 'selected'}>Its own look</option>${THEMES[theme].subthemes.map((x) => subOption(x, x.id === every)).join('')}</select></label>
        <label title="Where every plot stands the ${esc(landmarkWords(theme).one)} its work has raised, unless the folder picked somewhere of its own. At the head of the ${esc(place)} it hides none of the ${esc(finishedWords(theme).many)} growing there.">Landmarks stand
          <select data-set="landmarkSpot">${SPOT_LABELS.map(([id, label]) => `<option value="${id}" ${id === spot ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select></label>
        <label>Open Claude Code threads in
          <select data-set="openIn"><option value="vscode" ${s.openIn === 'vscode' ? 'selected' : ''}>VS Code</option><option value="app" ${s.openIn === 'app' ? 'selected' : ''}>Claude app</option></select></label>
        <label title="Follow your system’s reduced-motion setting, or choose. Reduced: no hopping or waving, butterflies or cloud shadows, and the camera cuts instead of flying.">Motion
          <select data-set="motion"><option value="system" ${s.motion === 'system' || !s.motion ? 'selected' : ''}>Follow system</option><option value="reduce" ${s.motion === 'reduce' ? 'selected' : ''}>Reduced</option><option value="full" ${s.motion === 'full' ? 'selected' : ''}>Full</option></select></label>
        <label title="${canNotify ? 'A desktop notification when a villager stops on a question or an error while AgentVille is in the background' : 'This browser can’t show notifications'}">Notify me when a villager needs me <input type="checkbox" data-set="notify" ${s.notify && canNotify ? 'checked' : ''} ${canNotify ? '' : 'disabled'}></label>
        <label>${esc(finishedWords(theme).grow)} <input type="checkbox" data-set="prGardens" ${s.prGardens ? 'checked' : ''}></label>
        <label>Pin open issues on notice boards <input type="checkbox" data-set="issueBoards" ${s.issueBoards ? 'checked' : ''}></label>
        <label title="Reads the files in each repo to count its lines of code, for its landmark. Nothing is run and nothing leaves this machine.">Count the lines of code in each repo <input type="checkbox" data-set="repoLines" ${s.repoLines ? 'checked' : ''}></label>
        <label>Fold away repos asleep for 3 days <input type="checkbox" data-set="hideDormant" ${s.hideDormant ? 'checked' : ''}></label>
        <label title="Turns a thread that has been asleep this long into a flower. It stays in the sidebar under Archived, and you can restore it.">Archive threads asleep for
          <select data-set="archiveAfterDays">${[[0, 'Never'], [30, '30 days'], [90, '90 days']].map(([n, label]) => `<option value="${n}" ${Number(s.archiveAfterDays) === n ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
        <label title="A small name under each villager when you are zoomed in">Name the villagers <input type="checkbox" data-set="villagerNames" ${s.villagerNames ? 'checked' : ''}></label>
        <label>Only name busy plots <input type="checkbox" data-set="quietNames" ${s.quietNames ? 'checked' : ''}></label>
        <label>Time of day
          <select data-set="timeMode"><option value="live" ${s.timeMode === 'live' ? 'selected' : ''}>Follow my clock</option><option value="manual" ${s.timeMode === 'manual' ? 'selected' : ''}>Set by hand</option></select></label>
        ${s.timeMode === 'manual' ? `<label>${formatHour(s.hour)} <input type="range" min="0" max="23.75" step="0.25" value="${s.hour}" data-set="hour"></label>` : ''}
        <label title="Rain, snow and drifting leaves, by the season of the date">Weather <input type="checkbox" data-set="weather" ${s.weather ? 'checked' : ''}></label>
        ${s.weather ? `<label title="Follow the real weather where you live, checked hourly. Only the place you type is sent, to Open-Meteo. Leave empty and the village makes its weather up.">Your place <input type="text" maxlength="80" placeholder="Made up" value="${esc(s.place)}" data-set="place"></label>
        ${weatherNote()}` : ''}
        ${s.weather ? `<label>Seasons of the <select data-set="south"><option value="" ${s.south ? '' : 'selected'}>north</option><option value="1" ${s.south ? 'selected' : ''}>south</option></select></label>` : ''}
        ${s.weather && s.timeMode === 'manual' ? `<label>Season <select data-set="season">${['auto', 'spring', 'summer', 'autumn', 'winter'].map((x) => `<option value="${x}" ${s.season === x ? 'selected' : ''}>${x === 'auto' ? 'From the date' : x[0].toUpperCase() + x.slice(1)}</option>`).join('')}</select></label>
        <label>Sky <select data-set="sky">${['auto', 'clear', 'rain', 'snow'].map((x) => `<option value="${x}" ${s.sky === x ? 'selected' : ''}>${x === 'auto' ? 'As it comes' : x[0].toUpperCase() + x.slice(1)}</option>`).join('')}</select></label>` : ''}
        <div class="actions"><button class="btn" data-act="closeSheet">Close</button></div>`
    }
  }

  function showSheet(mode) {
    if (mode === 'tour') tourStep = 0
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
      case 'newInGroup': onNewSession(village.selectedPlot, { group: b.dataset.group }); break
      case 'groups': onEditGroups(village.selectedPlot); break
      case 'foldGroup': {
        const k = `${village.selectedPlot}/${b.dataset.group}`
        if (!foldedGroups.delete(k)) foldedGroups.add(k)
        render()
        break
      }
      case 'reveal': village.reveal(); break
      case 'openRepo': village.openRepo(); break
      case 'copy': village.copyPath(); break
      case 'tasks': onEditTasks(village.selectedPlot); break
      case 'hide': village.hide(); break
      case 'unhide': village.unhide(name); break
      case 'unarchive': village.unarchive(id); break
      case 'wake': settings.hideDormant = false; onSettings(); break
      case 'toggle': open[key] = !open[key]; render(); break
      case 'settings': showSheet('settings'); break
      case 'update': village.openRelease(); break
      case 'help': showSheet('help'); break
      case 'tour': showSheet('tour'); break
      case 'getHarness': e.preventDefault(); village.openLink(b.dataset.url); break
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

  // The tour's buttons live in the sheet, not the sidebar, so they are answered here.
  sheet.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act
    if (act === 'closeSheet') showSheet(sheetMode)
    else if (act === 'tour') {
      sheetMode = null // from Keys: swap that sheet for the tour rather than toggling it
      showSheet('tour')
    } else if (act === 'tourNext') {
      tourStep = Math.min(tourStep + 1, TOUR.length - 1)
      renderSheet()
    } else if (act === 'tourBack') {
      tourStep = Math.max(tourStep - 1, 0)
      renderSheet()
    }
  })
  sheet.addEventListener('input', (e) => {
    const holiday = e.target.dataset.holiday
    if (holiday) {
      settings.holidays = { ...settings.holidays, [holiday]: e.target.checked }
      onSettings('holidays')
      renderSheet()
      return
    }
    const k = e.target.dataset.set
    if (!k || k === 'place') return
    // The whole village's sub-theme is kept per theme, so switching themes back finds it again.
    if (k === 'everywhere') settings.subthemes = { ...settings.subthemes, [village.theme]: e.target.value }
    else if (k === 'south') settings.south = e.target.value === '1'
    else if (k === 'archiveAfterDays') settings[k] = Number(e.target.value) || 0
    else settings[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.type === 'range' ? Number(e.target.value) : e.target.value
    onSettings(k)
    renderSheet()
  })

  // The place is committed when the box is left, not on every key, which would re-draw the sheet under the cursor.
  sheet.addEventListener('change', (e) => {
    if (e.target.dataset.set !== 'place') return
    settings.place = e.target.value.trim().slice(0, 80)
    onSettings('place')
    renderSheet()
  })
  side.addEventListener('change', (e) => {
    const { look: lookName, spot: spotName } = e.target.dataset || {}
    if (lookName === undefined && spotName === undefined) return
    e.target.blur()
    if (spotName !== undefined) return village.setSpot(spotName, e.target.value || null)
    const [theme, sub] = e.target.value.split('/')
    village.setLook(lookName, e.target.value ? { theme, sub } : null)
  })
  side.addEventListener('focusout', (e) => {
    if (stale && e.target.tagName === 'SELECT') requestAnimationFrame(render)
  })

  return { render, showSheet, get sheetOpen() { return Boolean(sheetMode) }, closeSheet: () => sheetMode && showSheet(sheetMode) }
}
