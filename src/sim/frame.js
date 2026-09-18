/**
 * The seam between the simulation and whatever draws it. `World.snapshot()` returns one of these
 * every frame; a renderer reads it and nothing else. Units are ground tiles; a villager's (x, y)
 * is where its feet are. Swapping the Canvas 2D renderer for a hand-drawn or 3D one means
 * writing a new `render(frame, camera)` — the sim does not change.
 *
 * @typedef {object} Frame
 * @property {number} time
 * @property {{ ox: number, oy: number, w: number, h: number, tiles: Uint8Array, deco: Uint8Array, version: number }} map
 * @property {{ x: number, y: number }} gate
 * @property {{ name: string, accent: number, cells: number[][], labelAt: {x:number,y:number}, urgent: boolean, active: boolean }[]} plots
 * @property {{ id: string, sprite: string, variant?: number, x: number, y: number }[]} statics
 * @property {{ id: string, kind: string, variant: number, stage: number, progress: number, x: number, y: number, w: number, h: number, alpha: number, lit: boolean, plot: string, accent: number }[]} buildings
 * @property {{ id: string, x: number, y: number, facing: 'n'|'e'|'s'|'w', anim: string, animTime: number, look: object, status: string, badge: string|null, alpha: number, selected: boolean, hovered: boolean, plot: string }[]} villagers
 * @property {{ id: string, kind: number, color: number, white: boolean, open: boolean, x: number, y: number, plot: string, born: number|null, selected: boolean, hovered: boolean }[]} flowers
 *           Finished work; (x, y) is the base of the stem. `born` is sim time, null if always there.
 *           `white` marks an unlabeled PR; `open` a PR still waiting to merge (drawn as a glittering bud).
 * @property {{ kind: 'spark'|'confetti'|'z', x: number, y: number, age: number, life: number, seed: number }[]} effects
 *
 * @typedef {object} Renderer
 * @property {(frame: Frame) => void} render
 * @property {(sx: number, sy: number, frame: Frame) => { villager?: string, plot?: string } | null} pick
 * @property {() => void} resize
 */
export {}
