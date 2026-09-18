// Toasts: short, one line, gone in a few seconds. At most three on screen.
export function createToasts(root) {
  const box = document.createElement('div')
  box.className = 'toasts'
  root.appendChild(box)
  return function toast(text, kind = 'info') {
    const t = document.createElement('div')
    t.className = `toast ${kind}`
    t.textContent = text
    box.appendChild(t)
    while (box.children.length > 3) box.firstChild.remove()
    setTimeout(() => t.remove(), kind === 'error' ? 6000 : 3200)
  }
}
