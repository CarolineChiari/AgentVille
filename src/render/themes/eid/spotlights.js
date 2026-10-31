// Eid's markers for a spotlight (named in src/sim/themes.js). See
// src/render/sprites/spotlights.js for what every theme's markers share.
import { PALETTE as P } from '../../sprites/palette.js'
import { INK, drawMarker } from '../../sprites/spotlights.js'

const MARKERS = {
  // The crescent with its star: the sign of the month's end, and the first marker a folder shows.
  crescent: [[
    '...........',
    '..XXXXX....',
    '.XgggggX...',
    'XgggGGXX...',
    'XggGXX..X..',
    'XgGX...XsX.',
    'XgG...XsssX',
    'XgGX...XsX.',
    'XggGXX..X..',
    'XgggGGXX...',
    '.XgggggX...',
    '..XXXXX....',
  ], { X: INK, g: P.eidBrassLight, G: P.eidBrass, s: P.glowCandle }],
  // A fanous: the festival lantern, brass-capped, a candle lit behind coloured glass.
  fanous: [[
    '....XXX....',
    '...XgggX...',
    '..XXGgGXX..',
    '.XgrrYrrgX.',
    '.XgrYyYrgX.',
    '.XgrYyYrgX.',
    '.XgrrYrrgX.',
    '..XgrrrgX..',
    '..XXGgGXX..',
    '...XgggX...',
    '....XgX....',
    '.....X.....',
  ], { X: INK, g: P.eidBrassLight, G: P.eidBrass, r: P.eidPaint[3], Y: P.glowCandle, y: P.flameTip }],
  // Dates heaped on a brass plate, the first thing broken at the fast's end.
  dates: [[
    '...........',
    '....XXX....',
    '...XdDdX...',
    '...XdddX...',
    '..XXXdXXX..',
    '.XdDdXdDdX.',
    '.XdddXdddX.',
    '.XXXXXXXXX.',
    '.XhhhhhhhX.',
    '..XhHHHhX..',
    '...XXXXX...',
    '...........',
  ], { X: INK, d: P.dateBrown, D: P.crustDark, h: P.eidBrassLight, H: P.eidBrass }],
  // A ma'amoul, the filled cookie pressed in its mould and dusted with sugar.
  maamoul: [[
    '...........',
    '...XXXXX...',
    '..XbbbbbX..',
    '.XbbsbsbbX.',
    'XbbsbbbsbbX',
    'XbbbbsbbbbX',
    'XbbsbbbsbbX',
    '.XbbsbsbbX.',
    '..XdddddX..',
    '...XXXXX...',
    '...........',
    '...........',
  ], { X: INK, b: P.eidSandstone, d: P.eidSandstoneDark, s: P.sugarDust }],
  // A date palm, its fronds spread over a ringed trunk.
  palm: [[
    '...XXXXX...',
    '.XXpppppXX.',
    'XpppPpPpppX',
    'XXpXXpXXpXX',
    '.X.XpPpX.X.',
    '...XXpXX...',
    '....XtX....',
    '....XTX....',
    '....XtX....',
    '....XTX....',
    '...XXtXX...',
    '...XXXXX...',
  ], { X: INK, p: P.palmGreen, P: P.palmGreenDark, t: P.clay, T: P.clayDark }],
}

export const drawEidSpotlight = (id) => drawMarker(MARKERS, id)
