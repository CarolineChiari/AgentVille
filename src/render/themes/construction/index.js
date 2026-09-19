// The construction theme: every plot a building site. Its sub-themes (new homes, high-rise,
// roadworks, restoration, an industrial park) are recipes in src/sim/themes.js; this is how it
// draws them. The countryside between the plots, the arrival square and the flowers in each
// plot's garden stay the village's: finished work still blooms, as the site's landscaping.
import { buildingFrames, chimneyOf, drawSiteBuilding, fitted, heightOf, shadowOf } from './buildings.js'
import { COVER_VARIANTS, ROAD_EDGE, drawCover, drawFence, drawFringe, drawGround, drawRoad, drawTrail, drawVerge, patches, siteCover } from './ground.js'

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
      case 'tile':
        if (a === 'yard') return drawGround(n, p.tone)
        if (a === 'trail') return drawTrail(n, p.links || 0, p.tone)
        if (a === 'road') return drawRoad(n)
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
}
