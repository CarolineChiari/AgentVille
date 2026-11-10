// The Christmas theme: every plot a corner of a village in the snow. Its sub-themes (a Christmas
// market, snowy cottages, Santa's workshop, gingerbread lane, a carol singers' chapel) are recipes
// in src/sim/themes.js; this is how it draws them. Finished work is a wrapped present, set out on
// the present pile where the village has a garden. The countryside between the plots, the arrival
// square and the plots' landmarks stay the village's, so a Christmas plot can stand in any village.
import { buildingFrames, chimneyOf, drawChristmasBuilding, fitted, heightOf, shadowOf } from './buildings.js'
import { drawChristmas } from './harvest.js'
import { BED_EDGE, COVER_VARIANTS, ROAD_EDGE, drawBed, drawCover, drawFence, drawFringe, drawGround, drawRoad, drawTrail, drawVerge, patches, xmasCover } from './ground.js'
import { drawChristmasInterior } from './interiors.js'
import { drawChristmasSpotlight } from './spotlights.js'

/** @type {import('../index.js').ThemePack} */
export const christmas = {
  id: 'christmas',
  sprite(name, frame, p) {
    const [group, a, b] = name.split('.')
    const n = Number(b || 0)
    switch (group) {
      case 'fx':
        // Its own markers for a spotlight. Every other effect means what it does in every theme.
        return a === 'spotlight' ? drawChristmasSpotlight(b) : null
      case 'building':
        return drawChristmasBuilding({ kind: a, stage: n, accent: p.accent, variant: p.variant, lit: p.lit, frame, wall: p.wall, roofs: p.roofs, low: p.low, wear: p.wear, grade: p.grade })
      case 'fence':
        return drawFence(Number(a), n)
      case 'flower':
        return drawChristmas(Number(a), n, p.color)
      case 'interior':
        // Inside one of its buildings: what the room is made of, and the things in it that could
        // only be here. Everything else in a room is the village's, and means what it does there.
        return drawChristmasInterior(a, n)
      case 'tile':
        if (a === 'yard') return drawGround(n, p.tone)
        if (a === 'trail') return drawTrail(n, p.links || 0, p.tone)
        if (a === 'road') return drawRoad(n)
        if (a === 'bed') return drawBed(n)
        return null
      case 'deco':
        if (a === 'verge') return drawVerge(n, p.tone)
        // Where the lane meets the plot's ground. Grass hanging over it from the wild is the
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
  cover: xmasCover,
  patches,
  edges: { road: ROAD_EDGE, bed: BED_EDGE },
}
