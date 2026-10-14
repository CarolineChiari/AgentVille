// Per-browser preferences. localStorage can throw or be empty (private windows, blocked storage),
// so every access is guarded and the defaults always work.
const KEY = 'agentville.settings'

export const DEFAULTS = {
  hideDormant: true,
  archiveAfterDays: 0, // archive threads untouched longer than this many days, counted from their last activity; 0: never
  prGardens: true, // grow flowers from the repo's pull requests (reads GitHub through `gh`)
  issueBoards: true, // pin the repo's open issues on a notice board (reads GitHub through `gh`)
  repoLines: true, // count the lines of code in each repo, for its landmark (reads the files, never runs anything)
  openIn: 'vscode', // 'vscode' | 'app' — where Open sends a Claude Code thread, and its New session default
  taskIn: 'thread', // 'thread' (where threads open) | 'terminal' | 'background' — where a Claude Code task runs
  notify: false, // a desktop notification when a villager starts needing you; turning it on asks permission
  newHarness: '', // last agent chosen in the new-session form ('' = the first one found)
  newTargets: {}, // harness id → last 'Open in' chosen for it (Claude's falls back to openIn)
  newModel: '', // last model chosen there ('' = your Claude Code default)
  newEffort: '', // last effort chosen there ('' = your default)
  theme: 'village', // the whole village's look: an id from src/sim/themes.js
  calendar: false, // dress the village for a holiday by itself, through its dates; see src/sim/calendar.js
  holidays: {}, // holiday id → ticked or not, where the person chose; else the holiday's own default
  landmarkSpot: 'top', // where each plot stands its landmark in its field: 'top' | 'middle' | 'bottom'
  subthemes: {}, // theme id → the sub-theme every folder wears unless it picked its own; none: each its own
  timeMode: 'live', // 'live' follows this machine's clock; 'manual' uses `hour`
  hour: 12,
  weather: true, // rain, snow and drifting leaves, from the date; see src/sim/weather.js
  season: 'auto', // with the clock set by hand: 'auto' or a season to look at
  sky: 'auto', // with the clock set by hand: 'auto' | 'clear' | 'rain' | 'snow'
  place: '', // where you live, to follow its real weather hourly (sends the place to Open-Meteo); empty: made up
  south: false, // the southern hemisphere's seasons
  // Every plot is named. A new key rather than flipping the old `allNames`, which browsers have
  // already saved as false.
  quietNames: false, // true: only name plots where something is happening
  villagerNames: true, // a small name under each villager when zoomed in
  motion: 'system', // 'system' follows the OS's reduced-motion flag | 'reduce' | 'full'; see src/game/motion.js
  uiVisible: true,
  seenHelp: false,
}

export function loadSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveSettings(s) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    // Not persisting a preference is fine.
  }
}
