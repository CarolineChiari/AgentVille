# AgentVille

Every Claude Code session on this machine is a villager in a small pixel-art village. Each repo
you work in is a plot of land; each session is one villager building something on it. When a
session is waiting on you the villager stops and holds a `?` over its head. Click it and the
thread opens in the Claude desktop app.

It reads Claude Code's own session files, on your own machine. Nothing is uploaded, there is
no account, and it never writes to Claude Code's files. Everything it writes goes in `data/`.
The one thing that touches the network is the PR gardens and issue boards, which ask GitHub
through your own `gh` login; turn them off in Settings and nothing leaves the machine.

## Run it

```bash
npm install
npm run dev
```

Then open the URL Vite prints (default `http://127.0.0.1:5274`). Add `?demo=1` for a made-up village that needs no sessions. Needs Node 22 or newer.
`npm test` runs the suite. `npm start` builds and serves the built app; `PORT=5300 npm start`
binds elsewhere.

### Desktop app

`npm run app` builds and opens AgentVille in its own window. `npm run dist` packages it for the
machine you're on into `release/`. Every push to `main` builds the Mac (`.dmg`, Apple silicon
and Intel) and Windows (installer and portable `.exe`) apps in GitHub Actions; they're on the
run's page under **Artifacts**. Pushing a `v*` tag (`git tag v0.2.0 && git push --tags`)
publishes them as a release, with the version taken from the tag.

The app is the same server and page as `npm start`, on port 5275 so it can run alongside
`npm run dev`. Its `data/` lives in `~/Library/Application Support/AgentVille/` (macOS) or
`%APPDATA%\AgentVille\` (Windows) instead of the repo.

The builds aren't signed with a developer certificate yet, so the first launch needs a nudge.
On macOS, right-click the app and choose **Open** (or run
`xattr -dr com.apple.quarantine /Applications/AgentVille.app`). On Windows, choose **More info →
Run anyway** in the SmartScreen prompt.

macOS and Windows are both supported. Opening a thread, starting a new session and revealing
a folder go through a deep link handed to the OS opener.

**Open in VS Code** is the default. AgentVille opens the repo folder in VS Code first, then hands
the session to the Claude Code extension (`vscode://anthropic.claude-code/open?session=…`), so it
lands in the right window. Threads that exist only in the Claude desktop app can't be opened
this way. Switch to the Claude app under Settings → Open threads in.

## What it reads

| | |
| --- | --- |
| CLI transcripts | `~/.claude/projects/<encoded-cwd>/<session>.jsonl` |
| Live sessions | `~/.claude/sessions/*.json` |
| Desktop app records | `~/Library/Application Support/Claude/claude-code-sessions/…` (macOS), `%APPDATA%\Claude\claude-code-sessions\…` (Windows) |

Only files under your home directory, and only ever read.

## What you are looking at

| In the village | In your sessions |
| --- | --- |
| One plot | One repo. Bigger repos claim more tiles, and a plot stays where it is between reloads |
| One villager + one building | One session |
| Hammering, sparks | Working right now |
| Waving and hopping with `?` | Needs you: a question, a plan to approve, or a permission prompt |
| Standing at the door with a green ✓ | Done: finished its turn, ready for you to review (`R` visits each, `V` marks it reviewed) |
| Slumped with `!` | Errored |
| Jumping with a gold ★ | PR merged, in the last three days |
| Sitting with `z` | Nothing for three days |
| Walking in from the gate | A session that just appeared |
| Walking out through the gate | You archived it |
| A flower in the plot's garden | A finished (archived) thread |
| A notice board below the garden | The repo's open GitHub issues, one pinned note each |

### Transcripts and new sessions

**Transcript** on a villager's card (or `T`) opens its conversation in a panel beside the map:
your prompts, Claude's replies, and one line for each tool call. It refreshes every few seconds
while the thread is working or waiting, and stays at the newest message if that's where you are.
It's read straight from the transcript file; nothing is sent anywhere.

**+ New session** (or `C`) picks a repo, or any folder, where to open it, the model, the effort
level, and an optional first prompt. The new villager walks in from the gate a few seconds later.

| Open in | Model and effort | First prompt |
| --- | --- | --- |
| VS Code | Your defaults (change them in VS Code's menus) | Typed in for you; press Enter to send |
| Terminal | Any model (Fable, Opus, Opus 1M, Sonnet, Haiku) and effort (low to max) | Sent as the opening message (macOS); on the clipboard (Windows) |
| Claude app | Your defaults | On the clipboard |

Only the terminal can take a model or an effort level, because neither the VS Code nor the
Claude app link has a way to pass them; picking either switches the form to Terminal. On macOS the terminal is started
from a one-shot script in `data/launch/` that deletes itself as it runs; the prompt is read from
a separate file, so nothing you type is ever run as a command.

A villager whose session has stopped on you, with a question, a plan to approve or a permission
prompt, shows `?` and says what it needs, even while its last transcript entry looks like work.
AgentVille reads this from the status each running Claude Code process keeps for itself.

### The gardens

Every finished thread leaves a flower in its repo's garden. Beds fill like a contribution graph:
each column top to bottom, columns left to right, and a full bed carries on in the plot's next
cell, so a repo you've done a lot in grows into a big garden. Empty slots show as bare soil.

There are 50 kinds of flower, and the kind says what the work was, read from the thread's title
and first prompt: daisies for bug fixes, tulips for features, lavender for docs, sunflowers for
performance, lilies for code review, dandelions for research, and so on. The colour is random,
but fixed per thread. Click a flower to look back at the thread, open it again, or restore it.

Villagers who need you wave and hop every few seconds, so they're easy to spot. A repo whose
threads are all asleep rests: its villagers fold away, but its garden stays on the map. The bed
is walkable, so villagers stroll among the flowers rather than queueing in front of their doors.

### Pull requests

If a repo's `origin` is on GitHub and the [`gh` CLI](https://cli.github.com) is installed and
signed in, its pull requests grow in the garden too:

- **Merged PRs** bloom in the order they merged. A finished thread that opened a PR shares that
  PR's flower rather than growing a second one.
- **Labels choose the flower.** `type:` labels are read before `area:` ones, `size:` labels pick
  a small, medium or large bloom, and a PR with no labels is always **white**. White never comes
  up as a random colour, so it only ever means "unlabeled".
- **Open PRs** wait at the growing edge of the bed as buds that **glitter** and glow, day and
  night. `P`, or the PRs count in the sidebar, flies to each in turn; the card opens the PR on
  GitHub. When it merges, the bud blooms.

Each repo's list is fetched with `gh pr list` at most every ten minutes, in the background, and
cached in `data/prs.json` so reloads are instant and it works offline. Closed-unmerged PRs grow
nothing.

### Open issues

The same way, a repo's open GitHub issues go up on a **notice board** on the walkway below its
garden, one pinned note per issue. `I`, or the Issues count in the sidebar, flies to each board
in turn. Click a board to list its issues, newest first:

- **Open** shows the issue on GitHub.
- **Send** hands it to a villager already on that repo, as a task that names the issue and links
  it. With several free, pick which one in the card. A busy villager can't take one.
- **Recruit** opens the new-session form on that repo with the issue already written in as the
  first prompt, for you to check and start.

Issues are fetched with `gh issue list` at most every ten minutes, one `gh` at a time alongside
the PRs, and cached in `data/issues.json`. A board only goes up on a plot that is already on the
map.

## Keys

| Key | Does |
| --- | --- |
| `N` | Fly to the next villager who needs you |
| `R` | Fly to the next finished thread to review |
| `P` | Fly to the next open PR |
| `I` | Fly to the next notice board with open issues |
| `Enter` / `A` / `V` | Open / archive / mark reviewed the selected thread |
| `C` | New session, with an optional first prompt |
| `T` | Transcript of the selected thread |
| `H` | Hide the panels |
| `Esc` | Deselect |
| Arrows, `+` / `-`, `0` | Pan, zoom, reset the view |

## Your own art

Every sprite is drawn in code at boot, so the repository ships no images. To replace one with
a hand-drawn sheet, drop a PNG in `public/sprites/` and name it in `public/sprites/manifest.json`:

```json
{
  "version": 1,
  "sprites": {
    "villager.walk.s": { "src": "/sprites/villager.png", "frameW": 16, "frameH": 24, "frames": 4, "row": 2 }
  }
}
```

Anything not named there keeps its generated version.

## Keeping it local

The server binds `127.0.0.1`, refuses requests whose `Host` is not local (DNS rebinding), and
refuses state-changing requests without a local `Origin` (cross-site POST). A bare `curl` POST
needs `-H 'Origin: http://localhost:5274'`.

## Licence

MIT.
