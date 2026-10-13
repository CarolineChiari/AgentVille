// Tells the page when a harness's files moved, so it can rescan now instead of on its next
// poll. Read-only: `fs.watch` only listens, nothing is written to what it watches.
import fs from 'node:fs'

// A session writes its transcript many times a second while it works. One notice per window
// is plenty: the page rescans everything anyway, and a trailing window never starves under a
// steady stream of writes.
export const DEBOUNCE_MS = 300

/**
 * One shared watcher over every harness's directories. It only holds OS watches while someone is
 * listening, so a village with no page open costs nothing.
 *
 * @param {{
 *   dirs: () => Promise<string[]>|string[],
 *   watch?: typeof fs.watch,
 *   debounceMs?: number,
 *   setTimer?: typeof setTimeout,
 *   clearTimer?: typeof clearTimeout,
 * }} opts `dirs` and the timers are injectable so tests need no files and no waiting.
 */
export function createWatcher({ dirs, watch = fs.watch, debounceMs = DEBOUNCE_MS, setTimer = setTimeout, clearTimer = clearTimeout }) {
  const listeners = new Set()
  let handles = []
  let timer = null
  let opening = null

  const notify = () => {
    timer = null
    for (const fn of [...listeners]) fn()
  }
  const touched = () => {
    if (!timer) timer = setTimer(notify, debounceMs)
  }

  /** Recursive where the OS can; otherwise just the directory (the heartbeat poll covers the rest). */
  const open = (dir) => {
    for (const recursive of [true, false]) {
      try {
        const h = watch(dir, { recursive, persistent: false }, touched)
        h.on?.('error', () => {}) // a watched folder deleted under us must not crash the server
        return h
      } catch {
        // recursive watching is unavailable here, or the directory is not there yet
      }
    }
    return null
  }

  const start = () => {
    opening = (async () => {
      let list = []
      try {
        list = await dirs()
      } catch {
        // an adapter that cannot say where it lives is simply not watched
      }
      // The last listener may have left while the directories were being worked out.
      if (!listeners.size) return
      handles = [...new Set(list)].map(open).filter(Boolean)
    })()
  }

  const stop = () => {
    clearTimer(timer)
    timer = null
    for (const h of handles) {
      try {
        h.close()
      } catch {
        // already closed
      }
    }
    handles = []
  }

  return {
    /** Calls `fn` (no arguments) when something changed. Returns the way to stop. */
    subscribe(fn) {
      listeners.add(fn)
      if (listeners.size === 1) start()
      return () => {
        listeners.delete(fn)
        if (listeners.size) return
        const pending = opening
        opening = null
        Promise.resolve(pending).then(() => !listeners.size && stop())
      }
    },
    get watching() {
      return handles.length
    },
  }
}
