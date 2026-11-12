// The Wild West theme: every plot a frontier settlement. Its sub-themes (main street, a ranch, a
// gold mine, a railroad depot, a desert mission) are recipes in src/sim/themes.js; this is how it
// draws them. Finished work is a cactus come into flower or a horseshoe nailed up for luck, set out
// in the corral where the village has a garden. The countryside between the plots, the arrival
// square and the plots' landmarks stay the village's, so a frontier plot can stand in any village.
import { buildingFrames, chimneyOf, drawWestBuilding, fitted, heightOf, shadowOf } from './buildings.js'
import { drawKeepsake } from './keepsakes.js'
import { BED_EDGE, COVER_VARIANTS, ROAD_EDGE, drawBed, drawCover, drawFence, drawFringe, drawGround, drawRoad, drawTrail, drawVerge, patches, westCover } from './ground.js'
import { drawWestInterior } from './interiors.js'
import { drawWestSpotlight } from './spotlights.js'

/** @type {import('../index.js').ThemePack} */
export const wildWest = {
  id: 'wild-west',
  sprite(name, frame, p) {
    const [group, a, b] = name.split('.')
    const n = Number(b || 0)
    switch (group) {
      case 'fx':
        // Its own markers for a spotlight. Every other effect means what it does in every theme.
        return a === 'spotlight' ? drawWestSpotlight(b) : null
      case 'building':
        return drawWestBuilding({ kind: a, stage: n, accent: p.accent, variant: p.variant, lit: p.lit, frame, wall: p.wall, roofs: p.roofs, low: p.low, wear: p.wear, grade: p.grade })
      case 'fence':
        return drawFence(Number(a), n)
      case 'flower':
        return drawKeepsake(Number(a), n, p.color)
      case 'interior':
        // Inside one of its buildings: what the room is made of, and the things in it that could
        // only be here. Everything else in a room is the village's, and means what it does there.
        return drawWestInterior(a, n)
      case 'tile':
        if (a === 'yard') return drawGround(n, p.tone)
        if (a === 'trail') return drawTrail(n, p.links || 0, p.tone)
        if (a === 'road') return drawRoad(n)
        if (a === 'bed') return drawBed(n)
        return null
      case 'deco':
        if (a === 'verge') return drawVerge(n, p.tone)
        // Where the road meets the plot's ground. Grass hanging over it from the wild is the
        // village's, so only the plot's own ground is drawn here.
        if (a === 'fringe') return p.ground === 'yard' ? drawFringe(n, p.tone) : null
        if (Object.hasOwn(COVER_VARIANTS, a)) return drawCover(a, n, p.tone)
        return null
    }
    // Everything in fx says what it means in every theme — badges, rings, smoke, shadows, the
    // birds — and is left exactly as it is.
    return null
  },
  buildings: { fitted, heightOf, shadowOf, frames: buildingFrames, chimneyOf },
  cover: westCover,
  patches,
  edges: { road: ROAD_EDGE, bed: BED_EDGE },
}
