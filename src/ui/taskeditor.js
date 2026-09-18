// A repo's own tasks: add, edit and delete the ready-made jobs its villagers can be sent, on top
// of the built-in ones every repo has.
import { esc } from './dom.js'
import { LABEL_MAX, PROMPT_MAX, TASKS } from '../game/tasks.js'

export function createTaskEditor(root, village) {
  const box = document.createElement('div')
  box.className = 'sheet newsession taskeditor'
  box.hidden = true
  root.appendChild(box)
  let project = ''
  let editing = '' // id of the task in the form, or '' for a new one

  function render() {
    const mine = village.customTasks(project)
    const t = mine.find((x) => x.id === editing)
    box.innerHTML = `<h2>Tasks for ${esc(project)}</h2>
      <p class="note">Every repo has ${TASKS.map((x) => esc(x.label)).join(', ')}. Add jobs of your own for this one.</p>
      <ul class="tasklist">
        ${mine.length ? mine.map((x) => `<li class="${x.id === editing ? 'editing' : ''}">
          <span title="${esc(x.prompt)}">${esc(x.label)}</span>
          <button class="btn" data-act="edit" data-id="${esc(x.id)}">Edit</button>
          <button class="btn danger" data-act="delete" data-id="${esc(x.id)}" title="Delete">✕</button></li>`).join('') : '<li class="empty">None yet.</li>'}
      </ul>
      <label class="stack">${t ? 'Edit task' : 'New task'}
        <input type="text" data-f="label" maxlength="${LABEL_MAX}" placeholder="Button name, e.g. Deploy to staging" value="${esc(t?.label || '')}" spellcheck="false"></label>
      <label class="stack">Prompt
        <textarea data-f="prompt" rows="5" maxlength="${PROMPT_MAX}" placeholder="What the agent should do, and when to stop and ask you.">${esc(t?.prompt || '')}</textarea></label>
      <div class="actions">
        <button class="btn primary" data-act="save">${t ? 'Save' : 'Add task'}<kbd>⌘↵</kbd></button>
        ${t ? '<button class="btn" data-act="new">Cancel edit</button>' : ''}
        <button class="btn" data-act="close">Done</button>
      </div>`
  }

  function save() {
    const label = box.querySelector('[data-f="label"]').value
    const prompt = box.querySelector('[data-f="prompt"]').value
    if (!village.saveTask(project, { id: editing, label, prompt })) return
    editing = ''
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
      render()
      box.querySelector('[data-f="prompt"]').focus()
    } else if (act === 'delete') {
      if (editing === b.dataset.id) editing = ''
      village.removeTask(project, b.dataset.id)
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
