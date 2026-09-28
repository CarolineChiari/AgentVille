# Writing a harness adapter

A **harness** is a coding-agent tool AgentVille reads sessions from — Claude Code, Copilot, Cursor,
Antigravity today. Adding one is one new directory under `server/harnesses/` plus one line in
`server/harnesses/index.mjs`. Everything else — `server/scan.mjs`, `server/api.mjs`, the whole of
`src/` — is written against the `Thread` shape below and never against a harness, so a new adapter
needs no changes anywhere else.

Start from the smallest existing adapter that's shaped like the one you're writing:
`server/harnesses/cursor/index.mjs` and `server/harnesses/antigravity/index.mjs` are single-file,
read-only adapters over a local database; `server/harnesses/claude-code/` is the biggest, split
across files, because it merges three separate stores (desktop records, CLI transcripts, live
processes) into one thread.

## The `Thread` shape

`server/harnesses/types.mjs` is the contract, kept current as JSDoc; this is what each field is
*for*. `server/harnesses/thread.mjs`'s `makeThread(harness, harnessName, fields)` fills in every
field's neutral value from whatever you give it, so a harness that knows less still returns a
complete, valid `Thread`.

| Field | Drives |
| --- | --- |
| `project` (or `projectPath`'s basename) | Which plot the thread stands on. Same name, same plot, across every harness |
| `lastActivityAt` | Sort order, and — three days stale — the "asleep" state |
| `running` | The working animation, hammering and sparks |
| `needsInput` | The waving `?`: `'dialog open'`, `'permission prompt'`, `'sandbox request'`, `'worker request'`, or any other non-empty string for a generic "needs your input" |
| `unread` | The done-and-waiting-for-review state, once the thread isn't `running` |
| `hasError` | The slumped "stuck on an error" state — takes priority over everything else |
| `prState` (`'MERGED'`) | The one-off jump-for-joy celebration, for three days after |
| `archived` | Read-only, from the harness's own records: walks the villager back through the portal |
| `canOpen` / `opensIn` | Whether a click can open anything, and where — 'VS Code', 'the Claude app', or `''` to follow the person's Open-in setting |
| `ref` | Opaque to everything but your own adapter: handed straight back to `openThread`, `readTranscript`, `readChanges`, `continueThread` |

`src/sim/status.js`'s `statusFor` is the single place all of this is turned into one of
`blocked / waiting / working / celebrating / done / sleeping / idle`, strict precedence, first
match wins — read it if you want to see exactly how your fields will be judged.

## The adapter's shape

An adapter is a factory, `createXAdapter(opts)`, taking `{ home, env, platform, now }` (so tests
can point it at a fake home directory and a fake clock) and returning a plain object of functions —
see the `HarnessAdapter` typedef in `types.mjs`. Required:

- `id` — a stable kebab-case string, also the prefix of every thread id (`` `${id}:${sessionId}` ``,
  via `makeThread` or your own).
- `name` — shown in the UI.
- `detect()` — cheap; runs on every scan of every harness, so it should be a handful of `stat`s,
  never a full read.
- `scanThreads()` — the threads that exist right now. Throwing costs only this harness's threads;
  the rest of the village keeps going.
- `openThread(ref, { target })` — turn a `ref` back into somewhere to go. `target` is the person's
  Open-in preference (`'app'` or `'vscode'`); an adapter with only one place to open ignores it.
- `newSession(dir, { target, prompt, model, effort })` — one way to start a session in `dir`.
- `targets()` — where a new session can start *on this machine* right now: `[]` when nothing is
  installed, so the new-session form only offers what will actually work.

Optional, added only once you can back them for real:

- `readTranscript(ref, { limit })` — the conversation, for the transcript panel. Returns
  `{ ok, messages, total, ... }` or `{ ok: false, error }`.
- `readChanges(ref, { detail, path })` — what the session changed **on disk, read from its own
  records** — never by running anything in the repo. `detail` adds the entry-by-entry log and
  commits; `path` asks for one file's edits instead, with the text on either side of each hunk.
  Only Claude Code has this today (`changes.mjs`); it depends on the harness recording enough about
  each edit to reconstruct it.
- `continueThread(ref, { prompt })` — send one more prompt into an existing thread. Without it (or
  if it refuses), the caller starts a fresh session in the thread's folder instead — so it's fine
  to leave unwritten if the harness has no way to resume a specific session headlessly.

An adapter with only the required functions is still fully useful: no transcript panel, no Built
list, no "continue" button, but the villager stands on its plot and its status is right.

### `targets()` and `OpenResult`

`targets()` returns `{ id, label, note, models?, efforts? }[]` — one entry per place a new session
could start, `models`/`efforts` only for a target that offers a menu (see
`server/harnesses/claude-code/ids.mjs`'s `MODEL_CHOICES` for the shape). `openThread` and
`newSession` both return an `OpenResult`:

```js
{ ok: true, url, urls, terminal, where, promptPassed, note }  // urls opened in order, a short pause between
{ ok: false, error }
```

`urls` (plural) is for a link that needs the folder opened first and the session focused second —
see Claude Code's VS Code path. `terminal: { exe, args, cwd, prompt }` instead asks
`server/terminal.mjs` for a terminal window running `exe`; `where` finishes the sentence "Opening …
in", and `promptPassed` says the prompt travelled with the link so the page doesn't also need to
put it on the clipboard.

## Rules every adapter follows

- **Read-only, always.** An adapter reads a harness's own files or database; it never writes to
  them, and it never runs anything in the repos it finds. `readChanges` reconstructs history from
  the harness's own transcript, not from `git status` or `git diff`.
- **`shell: false`, argv arrays.** Any command run (`newSession`'s terminal, a CLI lookup) is
  spawned with an argument array, never a shell string.
- **Every id is checked with a regex *and* a `typeof`,** before it reaches a URL or a command line
  — see `isCliId` / `isDesktopId` in `claude-code/ids.mjs`. `RegExp.test` coerces its argument to a
  string, so a one-element array holding a valid id would otherwise pass.
- **Paths are split on `/[\\/]/`,** never just `/` or `path.sep`, so a Windows fixture (or a
  Windows user's real data) parses the same when the test runs on a Mac CI box. See
  `thread.mjs`'s `basename` or `vscode-family.mjs`'s `pathUrl`.
- **Non-obvious constants get a comment saying why**, especially why the obvious value was wrong —
  see the window constants at the top of `claude-code/index.mjs` or `cursor/index.mjs`
  (`RUNNING_WINDOW_MS`, `HEAD_BYTES`, …).

### VS Code forks

Cursor and Antigravity IDE are VS Code forks, so their adapters share `server/harnesses/vscode-family.mjs`:
`editorUserDir` (the platform-specific `<userData>/User` folder), `editorWorkspaces` (a workspace's
storage folder back to the folder it was opened on), `fileUriToPath`, and `folderUrl`/`fileUrl` (the
`<scheme>://file/…` deep links, including the `windowId=_blank` trick that reuses a window already
on the folder instead of hijacking whatever's in front). If the harness you're adding is another VS
Code fork, start here rather than re-deriving any of it.

### The mtime-and-size cache pattern

A transcript or database can be large enough that re-parsing it on every poll would be wasteful.
The pattern used throughout (`claude-code/index.mjs`'s `transcriptInfo`, `cursor/index.mjs`'s and
`antigravity/index.mjs`'s `mtimeKey`) is: `stat` the file, build a key from `` `${mtimeMs}:${size}` ``,
and only re-read and re-parse when that key has changed from what's cached. `remember()` in
`claude-code/index.mjs` shows the other half — keeping a cache of parsed transcripts to a handful
of entries, evicting the oldest, since a few multi-megabyte transcripts shouldn't sit in memory
forever.

## Testing

Tests are `node:test`, one file per adapter: `test/<id>-adapter.test.mjs` (see
`claude-code-adapter.test.mjs`, `cursor-adapter.test.mjs`, `antigravity-adapter.test.mjs`).
`test/helpers/fixtures.mjs` builds a fake Claude Code home directory (`tmpHome()`, `writeTranscript`,
`writeLive`, `writeDesktop`) for that adapter's tests; `test/helpers/editor.mjs` does the same for
the VS Code-family stores. Write the equivalent small helpers for a new harness's on-disk or
on-database format rather than hand-building fixtures inline in every test.

Pass `{ home, env, platform, now }` into your adapter's factory to point it at a fixture directory,
a fake environment and a fixed clock, so tests are deterministic and never touch the real machine.

## Wiring it up

Register the adapter in `server/harnesses/index.mjs`:

```js
import myHarness from './my-harness/index.mjs'

export const HARNESSES = [claudeCode, copilot, cursor, antigravity, myHarness]
```

That's the only file outside the new directory that needs to change. `detectedHarnesses()` calls
every adapter's `detect()` on every scan, so installing the harness while the village is open is
picked up on the next poll with no restart.
