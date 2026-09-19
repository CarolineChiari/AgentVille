// The orchestrator: scan in, village out. Owns the saved state, the selection, and every action a
// person can take; the HUD and the renderer only read from it.
import * as api from './api.js'
import { classify, hideProject, unhideProject } from './hidden.js'
import { mergeState } from './merge-state.js'
import { STATUS_RANK } from '../sim/status.js'
import { newlyAsking } from './notify.js'
import { wearOf } from '../sim/wear.js'
import { demoIssues, demoThreads } from './demo.js'
import { CUSTOM_MAX, cleanTask, customId, issueTask, taskById, tasksFor } from './tasks.js'
import { flowerFor, flowerForPr, FLOWER_KINDS, WORK_LABEL } from '../sim/flowers.js'
import { finishedName, isLook, subthemeFor, themeOf } from '../sim/themes.js'

const SAVE_DELAY = 500

const emptyState = () => ({
  version: 1, archived: [], archivedAt: {}, plots: {}, seen: {}, hiddenProjects: [], viewedAt: {}, tasks: {}, looks: {}, settings: null, updatedAt: 0,
})

export class Village {
  /**
   * `notify` hears about every thread that has just started needing you, whatever the settings
   * say; whether that becomes a notification is up to it.
   * @param {{ world: import('../sim/world.js').World, settings: object, demo?: boolean, onChange?: Function, toast?: Function, notify?: Function }} opts
   */
  constructor({ world, settings, demo = false, onChange = () => {}, toast = () => {}, notify = () => {}, preview = null }) {
    this.world = world
    this.settings = settings
    this.demo = demo
    // A theme (and a sub-theme for every folder) to look at without saving it: ?theme=…&sub=… .
    this.preview = preview
    this.onChange = onChange
    this.toast = toast
    this.notify = notify
    this.state = emptyState()
    this.base = emptyState()
    this.threads = []
    this.byId = new Map()
    this.view = { live: [], folded: [], hidden: [], archived: [], dormant: [] }
    this.gardens = new Map() // repo → flowers, oldest first
    this.prs = { repos: {}, available: true, warnings: [] }
    this._prIndex = -1
    this.issues = { repos: {}, available: true, warnings: [] }
    this.issueInfo = new Map() // 'issue:<slug>#<n>' → { issue, slug, project }
    this.boards = new Map() // repo → its open issues' ids, newest first
    this._boardIndex = -1
    this.flowerInfo = new Map() // thread id → { kind, color, work, finishedAt }
    this.selected = null
    this.selectedPlot = null
    this.platform = ''
    this.harnesses = []
    this.warnings = []
    this.loaded = false
    this.scanned = false // a scan has come back, so `threads` is the real list and not the empty start
    this._asking = null // ids that needed you at the last look; null until the first one
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
        this.issues = demoIssues()
      } else {
        const r = await api.fetchThreads()
        this.threads = r.threads
        this.warnings = r.warnings || []
      }
      this.byId = new Map(this.threads.map((t) => [t.id, t]))
      this.scanned = true
      if (!this.demo) {
        await Promise.all([this.settings.prGardens && this.pollPrs(false), this.settings.issueBoards && this.pollIssues(false)])
      }
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

  /** Open issues, the same way: from the server's cache, looking again soon while it fetches. */
  async pollIssues(apply = true) {
    if (this.demo) return apply && this.apply()
    try {
      this.issues = await api.fetchIssues()
      clearTimeout(this._issueTimer)
      if (this.issues.updating) this._issueTimer = setTimeout(() => this.pollIssues(), 4000)
      if (apply) this.apply()
    } catch {
      // Issues are a nudge, not the village; a failure here must never stop it.
    }
  }

  /** Re-derive everything from the last scan and the saved state, and hand the roster to the world. */
  apply() {
    const first = !this.loaded
    this.view = classify(this.threads, this.state, { hideDormant: this.settings.hideDormant })
    let dirty = false
    const now = Date.now()
    const roster = this.view.live.map((t) => ({
      id: t.id, project: t.project, createdAt: t.createdAt, status: t.status, known: Boolean(this.state.seen[t.id]), wear: wearOf(t, now),
    }))
    for (const t of this.view.live) {
      if (!this.state.seen[t.id]) {
        this.state.seen[t.id] = now
        dirty = true
      }
    }
    this._plantGardens()
    this._pinBoards()
    this.world.setTheme(this.theme, this._picks(), this._everywhere())
    const memory = this.world.setRoster(roster, first ? new Map(Object.entries(this.state.plots)) : undefined, this.gardens, this.boards)
    const plots = Object.fromEntries(memory)
    if (JSON.stringify(plots) !== JSON.stringify(this.state.plots)) {
      this.state.plots = plots
      dirty = true
    }
    this.loaded = true
    // Not before the first scan: a settings change can apply the empty list, and the baseline
    // taken from that would make every question already waiting look new.
    if (this.scanned) {
      const { fresh, asking } = newlyAsking(this.view.live, this._asking)
      this._asking = asking
      if (fresh.length) this.notify(fresh)
    }
    const sel = this.selected
    if (sel && !this.world.villager(sel) && !this.world.flower(sel) && !this.world.board(sel)) this.selected = null
    if (dirty) this.queueSave()
    this.onChange()
  }

  /**
   * Every finished thread is a flower in its repo's garden, in the order it finished. A resting
   * repo (every thread asleep) folds its villagers away but keeps its garden: that's history you
   * come back to look at. Only hiding a repo takes its garden off the map too.
   */
  _plantGardens() {
    const off = new Set(this.state.hiddenProjects)
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

  /** Each repo's open issues, newest first, for its notice board. Hidden repos put theirs away too. */
  _pinBoards() {
    const off = new Set(this.state.hiddenProjects)
    const boards = new Map()
    this.issueInfo = new Map()
    if (this.settings.issueBoards) {
      for (const [project, { slug, issues }] of Object.entries(this.issues.repos || {})) {
        if (off.has(project) || !Array.isArray(issues) || !issues.length) continue
        const list = [...issues].sort((a, b) => b.createdAt - a.createdAt || b.number - a.number)
        for (const issue of list) this.issueInfo.set(`issue:${slug}#${issue.number}`, { issue, slug, project })
        boards.set(project, list.map((i) => ({ id: `issue:${slug}#${i.number}` })))
      }
    }
    this.boards = boards
  }

  /** Repos whose notice board is on the map, the one with the newest issue first. */
  boardsOnMap() {
    const newest = (p) => this.issueInfo.get(this.boards.get(p)[0].id)?.issue.createdAt || 0
    return [...this.boards.keys()].filter((p) => this.world.plots.has(p)).sort((a, b) => newest(b) - newest(a))
  }

  /** Every open issue pinned on a board you can see. */
  openIssues() {
    return this.boardsOnMap().flatMap((p) => this.boards.get(p).map((n) => n.id))
  }

  nextIssueBoard() {
    const list = this.boardsOnMap()
    if (!list.length) {
      this.toast('No open issues. The notice boards are empty.')
      return null
    }
    this._boardIndex = (this._boardIndex + 1) % list.length
    const id = `board:${list[this._boardIndex]}`
    this.select(id)
    return id
  }

  /** A notice board, for the card: its repo, its issues, and who on that plot is free to take one. */
  board(id) {
    if (typeof id !== 'string' || !id.startsWith('board:')) return null
    const project = id.slice('board:'.length)
    const notes = this.boards.get(project)
    if (!notes) return null
    const issues = notes.map((n) => ({ id: n.id, ...this.issueInfo.get(n.id).issue }))
    return { id, project, slug: this.issueInfo.get(notes[0].id).slug, issues, candidates: this.idleVillagers(project) }
  }

  /** Villagers on a repo who could take on a job now, most recently active first. */
  idleVillagers(project) {
    return this.view.live
      .filter((t) => t.project === project && !t.running && !t.needsInput)
      .sort((a, b) => (b.lastActivityAt || 0) - (a.lastActivityAt || 0))
  }

  async openIssue(id) {
    const info = this.issueInfo.get(id)
    if (!info?.issue.url) return
    try {
      await api.openUrl(info.issue.url)
      this.toast(`Opening issue #${info.issue.number}`)
    } catch (err) {
      this.toast(err.message, 'error')
    }
  }

  /** The repo's whole issue list on GitHub, for when the board can't show them all. */
  async openIssuesPage(project) {
    const notes = this.boards.get(project)
    const slug = notes && this.issueInfo.get(notes[0].id)?.slug
    if (!slug || this.demo) return
    try {
      await api.openUrl(`https://github.com/${slug}/issues`)
    } catch (err) {
      this.toast(err.message, 'error')
    }
  }

  /** The prompt an issue becomes, for a new session. */
  issuePrompt(id) {
    const info = this.issueInfo.get(id)
    return info ? issueTask(info.issue).prompt : ''
  }

  /** Hand an issue to a villager on its repo: the one named, else whoever was most recently active and is free. */
  async sendIssue(id, threadId = '') {
    const info = this.issueInfo.get(id)
    if (!info) return
    const to = threadId ? this.thread(threadId) : this.idleVillagers(info.project)[0]
    if (!to) return this.toast(`Nobody is free on ${info.project}. Recruit a villager instead.`, 'error')
    const task = issueTask(info.issue)
    return this.sendPrompt(to.id, task.label, task.prompt)
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
    const theme = this.lookOf(f.project).theme
    return { ...f, theme, name: finishedName(theme, f.kind), workLabel: WORK_LABEL[f.work] }
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
      if (!map.has(name)) map.set(name, { name, path: this.projectPath(name), threads: [], flowers: 0, openPrs: 0, openIssues: 0 })
      return map.get(name)
    }
    for (const t of this.view.live) ensure(t.project).threads.push(t)
    for (const [name, list] of this.gardens) {
      const r = ensure(name)
      r.flowers = list.filter((f) => !f.open).length
      r.openPrs = list.filter((f) => f.open).length
    }
    // Only repos already listed: issues alone don't put a repo on the map.
    for (const [name, notes] of this.boards) if (map.has(name)) map.get(name).openIssues = notes.length
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
    if (id) this.selectedPlot = this.thread(id)?.project ?? this.flowerInfo.get(id)?.project ?? this.world.board(id)?.plot ?? this.selectedPlot
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
      this.toast('Nobody needs you right now.')
      return null
    }
    this._nextIndex = (this._nextIndex + 1) % asking.length
    const t = asking[this._nextIndex]
    this.select(t.id)
    return t.id
  }

  /** The next finished thread to review, most recent first. */
  nextDone() {
    const done = this.view.live.filter((t) => t.status === 'done').sort((a, b) => b.lastActivityAt - a.lastActivityAt)
    if (!done.length) {
      this.toast('Nothing waiting for review.')
      return null
    }
    this._doneIndex = ((this._doneIndex ?? -1) + 1) % done.length
    this.select(done[this._doneIndex].id)
    return done[this._doneIndex].id
  }

  // ---------- actions ----------

  async open(id = this.selected) {
    if (this.flowerInfo.get(id)?.pr) return this.openPr(id)
    const board = this.board(id)
    if (board) return this.openIssuesPage(board.project)
    const t = this.thread(id)
    if (!t) return
    if (this.demo) return this.toast('Demo mode: nothing to open.')
    if (!t.canOpen) return this.toast(`This thread has nothing ${t.harnessName || 'Claude'} can open.`, 'error')
    try {
      const r = await api.openThread(t.harness, t.ref, this.settings.openIn)
      this.toast(r.note || `Opening “${t.title}”${r.where ? ` in ${r.where}` : ''}`)
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
   * Start a session in a folder with one of the detected harnesses, optionally with a first prompt
   * (sent along where the harness's link or CLI can carry it, copied to the clipboard where it
   * can't). The new villager walks in from the gate once the session writes its transcript, so
   * look again a few times soon after.
   */
  async startSession(folder, prompt = '', { harness = '', target = '', model = '', effort = '' } = {}) {
    if (!folder) return false
    if (this.demo) {
      this.toast('Demo mode: nothing to start.')
      return false
    }
    try {
      const r = await api.newSession(folder, { harness, target, prompt, model, effort })
      const where = r.where || 'a new window'
      // Wherever the prompt couldn't travel with the session, it goes to the clipboard instead.
      const copied = prompt && !r.promptPassed && (await navigator.clipboard.writeText(prompt).then(() => true, () => false))
      const how = [model, effort && `${effort} effort`].filter(Boolean).join(', ')
      this.toast(`Starting a new session in ${where}${how ? ` with ${how}` : ''}${copied ? ' — your prompt is on the clipboard' : ''}`)
      for (const ms of [5000, 12000, 25000]) setTimeout(() => this.poll(), ms)
      return true
    } catch (err) {
      this.toast(err.message, 'error')
      return false
    }
  }

  /**
   * Hand a thread one of the ready-made tasks. It goes into the thread's own conversation where
   * the harness can resume one with a prompt, so the agent knows what it just did; otherwise it
   * starts a new session in the same folder, wherever new sessions for that harness last went.
   */
  async runTask(id, taskId) {
    const t = this.thread(id)
    const task = t && taskById(taskId, this.customTasks(t.project))
    if (!t || !task) return
    return this.sendPrompt(id, task.label, task.prompt)
  }

  /** Send a thread a prompt, as a task called `label`: into its conversation if it can be resumed, else a new session. */
  async sendPrompt(id, label, prompt) {
    const t = this.thread(id)
    if (!t) return
    const task = { label, prompt }
    if (this.demo) return this.toast('Demo mode: nothing to send.')
    // Two processes answering one conversation would talk over each other.
    if (t.running || t.needsInput) return this.toast('This villager is busy. Send it a task once it has stopped.', 'error')
    const s = this.settings
    const target = s.newTargets?.[t.harness] || (t.harness === 'claude-code' ? s.openIn : '')
    try {
      const r = await api.sendTask(t.harness, t.ref, t.cwd || t.projectPath, task.prompt, target)
      const copied = !r.promptPassed && (await navigator.clipboard.writeText(task.prompt).then(() => true, () => false))
      const where = r.where ? ` in ${r.where}` : ''
      const clip = copied ? ' — the task is on the clipboard' : ''
      this.toast(r.continued ? `“${task.label}” sent to “${t.title}”${where}${clip}` : `Starting “${task.label}” as a new session${where}${clip}`)
      for (const ms of [5000, 12000, 25000]) setTimeout(() => this.poll(), ms)
    } catch (err) {
      this.toast(err.message, 'error')
    }
  }

  /** The village's theme: the one being previewed, else the one in the settings. */
  get theme() {
    return themeOf(this.preview?.theme || this.settings.theme)
  }

  /** Each folder's own look, where it picked one: a sub-theme of any theme. */
  _picks() {
    const out = new Map()
    for (const [project, look] of Object.entries(this.state.looks || {})) if (isLook(look)) out.set(project, look)
    return out
  }

  /** The sub-theme every folder without its own look wears, if the settings (or a preview) name one. */
  _everywhere() {
    return this.preview?.sub || this.settings.subthemes?.[this.theme] || null
  }

  /** The look a folder picked for itself, `{ theme, sub }`, or null if it follows the village. */
  lookPick(project) {
    const l = this.state.looks?.[project]
    return isLook(l) ? l : null
  }

  /** The look a folder wears when it follows the village: the village's theme, as the sub-theme it's handed. */
  lookHanded(project) {
    return { theme: this.theme, sub: subthemeFor(project, this.theme, this._everywhere()) }
  }

  /** The look a folder wears: its own pick, else the village's. */
  lookOf(project) {
    return this.lookPick(project) || this.lookHanded(project)
  }

  /**
   * Dress a folder in any theme's sub-theme, `{ theme, sub }`, or with null let it follow the
   * village again. It keeps its look whatever the village's theme becomes.
   */
  setLook(project, look) {
    if (!project) return
    const looks = { ...this.state.looks }
    if (isLook(look)) looks[project] = { theme: look.theme, sub: look.sub }
    else delete looks[project]
    this.state.looks = looks
    this.queueSave()
    this.apply()
  }

  /** A repo's own tasks, as saved. */
  customTasks(project) {
    return this.state.tasks?.[project] || []
  }

  /** Every task a repo offers: the built-in ones, then its own. */
  tasksFor(project) {
    return tasksFor(this.customTasks(project))
  }

  /**
   * Add a task to a repo, or replace one of its own when `id` names it. Returns false (and says
   * why) when there is nothing to save.
   */
  saveTask(project, { id = '', label = '', prompt = '' }) {
    if (!project) return false
    const list = this.customTasks(project)
    const i = list.findIndex((x) => x.id === id)
    const task = cleanTask({ id: i >= 0 ? id : customId(label, list.map((x) => x.id)), label, prompt })
    if (!task) {
      this.toast('A task needs a name and a prompt.', 'error')
      return false
    }
    if (i < 0 && list.length >= CUSTOM_MAX) {
      this.toast(`${project} already has ${CUSTOM_MAX} tasks of its own.`, 'error')
      return false
    }
    this.state.tasks = { ...this.state.tasks, [project]: i >= 0 ? list.map((x, j) => (j === i ? task : x)) : [...list, task] }
    this.queueSave()
    this.onChange()
    return true
  }

  removeTask(project, id) {
    const list = this.customTasks(project).filter((x) => x.id !== id)
    const tasks = { ...this.state.tasks }
    if (list.length) tasks[project] = list
    else delete tasks[project]
    this.state.tasks = tasks
    this.queueSave()
    this.onChange()
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
  const c = { working: 0, waiting: 0, blocked: 0, done: 0, celebrating: 0, idle: 0, sleeping: 0 }
  for (const t of threads) c[t.status] = (c[t.status] || 0) + 1
  return c
}
