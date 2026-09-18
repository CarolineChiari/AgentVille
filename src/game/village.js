// The orchestrator: scan in, village out. Owns the saved state, the selection, and every action a
// person can take; the HUD and the renderer only read from it.
import * as api from './api.js'
import { classify, hideProject, unhideProject } from './hidden.js'
import { mergeState } from './merge-state.js'
import { STATUS_RANK } from '../sim/status.js'
import { demoThreads } from './demo.js'
import { flowerFor, FLOWER_KINDS, WORK_LABEL } from '../sim/flowers.js'

const SAVE_DELAY = 500

const emptyState = () => ({
  version: 1, archived: [], archivedAt: {}, plots: {}, seen: {}, hiddenProjects: [], viewedAt: {}, settings: null, updatedAt: 0,
})

export class Village {
  /**
   * @param {{ world: import('../sim/world.js').World, settings: object, demo?: boolean, onChange?: Function, toast?: Function }} opts
   */
  constructor({ world, settings, demo = false, onChange = () => {}, toast = () => {} }) {
    this.world = world
    this.settings = settings
    this.demo = demo
    this.onChange = onChange
    this.toast = toast
    this.state = emptyState()
    this.base = emptyState()
    this.threads = []
    this.byId = new Map()
    this.view = { live: [], folded: [], hidden: [], archived: [], dormant: [] }
    this.gardens = new Map() // repo → flowers, oldest first
    this.flowerInfo = new Map() // thread id → { kind, color, work, finishedAt }
    this.selected = null
    this.selectedPlot = null
    this.platform = ''
    this.harnesses = []
    this.warnings = []
    this.loaded = false
    this._saveTimer = null
    this._saving = null
    this._nextIndex = -1
  }

  async load() {
    if (this.demo) {
      this.platform = 'demo'
      return
    }
    const [state, h] = await Promise.all([api.fetchState(), api.fetchHarnesses().catch(() => ({ harnesses: [], platform: '' }))])
    this.state = state
    this.base = structuredClone(state)
    this.harnesses = h.harnesses || []
    this.platform = h.platform || ''
  }

  async poll() {
    try {
      if (this.demo) {
        this.threads = demoThreads()
        this.warnings = []
      } else {
        const r = await api.fetchThreads()
        this.threads = r.threads
        this.warnings = r.warnings || []
      }
      this.byId = new Map(this.threads.map((t) => [t.id, t]))
      this.apply()
    } catch (err) {
      this.toast(`Couldn't read sessions: ${err.message}`, 'error')
    }
  }

  /** Re-derive everything from the last scan and the saved state, and hand the roster to the world. */
  apply() {
    const first = !this.loaded
    this.view = classify(this.threads, this.state, { hideDormant: this.settings.hideDormant })
    let dirty = false
    const now = Date.now()
    const roster = this.view.live.map((t) => ({
      id: t.id, project: t.project, createdAt: t.createdAt, status: t.status, known: Boolean(this.state.seen[t.id]),
    }))
    for (const t of this.view.live) {
      if (!this.state.seen[t.id]) {
        this.state.seen[t.id] = now
        dirty = true
      }
    }
    this._plantGardens()
    const memory = this.world.setRoster(roster, first ? new Map(Object.entries(this.state.plots)) : undefined, this.gardens)
    const plots = Object.fromEntries(memory)
    if (JSON.stringify(plots) !== JSON.stringify(this.state.plots)) {
      this.state.plots = plots
      dirty = true
    }
    this.loaded = true
    if (this.selected && !this.world.villager(this.selected) && !this.world.flower(this.selected)) this.selected = null
    if (dirty) this.queueSave()
    this.onChange()
  }

  /**
   * Every finished thread is a flower in its repo's garden, in the order it finished. Hidden and
   * folded repos keep their gardens off the map along with everything else of theirs.
   */
  _plantGardens() {
    const off = new Set([...this.state.hiddenProjects, ...this.view.dormant])
    const gardens = new Map()
    this.flowerInfo = new Map()
    for (const t of this.view.archived) {
      if (!t.project || off.has(t.project)) continue
      const f = flowerFor(t)
      const finishedAt = this.state.archivedAt[t.id] || t.lastActivityAt || 0
      this.flowerInfo.set(t.id, { ...f, finishedAt })
      if (!gardens.has(t.project)) gardens.set(t.project, [])
      gardens.get(t.project).push({ id: t.id, kind: f.kind, color: f.color, finishedAt })
    }
    for (const list of gardens.values()) list.sort((a, b) => a.finishedAt - b.finishedAt || (a.id < b.id ? -1 : 1))
    this.gardens = gardens
  }

  /** What a flower is, for the card: its name, the work it stands for, and when it bloomed. */
  flower(id) {
    const f = this.flowerInfo.get(id)
    if (!f) return null
    return { ...f, name: FLOWER_KINDS[f.kind].name, workLabel: WORK_LABEL[f.work] }
  }

  isFinished(id) {
    return this.flowerInfo.has(id)
  }

  // ---------- saving ----------

  queueSave() {
    if (this.demo) return
    clearTimeout(this._saveTimer)
    this._saveTimer = setTimeout(() => this._save(), SAVE_DELAY)
  }

  async _save() {
    if (this._saving) {
      await this._saving
      return this.queueSave()
    }
    const sent = structuredClone(this.state)
    this._saving = api
      .saveState(sent, this.base)
      .then((stored) => {
        // Anything changed while the save was in flight is merged onto what was stored.
        this.state = mergeState(sent, this.state, stored)
        this.state.updatedAt = stored.updatedAt
        this.base = structuredClone(stored)
      })
      .catch((err) => this.toast(err.message, 'error'))
      .finally(() => (this._saving = null))
    await this._saving
  }

  // ---------- reading ----------

  thread(id) {
    const t = this.byId.get(id)
    if (!t) return null
    const live = this.view.live.find((x) => x.id === id)
    return live || t
  }

  /** Repos on the map with their threads, most urgent first. A repo with only a garden still counts. */
  repos() {
    const map = new Map()
    const ensure = (name) => {
      if (!map.has(name)) map.set(name, { name, path: this.projectPath(name), threads: [], flowers: 0 })
      return map.get(name)
    }
    for (const t of this.view.live) ensure(t.project).threads.push(t)
    for (const [name, list] of this.gardens) ensure(name).flowers = list.length
    const list = [...map.values()]
    for (const r of list) {
      r.threads.sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || b.lastActivityAt - a.lastActivityAt)
      r.counts = countStatuses(r.threads)
      r.last = Math.max(0, ...r.threads.map((t) => t.lastActivityAt || 0), ...(this.gardens.get(r.name) || []).map((f) => f.finishedAt))
      r.accent = this.world.plots.get(r.name)?.accent ?? 0
    }
    const urgency = (r) => (r.counts.blocked || r.counts.waiting ? 0 : r.counts.working ? 1 : 2)
    return list.sort((a, b) => urgency(a) - urgency(b) || b.last - a.last)
  }

  counts() {
    return countStatuses(this.view.live)
  }

  projectPath(name) {
    const t = this.threads.find((x) => x.project === name)
    return t?.projectPath || ''
  }

  // ---------- selection ----------

  select(id) {
    this.selected = id
    if (id) this.selectedPlot = this.thread(id)?.project ?? this.selectedPlot
    this.onChange()
  }

  selectPlot(name) {
    this.selectedPlot = name
    if (!name) this.selected = null
    else if (this.selected && this.thread(this.selected)?.project !== name) this.selected = null
    this.onChange()
  }

  /** The next villager asking for you, most recent first: a months-old unread thread can wait. */
  nextWaiting() {
    const asking = this.view.live
      .filter((t) => t.status === 'waiting' || t.status === 'blocked')
      .sort((a, b) => b.lastActivityAt - a.lastActivityAt)
    if (!asking.length) {
      this.toast('Nobody is waiting on you.')
      return null
    }
    this._nextIndex = (this._nextIndex + 1) % asking.length
    const t = asking[this._nextIndex]
    this.select(t.id)
    return t.id
  }

  // ---------- actions ----------

  async open(id = this.selected) {
    const t = this.thread(id)
    if (!t) return
    if (this.demo) return this.toast('Demo mode: nothing to open.')
    if (!t.canOpen) return this.toast('This thread has nothing Claude can open.', 'error')
    const target = this.settings.openIn
    try {
      const r = await api.openThread(t.harness, t.ref, target)
      this.toast(r.note || `Opening “${t.title}” in ${target === 'vscode' ? 'VS Code' : 'the Claude app'}`)
    } catch (err) {
      this.toast(err.message, 'error')
    }
  }

  viewed(id = this.selected) {
    const t = this.thread(id)
    if (!t) return
    this.state.viewedAt[id] = Math.max(Date.now(), t.lastActivityAt || 0)
    this.apply()
    this.queueSave()
  }

  archive(id = this.selected) {
    const t = this.thread(id)
    if (!t) return
    if (!this.state.archived.includes(id)) this.state.archived.push(id)
    this.state.archivedAt[id] = Date.now()
    if (this.selected === id) this.selected = null
    this.apply()
    this.queueSave()
    this.toast(`Archived “${t.title}”`)
  }

  unarchive(id) {
    this.state.archived = this.state.archived.filter((x) => x !== id)
    delete this.state.archivedAt[id]
    // Walking back in from the gate reads better than popping into place.
    delete this.state.seen[id]
    this.apply()
    this.queueSave()
  }

  hide(name = this.selectedPlot) {
    if (!name) return
    this.state = hideProject(this.state, name)
    if (this.selectedPlot === name) this.selectPlot(null)
    this.apply()
    this.queueSave()
    this.toast(`Hid ${name}. It's in the sidebar under Hidden.`)
  }

  unhide(name) {
    this.state = unhideProject(this.state, name)
    this.apply()
    this.queueSave()
  }

  async newSession(name = this.selectedPlot) {
    const path = this.projectPath(name)
    if (!path) return
    if (this.demo) return this.toast('Demo mode: nothing to start.')
    try {
      await api.newSession(path, this.settings.openIn)
      this.toast(`Starting a new session in ${name}${this.settings.openIn === 'vscode' ? ' in VS Code' : ''}`)
    } catch (err) {
      this.toast(err.message, 'error')
    }
  }

  async reveal(name = this.selectedPlot) {
    const path = this.projectPath(name)
    if (!path || this.demo) return
    try {
      await api.reveal(path)
    } catch (err) {
      this.toast(err.message, 'error')
    }
  }

  async copyPath(name = this.selectedPlot) {
    const path = this.projectPath(name)
    if (!path) return
    try {
      await navigator.clipboard.writeText(path)
      this.toast('Path copied')
    } catch {
      this.toast(path)
    }
  }
}

export function countStatuses(threads) {
  const c = { working: 0, waiting: 0, blocked: 0, celebrating: 0, idle: 0, sleeping: 0 }
  for (const t of threads) c[t.status] = (c[t.status] || 0) + 1
  return c
}
