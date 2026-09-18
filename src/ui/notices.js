// Desktop notifications when a villager starts needing you while the village is out of sight. The
// web Notification API, so a browser tab and the desktop app's window work the same way and
// nothing in electron/ has to know. The OS shows them; nothing is sent anywhere.
import { noticeFor } from '../game/notify.js'

/**
 * @param {{ settings: object, onOpen: (id: string) => void }} opts
 */
export function createNotices({ settings, onOpen }) {
  const api = globalThis.Notification
  const supported = typeof api === 'function'
  const showing = new Set()

  // Back in front of the village, where every ? is on the screen: the notifications have done
  // their job, and left in the notification centre they'd go stale as the questions get answered.
  addEventListener('focus', () => {
    for (const note of showing) note.close()
    showing.clear()
  })

  /**
   * Ask for permission if nobody has answered yet. Only ever called from the click that turned
   * the setting on: browsers bury, or refuse, a request that comes out of nowhere. Resolves to
   * whether notifications can be shown.
   */
  async function enable() {
    if (!supported) return false
    let p = api.permission
    if (p === 'default') {
      try {
        p = await api.requestPermission()
      } catch {
        p = 'denied'
      }
    }
    return p === 'granted'
  }

  /** Tell the person about threads that have just started needing them, if they asked to be told. */
  function show(fresh) {
    if (!settings.notify || !supported || api.permission !== 'granted') return
    // In front of you already: the villager's hop and the ? over its head do this job.
    if (document.visibilityState === 'visible' && document.hasFocus()) return
    const n = noticeFor(fresh)
    if (!n) return
    try {
      const note = new api(n.title, { body: n.body })
      showing.add(note)
      note.onclose = () => showing.delete(note)
      note.onclick = () => {
        window.focus()
        note.close()
        onOpen(n.id)
      }
    } catch {
      // Some browsers (Chrome on Android) only let a service worker show one. The ? is still there.
    }
  }

  return { supported, enable, show }
}
