// Hanukkah's markers for a spotlight (named in src/sim/themes.js). See
// src/render/sprites/spotlights.js for what every theme's markers share.
import { PALETTE as P } from '../../sprites/palette.js'
import { INK, drawMarker } from '../../sprites/spotlights.js'

const MARKERS = {
  // A hanukkiah: eight candles in a row, four either side, and the shammash standing above them
  // on the middle stem, every flame lit. The first marker a folder shows.
  hanukkiah: [[
    '.....y.....',
    '.....Y.....',
    'yyyy.w.yyyy',
    'YYYY.W.YYYY',
    'wWwW.w.wWwW',
    'wWwW.W.wWwW',
    'sssssssssss',
    'XXXXXsXXXXX',
    '.....s.....',
    '.....s.....',
    '...sssss...',
    '...XXXXX...',
  ], { X: INK, s: P.hkBrassLight, y: P.flameTip, Y: P.flameCore, w: P.white, W: P.hkPaint[3] }],
  // A dreidel: the spinning top, a letter on its face, its point to the table.
  dreidel: [[
    '.....XX....',
    '.....XX....',
    '...XXXXXX..',
    '..XbbbbbbX.',
    '.XbbWbWbbbX',
    '.XbbWWWbbbX',
    '.XbbbWbWbbX',
    '..XbbbbbbX.',
    '...XbbbbX..',
    '....XbbX...',
    '.....XX....',
    '.....X.....',
  ], { X: INK, b: P.dreidelBlue, W: P.white }],
  // Gelt: foil-wrapped chocolate coins, stacked and spilling.
  gelt: [[
    '...........',
    '...XXXXX...',
    '..XgGGGgX..',
    '..XgGdGgX..',
    '..XXXXXXX..',
    '.XXXXXXXXXX',
    'XgGGgXgGGgX',
    'XgGdGXgGdGX',
    'XgGGgXgGGgX',
    '.XXXXXXXXX.',
    '...........',
    '...........',
  ], { X: INK, g: P.geltGold, G: P.geltGold, d: P.geltGoldDark }],
  // A sufganiyah: a jam doughnut dusted with sugar, a bite showing the jelly.
  sufganiyah: [[
    '...........',
    '...XXXXX...',
    '..XdddddX..',
    '.XdsdsdsdX.',
    'XdddddddddX',
    'XdsdddJdsdX',
    'XdddddJdddX',
    'XdsdsdsddsX',
    '.XdddddddX.',
    '..XXdddXX..',
    '....XXX....',
    '...........',
  ], { X: INK, d: P.crustLight, s: P.sugarDust, J: P.ember }],
  // Latkes: a golden stack of potato pancakes, a spoon of applesauce on top.
  latke: [[
    '...........',
    '.....XXX...',
    '....XaaaX..',
    '...XXXXXX..',
    '..XXXXXXXX.',
    '.XppPpPppX.',
    '.XXXXXXXXX.',
    '.XpPpPpPpX.',
    '.XXXXXXXXX.',
    '.XpPpPpPpX.',
    '..XXXXXXX..',
    '...........',
  ], { X: INK, p: P.honey, P: P.geltGoldDark, a: P.hkPaint[7] }],
}

export const drawHanukkahSpotlight = (id) => drawMarker(MARKERS, id)
