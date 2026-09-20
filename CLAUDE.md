# AgentVille — conventions

Every Claude Code session on this machine is a villager in a pixel-art village. Each repo is a
plot; each session is one villager and one building. The server reads Claude Code's own files
read-only; everything this project writes goes in `data/` (`village.json`, `prs.json`, `issues.json`,
`repos.json`, `release.json`).

## Layout

- `server/` — Node, `.mjs`, no runtime dependencies. `harnesses/<id>/` is the only place that
  knows what a particular harness's files look like. Everything else is written against the
  `Thread` shape in `server/harnesses/types.mjs`.
- `electron/` — the desktop wrapper: starts `server/` in Electron's main process and opens one
  sandboxed window on it. Pure decisions go in `electron/env.mjs`, which imports nothing from Electron.
- `src/sim/` — renderer-agnostic simulation in tile units. **No DOM, no canvas**, so it runs
  under `node --test`. It produces a `Frame` (`src/sim/frame.js`); a renderer draws it.
- `src/render/` — the Canvas 2D renderer and the procedural sprite generators. `src/render/themes/`
  holds each theme's pack: how that theme draws.
- `tools/` — dev tools run under Node, never shipped: `npm run sheet` draws a theme's contact sheet;
  `npm run shots` retakes the README's screenshots, `docs/screenshots/`, from the demo village.
- `src/game/` — API client, state merge, orchestration. `src/ui/` — plain DOM HUD.
- `test/` — `node:test`, one file per module: `test/<module>.test.mjs`.

## Themes

- A theme is the whole village's look; a sub-theme is one folder's take on it. A folder can also
  pick a look (`{ theme, sub }`) from any theme, saved in `village.json` as `looks`, so plots of
  different themes stand side by side: every plot's style carries its own theme, and the renderer
  draws each plot, and what stands on it, in that theme. The village's theme covers the
  countryside, the square and every folder that hasn't picked. Ids, labels, each
  theme's `dims` (its fences, grounds, walls and paint) and each sub-theme's recipe live in
  `src/sim/themes.js`; a plot's style is drawn from its recipe in `src/sim/style.js`. How a theme
  looks is its pack, `src/render/themes/<id>/`, registered in `src/render/themes/index.js`. A pack
  draws only what makes the theme itself; whatever it passes on is drawn the village's way.
- Style numbers a pack gets are indices into its own theme's dims. Only ever append to a theme's
  dims, sub-themes and `auto` list, and to HATS and TOPS: every folder's and villager's look is
  picked from them. The village's Patchwork must keep picking exactly what repos had before themes.
- A theme changes how things look, never what they mean: status badges, the selection ring, lit
  windows and smoke keep their meaning in every theme. A theme may draw finished work as something
  other than flowers (the site's marker flags) and name it in its own words (`finished` in
  themes.js), but it still shows the kind of work, white for an unlabeled PR, and a bud for an open one.
- Each plot raises a landmark in its field as work lands in it (`src/sim/progress.js` scores the
  work; the tier reached is a high-water mark in `village.json`'s `progress`). A theme names the
  tiers in `landmark` and may draw them (`landmark.<tier>.<stage>`) and what each tier brings
  (`static.yard*`, `static.gateway`); a pack that doesn't gets the village's.
- `test/theme-packs.test.mjs` holds every registered theme to the renderer's rules. To make a new
  theme, follow the `new-theme` skill in `.claude/skills/new-theme/`.

## Rules

- ESM only. `.mjs` under `server/`, `.js` under `src/`. No semicolons, single quotes, 2-space indent.
- No runtime dependencies without discussion. Dev dependencies are Vite, Electron and electron-builder.
- Never write outside `data/` (the desktop app's `data/` is under its userData directory). Never write to a harness's files. A repo is
  only ever read, never run: `server/repo.mjs` counts its lines from its files, not through git. The only network access is
  `server/github.mjs`, and only through the user's own `gh` CLI; keep it that way. Never execute anything from
  inside another application's bundle; opening a thread goes through a URL the OS resolves.
- Every colour comes from `src/render/sprites/palette.js`. No hex strings elsewhere.
- Paths via `path.join` / `fileURLToPath(import.meta.url)`, never `process.cwd()`. Split paths
  on `/[\\/]/` so Windows paths work on a Mac test run.
- Spawn with an argv array and `shell: false`. Validate ids with a regex **and** a `typeof` check
  before they reach a URL or a command.
- Non-obvious constants get a comment saying *why*, especially why the obvious value was wrong.
- Pure logic lives in modules that import nothing from the DOM so it can be unit-tested.
- The repo is public. Screenshots, fixtures and docs never show a real village, repo, path or
  transcript: screenshots come from `?demo` through `npm run shots`, fixtures use `/Users/me`.
- Run `npm test` before finishing a change.
- Every commit bumps the minor version: `npm version --no-git-tag-version minor`, and commit
  `package.json` and `package-lock.json` with it. CI releases each new version pushed to main.
