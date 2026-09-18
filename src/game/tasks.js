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

export const taskById = (id) => TASKS.find((t) => t.id === id) || null
