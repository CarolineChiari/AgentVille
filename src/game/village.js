// The orchestrator: scan in, village out. Owns the saved state, the selection, and every action a
// person can take; the HUD and the renderer only read from it.
import * as api from './api.js'
import { classify, hideProject, unhideProject } from './hidden.js'
import { mergeState } from './merge-state.js'
import { STATUS_RANK } from '../sim/status.js'
import { demoThreads } from './demo.js'
import { flowerFor, flowerForPr, FLOWER_KINDS, WORK_LABEL } from '../sim/flowers.js'

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
    this.prs = { repos: {}, available: true, warnings: [] }
    this._prIndex = -1
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
      if (!this.demo && this.settings.prGardens) await this.pollPrs(false)
      this.apply()
    } catch (err) {
      this.toast(`Couldn't read sessions: ${err.message}`, 'error')
    }
  }

  /**
   * PRs come from the server's cache, which refreshes itself in the background. When it says it
   * is still fetching, look again shortly rather than waiting for the next poll.
   */
  async pollPrs(apply = true) {
    try {
      this.prs = await api.fetchPrs()
      clearTimeout(this._prTimer)
      if (this.prs.updating) this._prTimer = setTimeout(() => this.pollPrs(), 4000)
      if (apply) this.apply()
    } catch {
      // PRs are decoration; a failure here must never stop the village.
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
    const add = (project, f) => {
      if (!gardens.has(project)) gardens.set(project, [])
      gardens.get(project).push(f)
    }
    this.flowerInfo = new Map()

    // Pull requests first, so a finished thread whose PR is here shares that PR's flower.
    const prKeys = new Set()
    const threadForPr = new Map()
    for (const t of this.threads) if (t.prNumber) threadForPr.set(`${t.project}#${t.prNumber}`, t.id)
    if (this.settings.prGardens && !this.demo) {
      for (const [project, { slug, prs }] of Object.entries(this.prs.repos || {})) {
        if (off.has(project)) continue
        for (const pr of prs) {
          const id = `pr:${slug}#${pr.number}`
          const open = pr.state === 'OPEN'
          const f = flowerForPr(pr, id)
          // Open PRs go at the growing edge of the bed, after everything that has landed.
          const finishedAt = open ? Number.MAX_SAFE_INTEGER - (Date.now() - pr.createdAt) : pr.mergedAt
          const info = { ...f, finishedAt, open, pr, slug, project, threadId: threadForPr.get(`${project}#${pr.number}`) || null }
          this.flowerInfo.set(id, info)
          prKeys.add(`${project}#${pr.number}`)
          add(project, { id, kind: f.kind, color: f.color, white: f.white, open, finishedAt })
        }
      }
    }

    for (const t of this.view.archived) {
      if (!t.project || off.has(t.project)) continue
      if (t.prNumber && prKeys.has(`${t.project}#${t.prNumber}`)) continue
      const f = flowerFor(t)
      const finishedAt = this.state.archivedAt[t.id] || t.lastActivityAt || 0
      this.flowerInfo.set(t.id, { ...f, finishedAt, project: t.project })
      add(t.project, { id: t.id, kind: f.kind, color: f.color, white: false, open: false, finishedAt })
    }
    for (const list of gardens.values()) list.sort((a, b) => a.finishedAt - b.finishedAt || (a.id < b.id ? -1 : 1))
    this.gardens = gardens
  }

  /** Open PRs on the map, newest first. */
  openPrs() {
    return [...this.flowerInfo.entries()]
      .filter(([, f]) => f.open)
      .sort((a, b) => b[1].pr.createdAt - a[1].pr.createdAt)
      .map(([id]) => id)
  }

  nextOpenPr() {
    const list = this.openPrs()
    if (!list.length) {
      this.toast('No open PRs. Everything has landed.')
      return null
    }
    this._prIndex = (this._prIndex + 1) % list.length
    this.select(list[this._prIndex])
    return list[this._prIndex]
  }

  /** What a flower is, for the card: its name, the work it stands for, and when it bloomed. */
  flower(id) {
    const f = this.flowerInfo.get(id)
    if (!f) return null
    return { ...f, name: FLOWER_KINDS[f.kind].name, workLabel: WORK_LABEL[f.work] }
  }

  async openPr(id = this.selected) {
    const f = this.flowerInfo.get(id)
    if (!f?.pr?.url) return
    try {
      await api.openUrl(f.pr.url)
      this.toast(`Opening PR #${f.pr.number}`)
    } catch (err) {
      this.toast(err.message, 'error')
    }
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
      if (!map.has(name)) map.set(name, { name, path: this.projectPath(name), threads: [], flowers: 0, openPrs: 0 })
      return map.get(name)
    }
    for (const t of this.view.live) ensure(t.project).threads.push(t)
    for (const [name, list] of this.gardens) {
      const r = ensure(name)
      r.flowers = list.filter((f) => !f.open).length
      r.openPrs = list.filter((f) => f.open).length
    }
    const list = [...map.values()]
    for (const r of list) {
      r.threads.sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || b.lastActivityAt - a.lastActivityAt)
      r.counts = countStatuses(r.threads)
      r.last = Math.max(0, ...r.threads.map((t) => t.lastActivityAt || 0), ...(this.gardens.get(r.name) || []).map((f) => f.finishedAt))
      r.accent = this.world.plots.get(r.name)?.accent ?? 0
    }
    const urgency = (r) => (r.counts.blocked || r.counts.waiting ? 0 : r.counts.working || r.openPrs ? 1 : 2)
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
    if (id) this.selectedPlot = this.thread(id)?.project ?? this.flowerInfo.get(id)?.project ?? this.selectedPlot
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
    if (this.flowerInfo.get(id)?.pr) return this.openPr(id)
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

  /**
   * Start a session in a folder, optionally with a first prompt (prefilled in VS Code, copied to
   * the clipboard for the Claude app, whose link can't carry one). The new villager walks in from
   * the gate once the session writes its transcript, so look again a few times soon after.
   */
  async startSession(folder, prompt = '', { target = this.settings.openIn, model = '' } = {}) {
    if (!folder) return false
    if (this.demo) {
      this.toast('Demo mode: nothing to start.')
      return false
    }
    const where = { vscode: 'VS Code', terminal: 'a terminal', app: 'the Claude app' }[target] || 'Claude'
    try {
      const r = await api.newSession(folder, target, prompt, model)
      // Wherever the prompt couldn't travel with the session, it goes to the clipboard instead.
      const copied = prompt && !r.promptPassed && (await navigator.clipboard.writeText(prompt).then(() => true, () => false))
      this.toast(`Starting a new session in ${where}${model ? ` with ${model}` : ''}${copied ? ' — your prompt is on the clipboard' : ''}`)
      for (const ms of [5000, 12000, 25000]) setTimeout(() => this.poll(), ms)
      return true
    } catch (err) {
      this.toast(err.message, 'error')
      return false
    }
  }

  /** Every folder the village knows, for the new-session picker: repos with plots first. */
  knownFolders() {
    const seen = new Map()
    for (const t of [...this.view.live, ...this.threads]) {
      if (t.project && t.projectPath && !seen.has(t.projectPath)) seen.set(t.projectPath, t.project)
    }
    return [...seen].map(([path, name]) => ({ path, name })).sort((a, b) => a.name.localeCompare(b.name))
  }

  async transcript(id, limit) {
    const t = this.thread(id)
    if (!t) return { ok: false, error: 'Unknown thread.' }
    if (this.demo) return { ok: true, messages: [{ role: 'user', text: t.title, at: t.createdAt }, { role: 'assistant', text: 'Demo mode has no transcripts.', at: t.lastActivityAt }], total: 2 }
    try {
      return await api.fetchTranscript(t.harness, t.ref, limit)
    } catch (err) {
      return { ok: false, error: err.message }
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
