// The browser's side of /api. Every call goes to this page's own origin.
import { mergeState } from './merge-state.js'

async function json(res) {
  const body = await res.json().catch(() => ({}))
  if (!res.ok && res.status !== 409) throw Object.assign(new Error(body.error || `HTTP ${res.status}`), { status: res.status, body })
  return { status: res.status, body }
}

const post = (path, body) =>
  fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(json)

export async function fetchThreads() {
  return (await json(await fetch('/api/threads'))).body
}

export async function fetchHarnesses() {
  return (await json(await fetch('/api/harnesses'))).body
}

export async function fetchState() {
  return (await json(await fetch('/api/state'))).body
}

/**
 * Save the whole state against the version it was built on. On 409, merge this tab's changes
 * onto what is on disk and try again.
 * @returns {Promise<object>} the state as stored, to adopt as the new base
 */
export async function saveState(local, base) {
  let mine = local
  let against = base
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch('/api/state', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...mine, baseUpdatedAt: against?.updatedAt ?? null }),
    })
    const { status, body } = await json(res)
    if (status !== 409) return body
    mine = mergeState(against, mine, body)
    against = body
  }
  throw new Error('Could not save: the village kept changing underneath this tab.')
}

export const openThread = (harness, ref, target) => post('/api/open', { harness, ref, target }).then((r) => r.body)
export const newSession = (folder, { harness, target, prompt = '', model = '', effort = '' } = {}) =>
  post('/api/new-session', { folder, harness, target, prompt, model, effort }).then((r) => r.body)
export const fetchTranscript = (harness, ref, limit = 300) => post('/api/transcript', { harness, ref, limit }).then((r) => r.body)
export const fetchPrs = async () => (await json(await fetch('/api/prs'))).body
export const fetchIssues = async () => (await json(await fetch('/api/issues'))).body
export const fetchRepos = async () => (await json(await fetch('/api/repos'))).body
export const openUrl = (url) => post('/api/open-url', { url }).then((r) => r.body)
export const reveal = (folder) => post('/api/reveal', { folder }).then((r) => r.body)
export const sendTask = (harness, ref, folder, prompt, target = '') => post('/api/task', { harness, ref, folder, prompt, target }).then((r) => r.body)
