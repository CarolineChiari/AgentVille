// When the page rescans. The server says when a harness's files moved (`/api/events`), and the
// page polls at once. The timer stays as a heartbeat: slow while the stream is up, and back to
// the old pace the moment it drops, so a server that cannot watch costs nothing but a delay.
export const POLL_MS = 8_000
// Long enough to be cheap, short enough that a missed event (a folder the OS could not watch) is
// still noticed within the half-minute.
export const LIVE_POLL_MS = 30_000

/**
 * @param {{
 *   poll: () => Promise<unknown>|unknown,
 *   open: () => { onopen: Function|null, onerror: Function|null, addEventListener: Function, close: Function }|null,
 *   setTimer?: typeof setTimeout, clearTimer?: typeof clearTimeout,
 * }} opts `open` is `() => new EventSource('/api/events')`; injected so this runs under `node --test`.
 */
export function createLive({ poll, open, setTimer = setTimeout, clearTimer = clearTimeout }) {
  let connected = false
  let timer = null
  let source = null
  let stopped = true

  const schedule = () => {
    clearTimer(timer)
    if (stopped) return
    timer = setTimer(async () => {
      try {
        await poll()
      } finally {
        schedule()
      }
    }, connected ? LIVE_POLL_MS : POLL_MS)
  }
  const setConnected = (value) => {
    if (connected === value) return
    connected = value
    schedule() // the new pace applies from now, not after the old one runs out
  }

  return {
    start() {
      stopped = false
      try {
        source = open()
      } catch {
        source = null // no EventSource here: the plain poll it is
      }
      if (source) {
        source.onopen = () => setConnected(true)
        // EventSource reconnects by itself; until it does, poll at the quick pace.
        source.onerror = () => setConnected(false)
        source.addEventListener('changed', () => poll())
      }
      schedule()
    },
    stop() {
      stopped = true
      clearTimer(timer)
      source?.close()
      source = null
    },
    get connected() {
      return connected
    },
  }
}
