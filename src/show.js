// Hollywood hacker mode on one of your other screens: the desktop app opens this page on each of
// them while the show runs in the village (electron/main.mjs). Only the show, no village: it reads
// no sessions and asks the server for nothing.
import { createHacker } from './ui/hacker.js'
import { SHOW_CHANNEL } from './sim/hacker.js'
import { FAKE_REPOS } from './sim/hacker-text.js'
import { VILLAGER_NAMES } from './sim/names.js'
import { SESSION_RE } from './game/notify.js'
import { sprites } from './render/sprites/registry.js'
import { reducedMotion } from './game/motion.js'
import { loadSettings } from './ui/settings.js'

const query = new URLSearchParams(location.search)
const raw = query.get('seed')
const screenNo = Number(query.get('screen')) || 1
// Each screen a show of its own, so no two of them mirror each other.
const seed = typeof raw === 'string' && SESSION_RE.test(raw) ? `${raw}-${screenNo}` : String(Date.now())
const systemMotion = matchMedia('(prefers-reduced-motion: reduce)')
const still = () => reducedMotion(loadSettings(), systemMotion.matches)
document.body.classList.toggle('reduced-motion', still())

const channel = globalThis.BroadcastChannel ? new BroadcastChannel(SHOW_CHANNEL) : null
const hacker = createHacker(document.getElementById('hud'), {
  sprites,
  swap: { feed: 'cipher' }, // no village here for a live feed to follow
  names: () => VILLAGER_NAMES,
  repos: () => FAKE_REPOS,
  reducedMotion: still,
  // Stopped here, it stops everywhere: the village hears it, and the app closes this window.
  onStop: () => channel?.postMessage({ type: 'stop' }),
})
// The app already made this window full screen on its display.
hacker.start({ seed, fullscreen: false })
