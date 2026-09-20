// The Halloween theme: every plot a corner of the village on the last night of October. Its
// sub-themes (a pumpkin patch, a haunted manor, a graveyard, a witch's hollow, a trick-or-treat
// lane) are recipes in src/sim/themes.js; this is how it draws them. Finished work is a
// jack-o'-lantern carved and lit in the pumpkin patch where the village has a garden. The
// countryside between the plots and the arrival square stay the village's, so a Halloween plot
// can stand in any village.
import { buildingFrames, chimneyOf, drawHallowBuilding, fitted, heightOf, shadowOf } from './buildings.js'
import { drawJack } from './jacks.js'
import { drawHallowLandmark, drawHallowProp, heightOf as landmarkHeight, landmarkFrames, shadowOf as landmarkShadow } from './landmarks.js'
import { BED_EDGE, COVER_VARIANTS, ROAD_EDGE, drawBed, drawCover, drawFence, drawFringe, drawGround, drawRoad, drawTrail, drawVerge, hallowCover, patches } from './ground.js'

/** @type {import('../index.js').ThemePack} */
export const halloween = {
  id: 'halloween',
  sprite(name, frame, p) {
    const [group, a, b] = name.split('.')
    const n = Number(b || 0)
    switch (group) {
      case 'building':
        return drawHallowBuilding({ kind: a, stage: n, accent: p.accent, variant: p.variant, lit: p.lit, frame, wall: p.wall, roofs: p.roofs, low: p.low, wear: p.wear })
      case 'fence':
        return drawFence(Number(a), n)
      case 'flower':
        return drawJack(Number(a), n, p.color)
      case 'static':
        // Only what a plot's landmark brings: the countryside and the square stay the village's.
        return drawHallowProp(a, n, p)
      case 'landmark':
        return drawHallowLandmark({ tier: Number(a), stage: n, variant: p.variant, accent: p.accent, wall: p.wall, roofs: p.roofs, lit: p.lit, busy: p.busy, frame })
      case 'tile':
        if (a === 'yard') return drawGround(n, p.tone)
        if (a === 'trail') return drawTrail(n, p.links || 0, p.tone)
        if (a === 'road') return drawRoad(n)
        if (a === 'bed') return drawBed(n, p.tone)
        return null
      case 'deco':
        if (a === 'verge') return drawVerge(n, p.tone)
        // Where the lane meets the plot's ground. Grass hanging over it from the wild is the
        // village's, so only the plot's own ground is drawn here.
        if (a === 'fringe') return p.ground === 'yard' ? drawFringe(n, p.tone) : null
        if (Object.hasOwn(COVER_VARIANTS, a)) return drawCover(a, n, p.tone)
        return null
    }
    return null
  },
  buildings: { fitted, heightOf, shadowOf, frames: buildingFrames, chimneyOf },
  cover: hallowCover,
  patches,
  edges: { road: ROAD_EDGE, bed: BED_EDGE },
  landmark: { heightOf: landmarkHeight, shadowOf: landmarkShadow, frames: landmarkFrames },
}
