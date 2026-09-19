// The construction theme: every plot a building site. Its sub-themes (new homes, high-rise,
// roadworks, restoration, an industrial park) are recipes in src/sim/themes.js; this is how it
// draws them. Finished work is a marker flag in a setting-out yard where the village has a
// garden. The countryside between the plots and the arrival square stay the village's.
import { buildingFrames, chimneyOf, drawSiteBuilding, fitted, heightOf, shadowOf } from './buildings.js'
import { drawFlag } from './flags.js'
import { drawSiteLandmark, drawSiteProp, heightOf as landmarkHeight, landmarkFrames, shadowOf as landmarkShadow } from './landmarks.js'
import { COVER_VARIANTS, ROAD_EDGE, drawBed, drawCover, drawFence, drawFringe, drawGround, drawRoad, drawTrail, drawVerge, patches, siteCover } from './ground.js'

/** @type {import('../index.js').ThemePack} */
export const construction = {
  id: 'construction',
  sprite(name, frame, p) {
    const [group, a, b] = name.split('.')
    const n = Number(b || 0)
    switch (group) {
      case 'building':
        return drawSiteBuilding({ kind: a, stage: n, accent: p.accent, variant: p.variant, lit: p.lit, frame, wall: p.wall, roofs: p.roofs, low: p.low, wear: p.wear })
      case 'fence':
        return drawFence(Number(a), n)
      case 'flower':
        return drawFlag(Number(a), n, p.color)
      case 'static':
        // Only what a plot's landmark brings: the countryside and the square stay the village's.
        return drawSiteProp(a, n, p)
      case 'landmark':
        return drawSiteLandmark({ tier: Number(a), stage: n, variant: p.variant, accent: p.accent, wall: p.wall, roofs: p.roofs, lit: p.lit, busy: p.busy, frame })
      case 'tile':
        if (a === 'yard') return drawGround(n, p.tone)
        if (a === 'trail') return drawTrail(n, p.links || 0, p.tone)
        if (a === 'road') return drawRoad(n)
        if (a === 'bed') return drawBed(n, p.tone)
        return null
      case 'deco':
        if (a === 'verge') return drawVerge(n, p.tone)
        // Where a road meets the site's ground. Grass hanging over it from the wild is the village's.
        if (a === 'fringe') return p.ground === 'yard' ? drawFringe(n, p.tone) : null
        if (Object.hasOwn(COVER_VARIANTS, a)) return drawCover(a, n, p.tone)
        return null
    }
    return null
  },
  buildings: { fitted, heightOf, shadowOf, frames: buildingFrames, chimneyOf },
  cover: siteCover,
  patches,
  edges: { road: ROAD_EDGE },
  landmark: { heightOf: landmarkHeight, shadowOf: landmarkShadow, frames: landmarkFrames },
}
