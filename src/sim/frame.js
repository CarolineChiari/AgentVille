/**
 * The seam between the simulation and whatever draws it. `World.snapshot()` returns one of these
 * every frame; a renderer reads it and nothing else. Units are ground tiles; a villager's (x, y)
 * is where its feet are. Swapping the Canvas 2D renderer for a hand-drawn or 3D one means
 * writing a new `render(frame, camera)` — the sim does not change.
 *
 * @typedef {object} Frame
 * @property {number} time
 * @property {string} theme  the village's theme, an id from src/sim/themes.js; every style below is in it
 * @property {{ ox: number, oy: number, w: number, h: number, tiles: Uint8Array, deco: Uint8Array, version: number, tileAt: (x: number, y: number) => number, decoAt: (x: number, y: number) => number }} map
 * @property {{ x: number, y: number }} gate
 * @property {{ name: string, accent: number, style: PlotStyle, cells: number[][], labelAt: {x:number,y:number}, urgent: boolean, active: boolean }[]} plots
 * @property {{ id: string, sprite: string, variant?: number, x: number, y: number, blocks?: number[][], plot?: string }[]} statics
 *           Scenery; (x, y) is the bottom centre of its tile. `blocks` lists the tiles it stands on, if nobody can walk through it.
 *           One with a `plot` belongs to that plot (what its landmark brought, see propsOf) and is drawn in its theme.
 * @property {{ id: string, kind: string, variant: number, stage: number, progress: number, x: number, y: number, w: number, h: number, alpha: number, lit: boolean, wear: number, roomy: boolean, plot: string, accent: number, style: PlotStyle }[]} buildings
 *           `style` is its plot's. `wear` is how weathered it looks, a grade from wear.js: it gleams
 *           while its thread works and runs down the longer it sits.
 *           `roomy` is true on a courtyard's top row, with open ground above it;
 *           down the sides the house above opens its door onto the row just above, so nothing tall fits.
 * @property {{ id: string, x: number, y: number, facing: 'n'|'e'|'s'|'w', anim: string, animTime: number, look: object, status: string, badge: string|null, alpha: number, selected: boolean, hovered: boolean, plot: string }[]} villagers
 * @property {{ id: string, kind: number, color: number, white: boolean, open: boolean, x: number, y: number, plot: string, born: number|null, selected: boolean, hovered: boolean }[]} flowers
 *           Finished work; (x, y) is the base of the stem. `born` is sim time, null if always there.
 *           `white` marks an unlabeled PR; `open` a PR still waiting to merge (drawn as a glittering bud).
 * @property {{ id: string, plot: string, tx: number, ty: number, x: number, y: number, count: number, notes: { id: string }[], selected: boolean, hovered: boolean }[]} boards
 *           One notice board per plot with open issues, one note per issue. (tx, ty) is its tile;
 *           (x, y) the bottom centre of that tile. A board shows at most a handful of notes; `count` is all of them.
 * @property {{ id: string, plot: string, tier: number, stage: number, progress: number, variant: number, x: number, y: number, w: number, h: number, style: PlotStyle, accent: number, lit: boolean, selected: boolean, hovered: boolean }[]} landmarks
 *           One per plot, standing in its field where the village stands them: what the work done
 *           in that repo has raised (see progress.js). `tier` 0 is the smallest; it goes up
 *           through `stage` 0 to 3 like a building, whenever its tier rises. `lit` means what a lit window does.
 * @property {{ kind: 'spark'|'confetti'|'z', x: number, y: number, age: number, life: number, seed: number }[]} effects
 *
 * @typedef {object} PlotStyle  A repo's look (see style.js): indices, not colours.
 * @property {string} theme  its theme's id (see themes.js), which the indices below belong to
 * @property {string} sub    the sub-theme it wears
 * @property {number} fence  into its theme's fences
 * @property {number} yard   into its theme's grounds: in the village, the lawn's tone
 * @property {number} wall   into its theme's walls, the material its buildings prefer
 * @property {number} roofs  the family of roof (or paint) colours its buildings share
 *
 * @typedef {object} Renderer
 * @property {(frame: Frame) => void} render
 * @property {(sx: number, sy: number, frame: Frame) => { villager?: string, flower?: string, board?: string, landmark?: string, plot?: string } | null} pick
 * @property {() => void} resize
 */
export {}
