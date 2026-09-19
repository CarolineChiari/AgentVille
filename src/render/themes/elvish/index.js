// The elvish theme: every plot a corner of a wood the elves keep. Its sub-themes (a greenwood, a
// silver wood, a river hall, a golden bough, a thorn hold) are recipes in src/sim/themes.js; this
// is how it draws them. Finished work is a lantern lit on its stand in the lantern grove where
// the village has a garden. The countryside between the plots and the arrival square stay the
// village's, so an elvish plot can stand in any village.
import { buildingFrames, chimneyOf, drawElfBuilding, fitted, heightOf, shadowOf } from './buildings.js'
import { drawLantern } from './lanterns.js'
import { BED_EDGE, COVER_VARIANTS, ROAD_EDGE, drawBed, drawCover, drawFence, drawFringe, drawGround, drawRoad, drawTrail, drawVerge, elfCover, patches } from './ground.js'

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
}
