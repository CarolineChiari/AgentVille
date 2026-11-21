# AgentVille — conventions

Every Claude Code session on this machine is a villager in a pixel-art village. Each repo is a
plot; each session is one villager and one building. The server reads Claude Code's own files
read-only; everything this project writes goes in `data/` (`village.json`, `prs.json`, `issues.json`,
`repos.json`, `release.json`, `foreman.json`, `postmortems.json`).

## Layout

- `server/` — Node, `.mjs`, no runtime dependencies. `harnesses/<id>/` is the only place that
  knows what a particular harness's files look like. Everything else is written against the
  `Thread` shape in `server/harnesses/types.mjs`. See `docs/harnesses.md` for how to write one.
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
- A theme keeps its own rooms: the inside of a building is one of them, laid out in tile units in
  `src/sim/interiors.js` (three or more per theme, a folder's sub-theme claiming the ones that suit
  it, and one thread always in the same one). A pack draws what its rooms are made of and the few
  things that could only be in them, in `src/render/themes/<id>/interiors.js`; everything it passes
  on is the village's. A room means the same thing in every theme: every one has the board, a shelf
  of files, a pinboard of commits, a desk whose monitor is lit while the session works, a chair, a
  bed, a rug and a door out.
- A theme brings five markers for a spotlight (`spotlights` in themes.js, drawn by its pack as
  `fx.spotlight.<id>`, 11×12, from text art in its `spotlights.js`). A spotlight shows its plot's
  theme's first unless one of any theme's was picked; the pink at the villager's feet and the edge
  pointer mean "spotlit" in every theme.
- Settings → Follow the calendar dresses the village in a holiday's theme through its dates (`src/sim/calendar.js`,
  pure; a holiday is a window of lead-in and tail days around its day). It only changes the village's theme: a
  folder's own look is kept. A new holiday theme joins `HOLIDAYS` there.
- `test/theme-packs.test.mjs` holds every registered theme to the renderer's rules, and
  `test/interiors.test.mjs` holds every room to the sim's. To make a new theme, follow the
  `new-theme` skill in `.claude/skills/new-theme/`.

## Rules

- ESM only. `.mjs` under `server/`, `.js` under `src/`. No semicolons, single quotes, 2-space indent.
- No runtime dependencies without discussion. Dev dependencies are Vite, Electron and electron-builder.
- Never write outside `data/` (the desktop app's `data/` is under its userData directory). Never write to a harness's files. A repo is
  only ever read, never run: `server/repo.mjs` counts its lines from its files, not through git. The network is reached in three ways
  only. `server/github.mjs`, only through the user's own `gh` CLI. `server/weather.mjs`, only once the user
  has typed a place in Settings, and sending nothing but that place name to Open-Meteo; with no place set, the village's
  weather is made up (`src/sim/weather.js`) and nothing leaves the machine. `server/foreman.mjs` and `server/postmortem.mjs`, only when
  the user sends the foreman or holds a post mortem, only through their own `claude` CLI, headless, with the flags in
  `server/harnesses/claude-code/headless.mjs`: nothing saved, no repo settings or hooks, no MCP, reading tools at most, a
  thread asked only in a fork of it. Keep it that way. Never execute anything from
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

## Pull request size and phased feature branches

Copilot reviews every PR here, and most PRs are opened by agents. Keep each one small enough to review in one sitting.

Version bumps: in the feature branch flow below, phase PRs don't bump the version. The final PR into `main` bumps the minor version once, so CI releases one version for the whole feature.

### Size limits

- Aim for **400 changed lines or fewer** per PR (additions + deletions, lockfiles excluded) and about 20 files. Never go over **500** unless one change truly can't be split (a generated migration, a vendored file). Then put it in a PR of its own and say why in the description.
- Check before you open the PR:
  ```bash
  git diff --shortstat origin/<base>...HEAD -- . ':(exclude)**/package-lock.json'
  ```
- Copilot code review has had no size cap since Aug 27, 2026 (it used to stop at 300 files or 20,000 lines). It still skips lockfiles and generated files, and its findings get harder to act on as a diff grows, so small PRs get better reviews.

### How to split

- One concern per PR, in the order the code depends on it:
  1. Schema, data model and migrations (on their own, landing before the code that needs them)
  2. Backend logic and API
  3. Frontend UI
  4. Wiring: routes, config, feature flags, docs
- Infrastructure (Terraform), CI changes and dependency bumps with their lockfiles each go in their own PR.
- Mechanical changes (renames, moves, formatting) go in their own PR with no behavior change.
- Tests go in the same PR as the code they test.
- Every PR must build and pass tests on its own. Keep unfinished features behind a flag or unrouted instead of leaving the branch broken.

### Feature branch for work that needs more than one PR

1. Create `feature/<name>` from the latest `main` and push it. Use kebab-case for `<name>`.
2. For each phase, branch `feature/<name>-p<N>-<slug>` from the current tip of `feature/<name>` (for example `feature/wardrobe-p03-manual-entry`). Use a hyphen, not a slash: git can't hold both `feature/<name>` and `feature/<name>/...`.
3. Open each phase PR **into `feature/<name>`**, not `main`, titled `<emoji> <Feature> N/M: <what it adds>`. Copilot reviews PRs into feature branches. Address its comments in that PR.
4. Merge a phase PR (squash) only when the repo owner says so. If the next phase can't wait, base it on the previous phase's branch and retarget it to `feature/<name>` once that one merges.
5. Keep `feature/<name>` current: when `main` moves, merge it in (`git fetch origin && git merge origin/main`) and push. Don't rebase `feature/<name>` while phase PRs are open, because that rewrites the base they target. Rebase it onto `main` (`git rebase origin/main` then `git push --force-with-lease`) only when no phase PR is open. After updating it, rebase any open phase branch onto it.
6. When every phase is in, open one PR `feature/<name>` into `main`, titled `<emoji> <Feature>: phases 1–M`, listing the phase PRs. This one is for the repo owner to review, and it will be large. If Copilot reviews it too, act only on findings that weren't already handled in a phase PR.
7. After it merges, delete the phase branches and `feature/<name>`.
