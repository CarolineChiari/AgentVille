// Per-browser preferences. localStorage can throw or be empty (private windows, blocked storage),
// so every access is guarded and the defaults always work.
const KEY = 'agentville.settings'

export const DEFAULTS = {
  hideDormant: true,
  prGardens: true, // grow flowers from the repo's pull requests (reads GitHub through `gh`)
  issueBoards: true, // pin the repo's open issues on a notice board (reads GitHub through `gh`)
  openIn: 'vscode', // 'vscode' | 'app' — where Open sends a Claude Code thread, and its New session default
  newHarness: '', // last agent chosen in the new-session form ('' = the first one found)
  newTargets: {}, // harness id → last 'Open in' chosen for it (Claude's falls back to openIn)
  newModel: '', // last model chosen there ('' = your Claude Code default)
  newEffort: '', // last effort chosen there ('' = your default)
  timeMode: 'live', // 'live' follows this machine's clock; 'manual' uses `hour`
  hour: 12,
  // Every plot is named. A new key rather than flipping the old `allNames`, which browsers have
  // already saved as false.
  quietNames: false, // true: only name plots where something is happening
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
