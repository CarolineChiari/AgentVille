// A repo's groups: make them, name them, colour their flags, take them down, and say which of the
// repo's sessions is in which, all in one place.
import { esc } from './dom.js'
import { ACCENTS } from '../render/sprites/palette.js'
import { GROUP_NAME_MAX } from '../game/groups.js'
import { STATUS_RANK } from '../sim/status.js'

export function createGroupEditor(root, village) {
  const box = document.createElement('div')
  box.className = 'sheet newsession groupeditor'
  box.hidden = true
  root.appendChild(box)
  let project = ''
  let picking = '' // the group whose colours are laid out to pick from, or ''

  const swatch = (color) => `background:${ACCENTS[color % ACCENTS.length]}`

  /** The repo's sessions on the map, the ones wanting something first, as its panel lists them. */
  const sessions = () => village.view.live
    .filter((t) => t.project === project)
    .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || b.lastActivityAt - a.lastActivityAt)

  function render() {
    const groups = village.groupsOf(project)
    const live = sessions()
    const members = (id) => live.filter((t) => t.group?.id === id).length
    const options = (t) => [`<option value="" ${t.group ? '' : 'selected'}>No group</option>`,
      ...groups.map((g) => `<option value="${esc(g.id)}" ${t.group?.id === g.id ? 'selected' : ''}>${esc(g.name)}</option>`)].join('')
    box.innerHTML = `<h2>Groups in ${esc(project)}</h2>
      <p class="note">A group’s sessions live side by side on the plot, and every one of their houses flies the group’s flag.</p>
      <ul class="grouplist">
        ${groups.length ? groups.map((g) => `<li>
          <button class="swatch" data-act="colors" data-group="${esc(g.id)}" style="${swatch(g.color)}" title="Its flag’s colour" aria-label="${esc(`Colour of ${g.name}`)}" aria-expanded="${picking === g.id}"></button>
          <input type="text" data-f="name" data-group="${esc(g.id)}" maxlength="${GROUP_NAME_MAX}" value="${esc(g.name)}" spellcheck="false" aria-label="Group name">
          <span class="n" title="Sessions in it on the map">${members(g.id)}</span>
          <button class="btn danger" data-act="remove" data-group="${esc(g.id)}" title="Take the group down. Its sessions stay where they are, in no group.">✕</button></li>
          ${picking === g.id ? `<li class="palette">${ACCENTS.map((_, i) => `<button class="swatch ${i === g.color ? 'on' : ''}" data-act="color" data-group="${esc(g.id)}" data-color="${i}" style="${swatch(i)}" aria-label="Colour ${i + 1}"></button>`).join('')}</li>` : ''}`).join('')
          : '<li class="empty">None yet.</li>'}
      </ul>
      <div class="add">
        <input type="text" data-f="new" maxlength="${GROUP_NAME_MAX}" placeholder="New group, e.g. Auth rework" spellcheck="false">
        <button class="btn primary" data-act="add">Add</button>
      </div>
      ${groups.length ? `<h3>Sessions</h3>
      <ul class="members">
        ${live.length ? live.map((t) => `<li><span class="t" title="${esc(t.title)}">${t.group ? `<span class="flag" style="${swatch(t.group.color)}"></span>` : ''}${esc(t.title)}</span>
          <select data-f="member" data-id="${esc(t.id)}" aria-label="${esc(`Group of ${t.title}`)}">${options(t)}</select></li>`).join('')
          : '<li class="empty">No sessions on the map.</li>'}
      </ul>` : ''}
      <div class="actions"><button class="btn" data-act="close">Done</button></div>`
  }

  /** Draw it again, and put the keyboard back where it was, so Esc and Enter still reach the sheet. */
  function redraw(focus) {
    render()
    ;(focus && box.querySelector(focus))?.focus()
  }

  function add() {
    if (village.addGroup(project, box.querySelector('[data-f="new"]').value)) redraw('[data-f="new"]')
  }

  const at = (group) => `[data-act="colors"][data-group="${CSS.escape(group)}"]`

  box.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]')
    if (!b) return
    const { act, group } = b.dataset
    if (act === 'add') add()
    else if (act === 'close') close()
    else if (act === 'remove') {
      village.removeGroup(project, group)
      if (picking === group) picking = ''
      redraw('[data-f="new"]')
    } else if (act === 'colors') {
      picking = picking === group ? '' : group
      redraw(at(group))
    } else if (act === 'color') {
      village.recolorGroup(project, group, Number(b.dataset.color))
      picking = ''
      redraw(at(group))
    }
  })
  box.addEventListener('change', (e) => {
    const { f, group, id } = e.target.dataset
    if (f === 'member') {
      village.setGroup(id, e.target.value)
      redraw(`[data-f="member"][data-id="${CSS.escape(id)}"]`)
    } else if (f === 'name') {
      // Renamed where it stands rather than redrawn: the rename lands as the box is let go, and a
      // redraw then would pull whatever was clicked next out from under the pointer. A name that
      // can't be kept goes back to the one it had.
      village.renameGroup(project, group, e.target.value)
      const g = village.groupsOf(project).find((x) => x.id === group)
      if (!g) return
      e.target.value = g.name
      for (const o of box.querySelectorAll(`option[value="${CSS.escape(group)}"]`)) o.textContent = g.name
    }
  })
  box.addEventListener('keydown', (e) => {
    e.stopPropagation() // typing here must not steer the village
    if (e.key === 'Escape') close()
    // Enter in a name commits it as a change of its own, and the keyboard stays where it is.
    else if (e.key === 'Enter' && e.target.dataset.f === 'new') add()
  })

  function open(name) {
    if (!name) return
    project = name
    picking = ''
    render()
    box.hidden = false
    box.querySelector('[data-f="new"]').focus()
  }
  function close() {
    box.hidden = true
  }
  return { open, close, get isOpen() { return !box.hidden } }
}
