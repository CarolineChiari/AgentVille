// The Neon city theme: every plot a block of a rainy city that comes alive at night. Its sub-themes
// (a noodle market, an arcade row, a data centre, rooftop gardens, a transit hub) are recipes in
// src/sim/themes.js; this is how it draws them. Finished work is a neon sign, set out in the sign
// row where the village has a garden. The countryside between the plots, the arrival square, the
// plots' landmarks and the rooms inside stay the village's, so a neon plot can stand in any village.
import { buildingFrames, chimneyOf, drawNeonBuilding, fitted, heightOf, shadowOf } from './buildings.js'
import { drawNeonSign } from './signs.js'
import { BED_EDGE, COVER_VARIANTS, ROAD_EDGE, drawBed, drawCover, drawFence, drawFringe, drawGround, drawRoad, drawTrail, drawVerge, neonCover, patches } from './ground.js'
import { drawNeonSpotlight } from './spotlights.js'

/** @type {import('../index.js').ThemePack} */
export const neonCity = {
  id: 'neon-city',
  sprite(name, frame, p) {
    const [group, a, b] = name.split('.')
    const n = Number(b || 0)
    switch (group) {
      case 'fx':
        // Its own markers for a spotlight. Every other effect means what it does in every theme.
        return a === 'spotlight' ? drawNeonSpotlight(b) : null
      case 'building':
        return drawNeonBuilding({ kind: a, stage: n, accent: p.accent, variant: p.variant, lit: p.lit, frame, wall: p.wall, roofs: p.roofs, low: p.low, wear: p.wear, grade: p.grade })
      case 'fence':
        return drawFence(Number(a), n)
      case 'flower':
        return drawNeonSign(Number(a), n, p.color)
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
    // Everything else says what it means in every theme — badges, rings, smoke, shadows, the
    // birds, the rooms — and is left exactly as it is.
    return null
  },
  buildings: { fitted, heightOf, shadowOf, frames: buildingFrames, chimneyOf },
  cover: neonCover,
  patches,
  edges: { road: ROAD_EDGE, bed: BED_EDGE },
}
