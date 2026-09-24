// The farm theme: every plot a corner of a working farm. Its sub-themes (a red barn, a dairy, a
// grain farm, an orchard, a market garden) are recipes in src/sim/themes.js; this is how it draws
// them. Finished work is a crop come ripe in the kitchen garden where the village has a flower
// bed. The countryside between the plots and the arrival square stay the village's, so a farm plot
// can stand in any village and any plot can stand on a farm.
import { buildingFrames, chimneyOf, drawFarmBuilding, fitted, heightOf, shadowOf } from './buildings.js'
import { drawCrop } from './crops.js'
import { drawFarmLandmark, drawFarmProp, heightOf as landmarkHeight, landmarkFrames, shadowOf as landmarkShadow } from './landmarks.js'
import { BED_EDGE, COVER_VARIANTS, ROAD_EDGE, drawBed, drawCover, drawFence, drawFringe, drawGround, drawRoad, drawTrail, drawVerge, farmCover, patches } from './ground.js'
import { drawFarmInterior } from './interiors.js'

/** @type {import('../index.js').ThemePack} */
export const farm = {
  id: 'farm',
  sprite(name, frame, p) {
    const [group, a, b] = name.split('.')
    const n = Number(b || 0)
    switch (group) {
      case 'building':
        return drawFarmBuilding({ kind: a, stage: n, accent: p.accent, variant: p.variant, lit: p.lit, frame, wall: p.wall, roofs: p.roofs, low: p.low, wear: p.wear })
      case 'fence':
        return drawFence(Number(a), n)
      case 'flower':
        return drawCrop(Number(a), n, p.color)
      case 'static':
        // Only what a plot's landmark brings: the countryside and the square stay the village's.
        return drawFarmProp(a, n, p)
      case 'landmark':
        return drawFarmLandmark({ tier: Number(a), stage: n, variant: p.variant, accent: p.accent, wall: p.wall, roofs: p.roofs, lit: p.lit, busy: p.busy, frame })
      case 'interior':
        // Inside one of its buildings: what the room is made of, and the things in it that could
        // only be here. Everything else in a room is the village's, and means what it does there.
        return drawFarmInterior(a, n)
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
  cover: farmCover,
  patches,
  edges: { road: ROAD_EDGE, bed: BED_EDGE },
  landmark: { heightOf: landmarkHeight, shadowOf: landmarkShadow, frames: landmarkFrames },
}
