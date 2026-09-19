// Theme packs: how each theme draws. A theme's names and recipes are in src/sim/themes.js; its
// pack, here, decides what they look like. A pack can draw any sprite its own way, and anything
// it leaves alone is drawn the village's way, so a theme only has to draw what makes it itself.
//
// Every sprite the renderer asks for carries the theme in its params (see the registry), so a
// pack sees each request and answers it or passes. Style numbers it receives (a plot's fence,
// yard, wall and roofs) are indices into its own theme's dims, not the village's.
import { PALETTE as P } from '../sprites/palette.js'
import { buildingFrames, chimneyOf, fitted, heightOf, shadowOf } from '../sprites/buildings.js'
import { heightOf as landmarkHeight, landmarkFrames, shadowOf as landmarkShadow } from '../sprites/landmarks.js'
import { lawnCover } from '../ground.js'
import { construction } from './construction/index.js'
import { elvish } from './elvish/index.js'

/**
 * @typedef {object} ThemePack
 * @property {string} id  its theme's id in src/sim/themes.js
 * @property {((name: string, frame: number, p: object) => import('../sprites/pixel.js').PixelCanvas | null) | null} sprite
 *           Its own drawing of the sprite called `name` (see the registry for names and params), or
 *           null to leave it to the village's generators.
 * @property {BuildingShapes} buildings
 * @property {(tx: number, ty: number, tone: number) => ({ kind: string, variant: number } | null)} cover
 *           What lies on the plot ground tile (tx, ty), drawn as `deco.<kind>.<variant>` with its
 *           tone; null for bare ground. Pure, so the same tile always has the same thing on it.
 * @property {(tone: number) => string[][]} patches
 *           The plot ground's colours as [plain, sunny, lush]: three lists, one for one. Wherever
 *           the ground's tone field says so, the renderer repaints each plain colour with its
 *           sunny or lush partner (see src/render/ground.js). Only exact plain colours change.
 * @property {{ road: string, bed: string }} edges  the lip drawn where a road meets anything
 *           else, and the edging laid round the field finished work stands in
 * @property {LandmarkShapes} [landmark]  how its landmarks stand, if it draws its own
 *           `landmark.<tier>.<stage>`; left out, the village's landmarks stand on its plots
 *
 * @typedef {object} BuildingShapes  How a theme's buildings stand; see src/render/sprites/buildings.js.
 * @property {(kind: string, variant: number, roomy: boolean) => { kind: string, low: boolean }} fitted
 *           What a thread's building (`kind`, one of KINDS in src/sim/building.js) is drawn as in
 *           this theme, on a roomy top-row slot or down a courtyard's side. The kind it returns
 *           names the sprite: `building.<kind>.<stage>`.
 * @property {(kind: string, variant: number, low: boolean) => number} heightOf  sprite height, for a drawn kind
 * @property {(kind: string) => number} shadowOf  width of the shadow it casts; 0 for none
 * @property {(kind: string, stage: number) => number} frames  frames it animates through
 * @property {(kind: string, variant: number, wall: number, roofs: number, low: boolean) => ({ x: number, y: number } | null)} chimneyOf
 *           where smoke leaves it, in sprite pixels, or null
 *
 * @typedef {object} LandmarkShapes  How a theme's landmarks stand; see src/render/sprites/landmarks.js.
 *           Each tier's sprite is 32 px wide and heightOf(tier) tall, taller than the tier below
 *           and 72 at most, its bottom row on the ground.
 * @property {(tier: number) => number} heightOf
 * @property {(tier: number) => number} shadowOf  width of the shadow it casts; 0 for none
 * @property {(tier: number, stage: number) => number} frames  frames it animates through
 */

/** A lawn's greens in plain, sunny and lush patches, by its plot's lawn tone. */
const LAWNS = P.yardTones.map((plain, t) => [plain, P.yardSunny[t], P.yardLush[t]])

/** @type {ThemePack} The countryside village: every sprite as it was drawn before there were themes. */
export const village = {
  id: 'village',
  sprite: null,
  buildings: { fitted, heightOf, shadowOf, frames: buildingFrames, chimneyOf },
  cover: (tx, ty) => lawnCover(tx, ty),
  patches: (tone) => LAWNS[(tone || 0) % LAWNS.length],
  edges: { road: P.pathDark, bed: P.bedEdge },
  landmark: { heightOf: landmarkHeight, shadowOf: landmarkShadow, frames: landmarkFrames },
}

/** @type {Record<string, ThemePack>} */
export const PACKS = { village, construction, elvish }

/** A theme's pack; the village's for a theme with none. */
export const packFor = (id) => PACKS[id] || village

/** How a theme's landmarks stand: its own, or the village's for a pack that draws none. */
export const landmarkShapes = (id) => packFor(id).landmark ?? village.landmark
