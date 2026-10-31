// The Eid theme: every plot a corner of a village on the festival. Its sub-themes (a lantern souk,
// courtyard homes, a night garden, a sweets street) are recipes in src/sim/themes.js; this is how
// it draws them. Finished work is a fanous, the festival lantern, set out on the lantern bed where
// the village has a garden. The countryside between the plots, the arrival square and the plots'
// landmarks stay the village's, so an Eid plot can stand in any village.
import { buildingFrames, chimneyOf, drawEidBuilding, fitted, heightOf, shadowOf } from './buildings.js'
import { drawEid } from './harvest.js'
import { BED_EDGE, COVER_VARIANTS, ROAD_EDGE, drawBed, drawCover, drawFence, drawFringe, drawGround, drawRoad, drawTrail, drawVerge, eidCover, patches } from './ground.js'
import { drawEidInterior } from './interiors.js'
import { drawEidSpotlight } from './spotlights.js'

/** @type {import('../index.js').ThemePack} */
export const eid = {
  id: 'eid',
  sprite(name, frame, p) {
    const [group, a, b] = name.split('.')
    const n = Number(b || 0)
    switch (group) {
      case 'fx':
        // Its own markers for a spotlight. Every other effect means what it does in every theme.
        return a === 'spotlight' ? drawEidSpotlight(b) : null
      case 'building':
        return drawEidBuilding({ kind: a, stage: n, accent: p.accent, variant: p.variant, lit: p.lit, frame, wall: p.wall, roofs: p.roofs, low: p.low, wear: p.wear, grade: p.grade })
      case 'fence':
        return drawFence(Number(a), n)
      case 'flower':
        return drawEid(Number(a), n, p.color)
      case 'interior':
        // Inside one of its buildings: what the room is made of, and the things in it that could
        // only be here. Everything else in a room is the village's, and means what it does there.
        return drawEidInterior(a, n)
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
  cover: eidCover,
  patches,
  edges: { road: ROAD_EDGE, bed: BED_EDGE },
}
