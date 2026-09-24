// What the sidebar's release button says and does, from what `/api/version` answered. Pure, so
// the whole ladder (notice → download → restart) is tested without a page.

/**
 * Whether to start fetching the newer build now: only when this copy can update itself and hasn't
 * begun on this version. A failed download waits for a click, which retries it.
 * @param {{ newer?: boolean, latest?: string, update?: { supported?: boolean, state?: string, version?: string } }} release
 */
export function shouldDownload(release) {
  const u = release?.update
  if (!release?.newer || !u?.supported) return false
  return u.version !== release.latest || u.state === 'idle'
}

/**
 * The footer button for a newer release, or null for none: `{ label, title, act }`, where `act`
 * is 'notes' (open the release notes), 'retry' (download again), 'install' (restart into it) or
 * 'wait' (nothing yet).
 * @param {{ newer?: boolean, current?: string, latest?: string, update?: { supported?: boolean, state?: string, version?: string, error?: string } }} release
 */
export function updateButton(release) {
  if (!release?.newer) return null
  const { current = '', latest = '' } = release
  const u = release.update
  const notes = { label: `${latest} available`, title: `You are running ${current}. Open the release notes.`, act: 'notes' }
  // A state about some other version is stale: the notice is all there is until the page asks.
  if (!u?.supported || u.version !== latest) return notes
  if (u.state === 'downloading') return { label: `Downloading ${latest}…`, title: `You are running ${current}. ${latest} is on its way.`, act: 'wait' }
  if (u.state === 'ready') return { label: `Restart for ${latest}`, title: `You are running ${current}. Restart AgentVille as ${latest}; your sessions carry on.`, act: 'install' }
  if (u.state === 'failed') return { label: `${latest} available`, title: `Couldn't download it: ${u.error || 'unknown error'}. Click to try again.`, act: 'retry' }
  return notes
}
