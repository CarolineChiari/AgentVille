// A repo's own tasks: add, edit and delete the ready-made jobs its villagers can be sent, on top
// of the built-in ones every repo has.
import { esc, submitKey } from './dom.js'
import { EVERY_REPO, LABEL_MAX, PROMPT_MAX, TASKS } from '../game/tasks.js'

export function createTaskEditor(root, village) {
  const box = document.createElement('div')
  box.className = 'sheet newsession taskeditor'
  box.hidden = true
  root.appendChild(box)
  let project = ''
  let editing = '' // id of the task in the form, or '' for a new one
  let editingGlobal = false // which list it is in: a repo's own and a global task may share an id

  function render() {
    const own = village.customTasks(project)
    const everywhere = village.customTasks(EVERY_REPO)
    const rows = [...own.map((task) => ({ task, global: false })), ...everywhere.map((task) => ({ task, global: true }))]
    const t = rows.find((r) => r.task.id === editing && r.global === editingGlobal)?.task
    const global = Boolean(t) && editingGlobal
    box.innerHTML = `<h2>Tasks for ${esc(project)}</h2>
      <p class="note">Every repo has ${TASKS.map((x) => esc(x.label)).join(', ')}. Add jobs of your own for this one, or for every repo. A prompt may use {repo}, {branch} and {path}: they are filled in from the villager it is sent to.</p>
      <ul class="tasklist">
        ${rows.length ? rows.map(({ task: x, global: g }) => `<li class="${x.id === editing && g === editingGlobal ? 'editing' : ''}">
          <span title="${esc(x.prompt)}">${esc(x.label)}${g ? ' <small>(every repo)</small>' : ''}</span>
          <button class="btn" data-act="edit" data-id="${esc(x.id)}" data-global="${g}">Edit</button>
          <button class="btn danger" data-act="delete" data-id="${esc(x.id)}" data-global="${g}" title="Delete">✕</button></li>`).join('') : '<li class="empty">None yet.</li>'}
      </ul>
      <label class="stack">${t ? 'Edit task' : 'New task'}
        <input type="text" data-f="label" maxlength="${LABEL_MAX}" placeholder="Button name, e.g. Deploy to staging" value="${esc(t?.label || '')}" spellcheck="false"></label>
      <label class="stack">Prompt
        <textarea data-f="prompt" rows="5" maxlength="${PROMPT_MAX}" placeholder="What the agent should do, and when to stop and ask you.">${esc(t?.prompt || '')}</textarea></label>
      <label class="check"><input type="checkbox" data-f="global"${global ? ' checked' : ''}> For every repo</label>
      <div class="actions">
        <button class="btn primary" data-act="save">${t ? 'Save' : 'Add task'}<kbd>${submitKey()}</kbd></button>
        ${t ? '<button class="btn" data-act="new">Cancel edit</button>' : ''}
        <button class="btn" data-act="close">Done</button>
      </div>`
  }

  function save() {
    const label = box.querySelector('[data-f="label"]').value
    const prompt = box.querySelector('[data-f="prompt"]').value
    const every = box.querySelector('[data-f="global"]').checked
    const from = editingGlobal ? EVERY_REPO : project
    const to = every ? EVERY_REPO : project
    // Moving a task between lists saves a copy there and drops the old one, so a failed save loses nothing.
    const moving = editing && from !== to
    if (!village.saveTask(to, { id: moving ? '' : editing, label, prompt })) return
    if (moving) village.removeTask(from, editing)
    editing = ''
    editingGlobal = false
    render()
    box.querySelector('[data-f="label"]').focus()
  }

  box.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]')
    if (!b) return
    const act = b.dataset.act
    if (act === 'save') save()
    else if (act === 'close') close()
    else if (act === 'new') {
      editing = ''
      render()
    } else if (act === 'edit') {
      editing = b.dataset.id
      editingGlobal = b.dataset.global === 'true'
      render()
      box.querySelector('[data-f="prompt"]').focus()
    } else if (act === 'delete') {
      const g = b.dataset.global === 'true'
      if (editing === b.dataset.id && editingGlobal === g) editing = ''
      village.removeTask(g ? EVERY_REPO : project, b.dataset.id)
      render()
    }
  })
  box.addEventListener('keydown', (e) => {
    e.stopPropagation() // typing here must not steer the village
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save()
    else if (e.key === 'Escape') close()
  })

  function open(name) {
    if (!name) return
    project = name
    editing = ''
    render()
    box.hidden = false
    box.querySelector('[data-f="label"]').focus()
  }
  function close() {
    box.hidden = true
  }
  return { open, close, get isOpen() { return !box.hidden } }
}
