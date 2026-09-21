// The seaside theme: every plot a corner of a working harbour. Its sub-themes (a fishing harbour,
// beach huts, a lighthouse point, a boatyard, cliffside cottages) are recipes in
// src/sim/themes.js; this is how it draws them. Finished work is a find set out on the strand
// where the village has a garden. The countryside between the plots and the arrival square stay
// the village's, so a harbour plot can stand in any village and any plot can stand in a harbour.
//
// The gull is the one thing here the village itself asks for: `fx.bird` carries the whole
// village's theme, so the birds over a seaside village are gulls, and over anybody else's they
// are the village's own birds.
import { buildingFrames, chimneyOf, drawSeaBuilding, fitted, heightOf, shadowOf } from './buildings.js'
import { drawShell } from './shells.js'
import { drawSeaLandmark, drawSeaProp, heightOf as landmarkHeight, landmarkFrames, shadowOf as landmarkShadow } from './landmarks.js'
import { BED_EDGE, COVER_VARIANTS, ROAD_EDGE, drawBed, drawCover, drawFence, drawFringe, drawGround, drawRoad, drawTrail, drawVerge, patches, seaCover } from './ground.js'
import { drawGull } from './gulls.js'

/** @type {import('../index.js').ThemePack} */
export const seaside = {
  id: 'seaside',
  sprite(name, frame, p) {
    const [group, a, b] = name.split('.')
    const n = Number(b || 0)
    switch (group) {
      case 'building':
        return drawSeaBuilding({ kind: a, stage: n, accent: p.accent, variant: p.variant, lit: p.lit, frame, wall: p.wall, roofs: p.roofs, low: p.low, wear: p.wear })
      case 'fence':
        return drawFence(Number(a), n)
      case 'flower':
        return drawShell(Number(a), n, p.color)
      case 'static':
        // Only what a plot's landmark brings: the countryside and the square stay the village's.
        return drawSeaProp(a, n, p)
      case 'landmark':
        return drawSeaLandmark({ tier: Number(a), stage: n, variant: p.variant, accent: p.accent, wall: p.wall, roofs: p.roofs, lit: p.lit, busy: p.busy, frame })
      case 'tile':
        if (a === 'yard') return drawGround(n, p.tone)
        if (a === 'trail') return drawTrail(n, p.links || 0, p.tone)
        if (a === 'road') return drawRoad(n)
        if (a === 'bed') return drawBed(n, p.tone)
        return null
      case 'deco':
        if (a === 'verge') return drawVerge(n, p.tone)
        // Where the way meets the plot's ground. Grass hanging over it from the wild is the
        // village's, so only the plot's own ground is drawn here.
        if (a === 'fringe') return p.ground === 'yard' ? drawFringe(n, p.tone) : null
        if (Object.hasOwn(COVER_VARIANTS, a)) return drawCover(a, n, p.tone)
        return null
      case 'fx':
        // The birds over a harbour are gulls. Everything else in fx says what it means in every
        // theme — badges, rings, smoke, shadows — and is left exactly as it is.
        return a === 'bird' ? drawGull(frame) : null
    }
    return null
  },
  buildings: { fitted, heightOf, shadowOf, frames: buildingFrames, chimneyOf },
  cover: seaCover,
  patches,
  edges: { road: ROAD_EDGE, bed: BED_EDGE },
  landmark: { heightOf: landmarkHeight, shadowOf: landmarkShadow, frames: landmarkFrames },
}
