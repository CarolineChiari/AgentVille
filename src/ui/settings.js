// Per-browser preferences. localStorage can throw or be empty (private windows, blocked storage),
// so every access is guarded and the defaults always work.
const KEY = 'agentville.settings'

export const DEFAULTS = {
  hideDormant: true,
  prGardens: true, // grow flowers from the repo's pull requests (reads GitHub through `gh`)
  openIn: 'vscode', // 'vscode' | 'app' — where Open and New session send you
  timeMode: 'live', // 'live' follows this machine's clock; 'manual' uses `hour`
  hour: 12,
  allNames: false,
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
