// Toasts: short, one line, gone in a few seconds. At most three on screen.
// A toast may carry one action, a button on its right. That one stays up far longer: its whole
// point is to be there when something the OS was slow about — a window coming up — has happened.
const LIFE_MS = { info: 3200, error: 6000 }
const ACTION_LIFE_MS = 15000

export function createToasts(root) {
  const box = document.createElement('div')
  box.className = 'toasts'
  root.appendChild(box)
  /**
   * @param {string} text
   * @param {'info'|'error'} [kind]
   * @param {{ label: string, run: Function }} [action]
   */
  return function toast(text, kind = 'info', action = null) {
    const t = document.createElement('div')
    t.className = `toast ${kind}`
    const line = document.createElement('span')
    line.textContent = text
    t.appendChild(line)
    if (action?.label) {
      const b = document.createElement('button')
      b.className = 'act'
      b.type = 'button'
      b.textContent = action.label
      b.addEventListener('click', () => {
        t.remove()
        action.run?.()
      })
      t.appendChild(b)
    }
    box.appendChild(t)
    while (box.children.length > 3) box.firstChild.remove()
    setTimeout(() => t.remove(), action?.label ? ACTION_LIFE_MS : LIFE_MS[kind] || LIFE_MS.info)
  }
}
