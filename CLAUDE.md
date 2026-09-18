# AgentVille — conventions

Every Claude Code session on this machine is a villager in a pixel-art village. Each repo is a
plot; each session is one villager and one building. The server reads Claude Code's own files
read-only; everything this project writes goes in `data/` (`village.json`, `prs.json`, `issues.json`).

## Layout

- `server/` — Node, `.mjs`, no runtime dependencies. `harnesses/<id>/` is the only place that
  knows what a particular harness's files look like. Everything else is written against the
  `Thread` shape in `server/harnesses/types.mjs`.
- `electron/` — the desktop wrapper: starts `server/` in Electron's main process and opens one
  sandboxed window on it. Pure decisions go in `electron/env.mjs`, which imports nothing from Electron.
- `src/sim/` — renderer-agnostic simulation in tile units. **No DOM, no canvas**, so it runs
  under `node --test`. It produces a `Frame` (`src/sim/frame.js`); a renderer draws it.
- `src/render/` — the Canvas 2D renderer and the procedural sprite generators.
- `src/game/` — API client, state merge, orchestration. `src/ui/` — plain DOM HUD.
- `test/` — `node:test`, one file per module: `test/<module>.test.mjs`.

## Rules

- ESM only. `.mjs` under `server/`, `.js` under `src/`. No semicolons, single quotes, 2-space indent.
- No runtime dependencies without discussion. Dev dependencies are Vite, Electron and electron-builder.
- Never write outside `data/` (the desktop app's `data/` is under its userData directory). Never write to a harness's files. The only network access is
  `server/github.mjs`, and only through the user's own `gh` CLI; keep it that way. Never execute anything from
  inside another application's bundle; opening a thread goes through a URL the OS resolves.
- Every colour comes from `src/render/sprites/palette.js`. No hex strings elsewhere.
- Paths via `path.join` / `fileURLToPath(import.meta.url)`, never `process.cwd()`. Split paths
  on `/[\\/]/` so Windows paths work on a Mac test run.
- Spawn with an argv array and `shell: false`. Validate ids with a regex **and** a `typeof` check
  before they reach a URL or a command.
- Non-obvious constants get a comment saying *why*, especially why the obvious value was wrong.
- Pure logic lives in modules that import nothing from the DOM so it can be unit-tested.
- Run `npm test` before finishing a change.
- Every commit bumps the minor version: `npm version --no-git-tag-version minor`, and commit
  `package.json` and `package-lock.json` with it. CI releases each new version pushed to main.
