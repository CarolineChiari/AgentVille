# AgentVille — conventions

Every Claude Code session on this machine is a villager in a pixel-art village. Each repo is a
plot; each session is one villager and one building. The server reads Claude Code's own files
read-only; `data/village.json` is the only file this project writes.

## Layout

- `server/` — Node, `.mjs`, no runtime dependencies. `harnesses/<id>/` is the only place that
  knows what a particular harness's files look like. Everything else is written against the
  `Thread` shape in `server/harnesses/types.mjs`.
- `src/sim/` — renderer-agnostic simulation in tile units. **No DOM, no canvas**, so it runs
  under `node --test`. It produces a `Frame` (`src/sim/frame.js`); a renderer draws it.
- `src/render/` — the Canvas 2D renderer and the procedural sprite generators.
- `src/game/` — API client, state merge, orchestration. `src/ui/` — plain DOM HUD.
- `test/` — `node:test`, one file per module: `test/<module>.test.mjs`.

## Rules

- ESM only. `.mjs` under `server/`, `.js` under `src/`. No semicolons, single quotes, 2-space indent.
- No runtime dependencies without discussion. Vite is the only dev dependency.
- Never write outside `data/`. Never write to a harness's files. Never execute anything from
  inside another application's bundle; opening a thread goes through a URL the OS resolves.
- Every colour comes from `src/render/sprites/palette.js`. No hex strings elsewhere.
- Paths via `path.join` / `fileURLToPath(import.meta.url)`, never `process.cwd()`. Split paths
  on `/[\\/]/` so Windows paths work on a Mac test run.
- Spawn with an argv array and `shell: false`. Validate ids with a regex **and** a `typeof` check
  before they reach a URL or a command.
- Non-obvious constants get a comment saying *why*, especially why the obvious value was wrong.
- Pure logic lives in modules that import nothing from the DOM so it can be unit-tested.
- Run `npm test` before finishing a change.
