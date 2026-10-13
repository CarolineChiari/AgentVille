// Tells the page when a harness's files moved, so it can rescan now instead of on its next
// poll. Read-only: `fs.watch` only listens, nothing is written to what it watches.
import fs from 'node:fs'

// A session writes its transcript many times a second while it works. One notice per window
// is plenty: the page rescans everything anyway, and a trailing window never starves under a
// steady stream of writes.
export const DEBOUNCE_MS = 300
// How often a directory that was missing is looked for again while a page is listening.
export const RETRY_MS = 30_000

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
  const watched = new Map() // dir → handle
  let timer = null
  let retry = null
  // Bumped on every start and stop, so a directory lookup that finishes after the last listener
  // left (or after a new first one arrived) is recognised as stale and dropped.
  let generation = 0

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

  /** Watches every directory not watched yet; one that is not there yet is looked for again later. */
  const attach = async (mine) => {
    let list = []
    try {
      list = await dirs()
    } catch {
      // an adapter that cannot say where it lives is simply not watched
    }
    if (mine !== generation) return
    let missing = false
    for (const dir of new Set(list)) {
      if (watched.has(dir)) continue
      const h = open(dir)
      if (h) watched.set(dir, h)
      else missing = true
    }
    // A harness's folder appears the first time it is used, long after the page connected.
    if (missing) {
      retry = setTimer(() => attach(mine), RETRY_MS)
      retry?.unref?.()
    }
  }

  const stop = () => {
    generation++
    clearTimer(timer)
    clearTimer(retry)
    timer = retry = null
    for (const h of watched.values()) {
      try {
        h.close()
      } catch {
        // already closed
      }
    }
    watched.clear()
  }

  return {
    /** Calls `fn` (no arguments) when something changed. Returns the way to stop. */
    subscribe(fn) {
      listeners.add(fn)
      if (listeners.size === 1) attach(++generation)
      return () => {
        listeners.delete(fn)
        if (!listeners.size) stop()
      }
    },
    get watching() {
      return watched.size
    },
  }
}
