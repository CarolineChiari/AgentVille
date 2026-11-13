// Día de los Muertos's markers for a spotlight (named in src/sim/themes.js). See
// src/render/sprites/spotlights.js for what every theme's markers share.
import { PALETTE as P } from '../../sprites/palette.js'
import { INK, drawMarker } from '../../sprites/spotlights.js'

const MARKERS = {
  // A cempasúchil in full bloom: the first marker a folder shows.
  cempasuchil: [[
    '...........',
    '...XXXXX...',
    '..XoOoOoX..',
    '.XOoYYYoOX.',
    '.XoYyyyYoX.',
    '.XOYyyyYOX.',
    '.XoYYYYYoX.',
    '..XOoOoOX..',
    '...XXgXX...',
    '....XgX.X..',
    '....XgXgX..',
    '.....XXX...',
  ], { X: INK, o: P.marigold, O: P.marigoldDeep, Y: P.marigoldLight, y: P.muertosPaint[4], g: P.palmGreen }],
  // A sugar skull: white icing, dark eyes, a flower on its brow.
  calavera: [[
    '...........',
    '...XXXXX...',
    '..XwwpwwX..',
    '.XwwpYpwwX.',
    '.XwwwpwwwX.',
    '.XwXXwXXwX.',
    '.XwXtwXtwX.',
    '.XwwwXwwwX.',
    '..XwbwbwX..',
    '..XwXwXwX..',
    '...XwwwX...',
    '....XXX....',
  ], { X: INK, w: P.sugarSkull, p: P.muertosPaint[0], Y: P.marigoldLight, t: P.muertosPaint[2], b: P.muertosPaint[3] }],
  // A veladora: a tall glass candle, painted, its flame over the rim.
  veladora: [[
    '.....X.....',
    '....XyX....',
    '....XYX....',
    '...XXXXX...',
    '...XgggX...',
    '...XpppX...',
    '...XpwpX...',
    '...XpppX...',
    '...XpppX...',
    '...XgggX...',
    '...XXXXX...',
    '...........',
  ], { X: INK, y: P.flameTip, Y: P.glowCandle, g: P.talaveraDark, p: P.muertosPaint[3], w: P.white }],
  // A flag of papel picado on its cord, cut through.
  picado: [[
    '...........',
    'XXXXXXXXXXX',
    '.XpppppppX.',
    '.XpppwpppX.',
    '.XppwpwppX.',
    '.XpwpwpwpX.',
    '.XppwpwppX.',
    '.XpppwpppX.',
    '.XpppppppX.',
    '.XpXpXpXpX.',
    '.XXpXpXpXX.',
    '..X.X.X.X..',
  ], { X: INK, p: P.muertosPaint[0], w: P.white }],
  // A pan de muerto: the round loaf with its bones crossed on top, sugared.
  pan: [[
    '...........',
    '...........',
    '.....XX....',
    '....XssX...',
    '..XXbbbbXX.',
    '.XbsBbbBsbX',
    'XbbbBssBbbX',
    'XbsbbBBbbsX',
    'XbbbBbbBbbX',
    '.XBBBBBBBX.',
    '..XXXXXXX..',
    '...........',
  ], { X: INK, b: P.panMuerto, B: P.panMuertoDark, s: P.sugarDust }],
}

export const drawMuertosSpotlight = (id) => drawMarker(MARKERS, id)
