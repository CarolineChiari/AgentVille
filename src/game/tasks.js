// Ready-made jobs to hand a villager: the things you'd otherwise type into the thread over and
// over. Pure data, so the card, the new-session form and the tests all read the same list.
//
// Each prompt names its own stopping point. A task sent from the village runs without you
// watching, so "tell me instead" is how an ambiguous case gets back to you rather than guessed at.

export const TASKS = [
  {
    id: 'commit-push',
    label: 'Commit & push',
    prompt: 'Commit the work in this repo and push it to the current branch. Group changes that belong together into clear commits with messages that say why. If some changes look unfinished or unrelated to this work, leave them out and tell me what you skipped.',
  },
  {
    id: 'review',
    label: 'Check code quality',
    prompt: 'Review the changes in this repo that are not yet on the main branch (and any uncommitted ones) for code quality: bugs, edge cases, unclear names, duplication, missing error handling and missing tests. List what you find, most serious first. Do not change anything yet.',
  },
  {
    id: 'tests',
    label: 'Run tests & fix',
    prompt: "Run this project's tests, linter and type checks. If anything fails, fix the cause (not the test, unless the test is wrong) and run them again until they pass. Then summarise what failed and what you changed.",
  },
  {
    id: 'pr',
    label: 'Open a PR',
    prompt: 'Push this branch and open a pull request for it with the gh CLI. Write a title and description that explain what changed and why, and how it was tested. If this is the default branch, stop and ask me which branch to use instead.',
  },
  {
    id: 'sync',
    label: 'Update from main',
    prompt: 'Fetch the latest from the remote and bring this branch up to date with the default branch. Resolve any conflicts, keeping both sides’ intent, then run the tests. Tell me about any conflict you were not sure how to resolve.',
  },
  {
    id: 'summary',
    label: 'Summarise',
    prompt: 'Summarise where this work stands: what has changed, what is committed or not, what is left to do, and anything you need from me.',
  },
]

// A custom task is saved in village.json, which a person can edit by hand: these bound what it can
// hold. The prompt limit matches what an editor's link can carry, so a task always rides along in one.
export const LABEL_MAX = 40
export const PROMPT_MAX = 1800
export const CUSTOM_MAX = 20
const CUSTOM_ID = /^c-[a-z0-9-]{1,48}$/

/** A custom task as saved, or null when it isn't one. */
export function cleanTask(t) {
  if (!t || typeof t !== 'object') return null
  const label = typeof t.label === 'string' ? t.label.trim().slice(0, LABEL_MAX) : ''
  const prompt = typeof t.prompt === 'string' ? t.prompt.trim().slice(0, PROMPT_MAX) : ''
  if (typeof t.id !== 'string' || !CUSTOM_ID.test(t.id) || !label || !prompt) return null
  return { id: t.id, label, prompt }
}

/** A folder's own tasks, cleaned, without duplicates, at most CUSTOM_MAX. */
export function cleanTasks(list) {
  const out = []
  const ids = new Set()
  for (const t of Array.isArray(list) ? list : []) {
    const c = cleanTask(t)
    if (c && !ids.has(c.id) && out.length < CUSTOM_MAX) {
      ids.add(c.id)
      out.push(c)
    }
  }
  return out
}

/**
 * A new id from the label, unique within the folder. The `c-` prefix keeps a custom task from
 * ever colliding with a built-in one.
 */
export function customId(label, taken = []) {
  const slug = String(label).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'task'
  const used = new Set(taken)
  let id = `c-${slug}`
  for (let n = 2; used.has(id); n++) id = `c-${slug}-${n}`
  return id
}

/** Every task a folder offers: the built-in ones, then its own. */
export const tasksFor = (custom = []) => [...TASKS, ...cleanTasks(custom)]

export const taskById = (id, custom = []) => tasksFor(custom).find((t) => t.id === id) || null

/**
 * The job an open GitHub issue turns into, for a villager already on the repo or a new recruit.
 * The title is flattened and clipped so the prompt always fits PROMPT_MAX.
 */
export function issueTask(issue) {
  const n = Number(issue?.number) || 0
  const title = String(issue?.title || '').replace(/\s+/g, ' ').trim().slice(0, 200)
  const url = typeof issue?.url === 'string' && issue.url ? ` (${issue.url})` : ''
  const prompt = `Look at GitHub issue #${n} "${title}"${url}. Reproduce or understand it, then fix it and run the tests. Summarise what you changed. If the issue is unclear or bigger than it looks, stop and tell me instead of guessing.`
  return { id: `issue-${n}`, label: `Issue #${n}`, prompt: prompt.slice(0, PROMPT_MAX) }
}
