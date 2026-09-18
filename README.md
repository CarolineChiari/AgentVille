# AgentVille

Every Claude Code session on this machine is a villager in a small pixel-art village. Each repo
you work in is a plot of land; each session is one villager building something on it. When a
session is waiting on you the villager stops and holds a `?` over its head. Click it and the
thread opens in the Claude desktop app.

It reads Claude Code's own session files, on your own machine. Nothing is uploaded, there is
no account, and it never writes to Claude Code's files. `data/village.json`, where the map
and your archive list live, is the only file it writes.

## Run it

```bash
npm install
npm run dev
```

Then open the URL Vite prints (default `http://127.0.0.1:5274`). Add `?demo=1` for a made-up village that needs no sessions. Needs Node 22 or newer.
`npm test` runs the suite. `npm start` builds and serves the built app; `PORT=5300 npm start`
binds elsewhere.

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
| Standing still with `?` | Waiting on you |
| Slumped with `!` | Errored |
| Jumping with `✓` | PR merged, in the last three days |
| Sitting with `z` | Nothing for three days |
| Walking in from the gate | A session that just appeared |
| Walking out through the gate | You archived it |
| A flower in the plot's garden | A finished (archived) thread |

### The gardens

Every finished thread leaves a flower in its repo's garden. Beds fill like a contribution graph:
each column top to bottom, columns left to right, and a full bed carries on in the plot's next
cell, so a repo you've done a lot in grows into a big garden. Empty slots show as bare soil.

There are 50 kinds of flower, and the kind says what the work was, read from the thread's title
and first prompt: daisies for bug fixes, tulips for features, lavender for docs, sunflowers for
performance, lilies for code review, dandelions for research, and so on. The colour is random,
but fixed per thread. Click a flower to look back at the thread, open it again, or restore it.

Villagers waiting on you wave and hop every few seconds, so they're easy to spot.

## Keys

| Key | Does |
| --- | --- |
| `N` | Fly to the next villager waiting on you |
| `Enter` / `A` / `V` | Open / archive / mark viewed the selected thread |
| `C` | New session in the open repo's folder |
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
