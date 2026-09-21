// The elvish theme: every plot a corner of a wood the elves keep. Its sub-themes (a greenwood, a
// silver wood, a river hall, a golden bough, a thorn hold) are recipes in src/sim/themes.js; this
// is how it draws them. Finished work is a lantern lit on its stand in the lantern grove where
// the village has a garden. The countryside between the plots and the arrival square stay the
// village's, so an elvish plot can stand in any village.
import { buildingFrames, chimneyOf, drawElfBuilding, fitted, heightOf, shadowOf } from './buildings.js'
import { drawLantern } from './lanterns.js'
import { drawElfLandmark, drawElfProp, heightOf as landmarkHeight, landmarkFrames, shadowOf as landmarkShadow } from './landmarks.js'
import { BED_EDGE, COVER_VARIANTS, ROAD_EDGE, drawBed, drawCover, drawFence, drawFringe, drawGround, drawRoad, drawTrail, drawVerge, elfCover, patches } from './ground.js'
import { drawElfInterior } from './interiors.js'

/** @type {import('../index.js').ThemePack} */
export const elvish = {
  id: 'elvish',
  sprite(name, frame, p) {
    const [group, a, b] = name.split('.')
    const n = Number(b || 0)
    switch (group) {
      case 'building':
        return drawElfBuilding({ kind: a, stage: n, accent: p.accent, variant: p.variant, lit: p.lit, frame, wall: p.wall, roofs: p.roofs, low: p.low, wear: p.wear })
      case 'fence':
        return drawFence(Number(a), n)
      case 'flower':
        return drawLantern(Number(a), n, p.color)
      case 'static':
        // Only what a plot's landmark brings: the countryside and the square stay the village's.
        return drawElfProp(a, n, p)
      case 'landmark':
        return drawElfLandmark({ tier: Number(a), stage: n, variant: p.variant, accent: p.accent, wall: p.wall, roofs: p.roofs, lit: p.lit, busy: p.busy, frame })
      case 'interior':
        // Inside one of its buildings: what the room is made of, and the things in it that could
        // only be here. Everything else in a room is the village's, and means what it does there.
        return drawElfInterior(a, n)
      case 'tile':
        if (a === 'yard') return drawGround(n, p.tone)
        if (a === 'trail') return drawTrail(n, p.links || 0, p.tone)
        if (a === 'road') return drawRoad(n)
        if (a === 'bed') return drawBed(n, p.tone)
        return null
      case 'deco':
        if (a === 'verge') return drawVerge(n, p.tone)
        // Where the paved way meets the plot's ground. Grass hanging over it from the wild is the
        // village's, so only the plot's own ground is drawn here.
        if (a === 'fringe') return p.ground === 'yard' ? drawFringe(n, p.tone) : null
        if (Object.hasOwn(COVER_VARIANTS, a)) return drawCover(a, n, p.tone)
        return null
    }
    return null
  },
  buildings: { fitted, heightOf, shadowOf, frames: buildingFrames, chimneyOf },
  cover: elfCover,
  patches,
  edges: { road: ROAD_EDGE, bed: BED_EDGE },
  landmark: { heightOf: landmarkHeight, shadowOf: landmarkShadow, frames: landmarkFrames },
}
