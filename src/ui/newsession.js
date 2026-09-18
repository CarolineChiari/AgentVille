// The new-session form: pick a repo (or type any folder), optionally write the first prompt, go.
import { agentName, esc } from './dom.js'

const OTHER = '__other__'

/**
 * Only the harnesses on this machine, each with the places it can start a session here — both
 * come from the server, which looked. A harness with nowhere to start is not offered.
 */
export function startableHarnesses(harnesses) {
  return (harnesses || []).filter((h) => h.detected && Array.isArray(h.targets) && h.targets.length)
}

/** The remembered choice when it is still on offer, else the first thing that is. */
export function pick(list, remembered, key = 'id') {
  return list.find((x) => x[key] === remembered) || list[0] || null
}

const options = (list, selected) => list.map(([v, l]) => `<option value="${esc(v)}" ${v === selected ? 'selected' : ''}>${esc(l)}</option>`).join('')

export function createNewSession(root, village, { onRemember = () => {} } = {}) {
  const box = document.createElement('div')
  box.className = 'sheet newsession'
  box.hidden = true
  root.appendChild(box)

  const harnesses = () => startableHarnesses(village.harnesses)
  const current = () => pick(harnesses(), box.querySelector('[data-f="harness"]')?.value)
  const currentTarget = () => pick(current()?.targets || [], box.querySelector('[data-f="target"]')?.value)

  function render(preselect) {
    const folders = village.knownFolders()
    const pre = folders.find((f) => f.name === preselect)?.path ?? folders[0]?.path ?? OTHER
    const s = village.settings
    const list = harnesses()
    const h = pick(list, s.newHarness)
    if (!h) {
      box.innerHTML = `<h2>New session</h2><p class="note">No coding agent that AgentVille can start was found on this machine.</p>
        <div class="actions"><button class="btn" data-act="cancel">Close</button></div>`
      return
    }
    box.innerHTML = `<h2>New session</h2>
      <label class="stack">Folder
        <select data-f="folder">
          ${folders.map((f) => `<option value="${esc(f.path)}" ${f.path === pre ? 'selected' : ''}>${esc(f.name)}</option>`).join('')}
          <option value="${OTHER}" ${pre === OTHER ? 'selected' : ''}>Another folder…</option>
        </select></label>
      <input type="text" data-f="other" placeholder="/full/path/to/folder" ${pre === OTHER ? '' : 'hidden'} spellcheck="false">
      <label class="stack" ${list.length > 1 ? '' : 'hidden'}>Agent
        <select data-f="harness">${options(list.map((x) => [x.id, x.name]), h.id)}</select></label>
      <div class="row3" data-f="row"></div>
      <div class="chips" data-f="chips" title="Fill in a ready-made task"></div>
      <label class="stack">First prompt <span class="hint-inline">optional</span>
        <textarea data-f="prompt" rows="4" maxlength="1800"></textarea></label>
      <p class="note" data-f="note"></p>
      <div class="actions"><button class="btn primary" data-act="start">Start<kbd>⌘↵</kbd></button><button class="btn" data-act="cancel">Cancel</button></div>`
    renderTargets()
    renderChips()
  }

  /** The chosen repo's tasks: the built-in ones, then its own. Another folder gets the built-ins. */
  const project = () => village.knownFolders().find((f) => f.path === box.querySelector('[data-f="folder"]')?.value)?.name || ''
  function renderChips() {
    const el = box.querySelector('[data-f="chips"]')
    if (el) el.innerHTML = village.tasksFor(project()).map((x) => `<button class="btn" data-act="task" data-task="${esc(x.id)}" title="${esc(x.prompt)}">${esc(x.label)}</button>`).join('')
  }

  /** The "Open in" menu for the chosen harness, and its model/effort menus when that target has them. */
  function renderTargets() {
    const h = current()
    const s = village.settings
    // Claude's first choice follows the Open-in setting, as it always has.
    const remembered = s.newTargets?.[h.id] || (h.id === 'claude-code' ? s.openIn : '')
    const t = pick(h.targets, remembered)
    const model = s.newModel || ''
    const effort = s.newEffort || ''
    box.querySelector('[data-f="row"]').innerHTML = `
      <label class="stack">Open in
        <select data-f="target">${options(h.targets.map((x) => [x.id, x.label]), t.id)}</select></label>
      <span data-f="choices" style="display:contents"></span>`
    renderChoices(model, effort)
    box.querySelector('[data-f="prompt"]').placeholder = `What should ${agentName({ harnessName: h.name })} work on?`
  }

  function renderChoices(model = '', effort = '') {
    const t = currentTarget()
    const menus = [
      t?.models && `<label class="stack">Model<select data-f="model">${options(t.models, model)}</select></label>`,
      t?.efforts && `<label class="stack">Effort<select data-f="effort">${options(t.efforts, effort)}</select></label>`,
    ].filter(Boolean)
    box.querySelector('[data-f="choices"]').innerHTML = menus.join('')
    explain()
  }

  /** Say what will happen, in the harness's own words. */
  function explain() {
    const t = currentTarget()
    box.querySelector('[data-f="note"]').textContent = t ? `${t.note} The villager walks in once the session starts.` : ''
  }

  function folder() {
    const sel = box.querySelector('[data-f="folder"]').value
    return sel === OTHER ? box.querySelector('[data-f="other"]').value.trim() : sel
  }

  async function start() {
    const f = folder()
    if (!f) return box.querySelector('[data-f="other"]').focus()
    const h = current()
    const t = currentTarget()
    if (!h || !t) return
    const model = box.querySelector('[data-f="model"]')?.value || ''
    const effort = box.querySelector('[data-f="effort"]')?.value || ''
    const s = village.settings
    s.newHarness = h.id
    s.newTargets = { ...(s.newTargets || {}), [h.id]: t.id }
    if (t.models) s.newModel = model
    if (t.efforts) s.newEffort = effort
    onRemember()
    const ok = await village.startSession(f, box.querySelector('[data-f="prompt"]').value.trim(), { harness: h.id, target: t.id, model, effort })
    if (ok) close()
  }

  box.addEventListener('change', (e) => {
    const f = e.target.dataset.f
    if (f === 'harness') renderTargets()
    else if (f === 'target') renderChoices(village.settings.newModel, village.settings.newEffort)
    if (f === 'folder') {
      renderChips()
      const other = box.querySelector('[data-f="other"]')
      other.hidden = e.target.value !== OTHER
      if (!other.hidden) other.focus()
    }
  })
  box.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act
    if (act === 'task') {
      const p = box.querySelector('[data-f="prompt"]')
      const id = e.target.closest('[data-task]').dataset.task
      p.value = village.tasksFor(project()).find((x) => x.id === id)?.prompt || p.value
      p.focus()
    } else if (act === 'start') start()
    else if (act === 'cancel') close()
  })
  box.addEventListener('keydown', (e) => {
    e.stopPropagation() // typing here must not steer the village
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) start()
    else if (e.key === 'Escape') close()
  })

  function open(preselect = village.selectedPlot) {
    render(preselect)
    box.hidden = false
    ;(box.querySelector('[data-f="prompt"]') || box.querySelector('[data-act="cancel"]')).focus()
  }
  function close() {
    box.hidden = true
  }
  return { open, close, get isOpen() { return !box.hidden } }
}
