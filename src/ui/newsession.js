// The new-session form: pick a repo (or type any folder), optionally write the first prompt, go.
import { esc } from './dom.js'

const OTHER = '__other__'

/** What the model menu offers. '' leaves it to your Claude Code default (settings.json). */
export const MODELS = [
  ['', 'Your default'],
  ['fable', 'Fable'],
  ['opus', 'Opus'],
  ['opus[1m]', 'Opus, 1M context'],
  ['sonnet', 'Sonnet'],
  ['haiku', 'Haiku'],
]
/** The CLI's --effort levels. '' leaves it to your default. */
export const EFFORTS = [
  ['', 'Your default'],
  ['low', 'Low'],
  ['medium', 'Medium'],
  ['high', 'High'],
  ['xhigh', 'Extra high'],
  ['max', 'Max'],
]
const TARGETS = [
  ['vscode', 'VS Code'],
  ['terminal', 'Terminal'],
  ['app', 'Claude app'],
]

export function createNewSession(root, village, { onRemember = () => {} } = {}) {
  const box = document.createElement('div')
  box.className = 'sheet newsession'
  box.hidden = true
  root.appendChild(box)

  function render(preselect) {
    const folders = village.knownFolders()
    const pre = folders.find((f) => f.name === preselect)?.path ?? folders[0]?.path ?? OTHER
    const s = village.settings
    const target = s.newTarget || s.openIn
    const model = s.newModel || ''
    const effort = s.newEffort || ''
    box.innerHTML = `<h2>New session</h2>
      <label class="stack">Folder
        <select data-f="folder">
          ${folders.map((f) => `<option value="${esc(f.path)}" ${f.path === pre ? 'selected' : ''}>${esc(f.name)}</option>`).join('')}
          <option value="${OTHER}" ${pre === OTHER ? 'selected' : ''}>Another folder…</option>
        </select></label>
      <input type="text" data-f="other" placeholder="/full/path/to/folder" ${pre === OTHER ? '' : 'hidden'} spellcheck="false">
      <div class="row3">
        <label class="stack">Open in
          <select data-f="target">${TARGETS.map(([v, l]) => `<option value="${v}" ${v === target ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="stack">Model
          <select data-f="model">${MODELS.map(([v, l]) => `<option value="${esc(v)}" ${v === model ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="stack">Effort
          <select data-f="effort">${EFFORTS.map(([v, l]) => `<option value="${v}" ${v === effort ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      </div>
      <label class="stack">First prompt <span class="hint-inline">optional</span>
        <textarea data-f="prompt" rows="4" maxlength="1800" placeholder="What should Claude work on?"></textarea></label>
      <p class="note" data-f="note"></p>
      <div class="actions"><button class="btn primary" data-act="start">Start<kbd>⌘↵</kbd></button><button class="btn" data-act="cancel">Cancel</button></div>`
  }

  /**
   * Say what will happen. Only the terminal can take a model or an effort level, so picking
   * either moves you there.
   */
  function explain(changed) {
    const t = box.querySelector('[data-f="target"]')
    const m = box.querySelector('[data-f="model"]')
    const e = box.querySelector('[data-f="effort"]')
    if ((changed === 'model' && m.value) || (changed === 'effort' && e.value)) t.value = 'terminal'
    const how = [m.value ? m.selectedOptions[0].textContent : 'your default model', e.value ? `${e.selectedOptions[0].textContent.toLowerCase()} effort` : ''].filter(Boolean).join(' and ')
    const note = {
      vscode: 'Opens in VS Code with the prompt typed in — press Enter there to send it. VS Code uses your default model and effort; change them in its menus, or choose Terminal here.',
      terminal: `Opens a terminal in the folder running Claude Code with ${how}${navigator.platform.startsWith('Win') ? '; your prompt goes on the clipboard' : ', starting on your prompt'}.`,
      app: 'Opens the Claude app in the folder with your default model and effort; your prompt goes on the clipboard.',
    }[t.value]
    box.querySelector('[data-f="note"]').textContent = `${note} The villager walks in once the session starts.`
  }

  function folder() {
    const sel = box.querySelector('[data-f="folder"]').value
    return sel === OTHER ? box.querySelector('[data-f="other"]').value.trim() : sel
  }

  async function start() {
    const f = folder()
    if (!f) return box.querySelector('[data-f="other"]').focus()
    const target = box.querySelector('[data-f="target"]').value
    const model = target === 'terminal' ? box.querySelector('[data-f="model"]').value : ''
    const effort = target === 'terminal' ? box.querySelector('[data-f="effort"]').value : ''
    village.settings.newTarget = target
    village.settings.newModel = model
    village.settings.newEffort = effort
    onRemember()
    const ok = await village.startSession(f, box.querySelector('[data-f="prompt"]').value.trim(), { target, model, effort })
    if (ok) close()
  }

  box.addEventListener('change', (e) => {
    if (['target', 'model', 'effort'].includes(e.target.dataset.f)) explain(e.target.dataset.f)
    if (e.target.dataset.f === 'folder') {
      const other = box.querySelector('[data-f="other"]')
      other.hidden = e.target.value !== OTHER
      if (!other.hidden) other.focus()
    }
  })
  box.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act
    if (act === 'start') start()
    else if (act === 'cancel') close()
  })
  box.addEventListener('keydown', (e) => {
    e.stopPropagation() // typing here must not steer the village
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) start()
    else if (e.key === 'Escape') close()
  })

  function open(preselect = village.selectedPlot) {
    render(preselect)
    explain()
    box.hidden = false
    box.querySelector('[data-f="prompt"]').focus()
  }
  function close() {
    box.hidden = true
  }
  return { open, close, get isOpen() { return !box.hidden } }
}
