// The new-session form: pick a repo (or type any folder), optionally write the first prompt, go.
import { esc } from './dom.js'

const OTHER = '__other__'

export function createNewSession(root, village) {
  const box = document.createElement('div')
  box.className = 'sheet newsession'
  box.hidden = true
  root.appendChild(box)

  function render(preselect) {
    const folders = village.knownFolders()
    const pre = folders.find((f) => f.name === preselect)?.path ?? folders[0]?.path ?? OTHER
    const where = village.settings.openIn === 'vscode' ? 'VS Code' : 'the Claude app'
    box.innerHTML = `<h2>New session</h2>
      <label class="stack">Folder
        <select data-f="folder">
          ${folders.map((f) => `<option value="${esc(f.path)}" ${f.path === pre ? 'selected' : ''}>${esc(f.name)}</option>`).join('')}
          <option value="${OTHER}" ${pre === OTHER ? 'selected' : ''}>Another folder…</option>
        </select></label>
      <input type="text" data-f="other" placeholder="/full/path/to/folder" ${pre === OTHER ? '' : 'hidden'} spellcheck="false">
      <label class="stack">First prompt <span class="hint-inline">optional</span>
        <textarea data-f="prompt" rows="4" maxlength="1800" placeholder="What should Claude work on?"></textarea></label>
      <p class="note">Opens in ${where}${village.settings.openIn === 'vscode' ? ' with the prompt filled in — press Enter there to send it' : '; the prompt is copied so you can paste it'}. The villager walks in once the session starts.</p>
      <div class="actions"><button class="btn primary" data-act="start">Start<kbd>⌘↵</kbd></button><button class="btn" data-act="cancel">Cancel</button></div>`
  }

  function folder() {
    const sel = box.querySelector('[data-f="folder"]').value
    return sel === OTHER ? box.querySelector('[data-f="other"]').value.trim() : sel
  }

  async function start() {
    const f = folder()
    if (!f) return box.querySelector('[data-f="other"]').focus()
    const ok = await village.startSession(f, box.querySelector('[data-f="prompt"]').value.trim())
    if (ok) close()
  }

  box.addEventListener('change', (e) => {
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
    box.hidden = false
    box.querySelector('[data-f="prompt"]').focus()
  }
  function close() {
    box.hidden = true
  }
  return { open, close, get isOpen() { return !box.hidden } }
}
