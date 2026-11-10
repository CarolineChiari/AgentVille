// Lunar New Year's markers for a spotlight (named in src/sim/themes.js). See
// src/render/sprites/spotlights.js for what every theme's markers share.
import { PALETTE as P } from '../../sprites/palette.js'
import { INK, drawMarker } from '../../sprites/spotlights.js'

const MARKERS = {
  // A red lantern: gold caps, a glow in the paper and a tassel. The first marker a folder shows.
  lantern: [[
    '....XXX....',
    '...XgggX...',
    '..XXGgGXX..',
    '.XrrrYrrrX.',
    '.XrrYyYrrX.',
    '.XrrYyYrrX.',
    '.XrrrYrrrX.',
    '..XrrrrrX..',
    '..XXGgGXX..',
    '...XgggX...',
    '....XtX....',
    '....XtX....',
  ], { X: INK, g: P.lnyGoldLight, G: P.lnyGold, r: P.lnyPaint[0], Y: P.glowCandle, y: P.flameTip, t: P.lnyGoldDark }],
  // A string of firecrackers hung from a cord, the last one lit.
  firecracker: [[
    '.....X.....',
    '...XXgX....',
    '..XrrrX....',
    '..XrRrX....',
    '..XXXXX....',
    '..XrrrX....',
    '..XrRrX....',
    '..XXXXX....',
    '..XrrrX....',
    '..XrRrX....',
    '..XXXXX.Y..',
    '.......YyY.',
  ], { X: INK, g: P.lnyGoldLight, r: P.lnyPaint[0], R: P.lnyPaint[2], Y: P.flameTip, y: P.flameCore }],
  // A red envelope with a gold fu on it, the gift of the new year.
  envelope: [[
    '...........',
    '.XXXXXXXXX.',
    '.XrrrgrrrX.',
    '.XrrgGgrrX.',
    '.XrrrgrrrX.',
    '.XrgrgrgrX.',
    '.XrrgGgrrX.',
    '.XrrrgrrrX.',
    '.XrrrrrrrX.',
    '.XRRRRRRRX.',
    '.XXXXXXXXX.',
    '...........',
  ], { X: INK, r: P.lnyPaint[0], R: P.lnyPaint[2], g: P.lnyGoldLight, G: P.lnyGold }],
  // Plum blossom on a bare branch, five petals open.
  blossom: [[
    '...........',
    '..XXX......',
    '.XpppX..XX.',
    '.XpwpXXXppX',
    '.XpppXpwpX.',
    '..XXXXXXX..',
    '...XbX.....',
    '.XXbXXXX...',
    '.XbbXppX...',
    '..XXXpwpX..',
    '.....XppX..',
    '......XX...',
  ], { X: INK, p: P.lnyPaint[6], w: P.white, b: P.lnyPaint[5] }],
  // Mandarin oranges, a pair with their leaves: luck and plenty.
  tangerine: [[
    '...........',
    '...........',
    '.....X.....',
    '....XlX....',
    '..XXXlXXX..',
    '.XoooXoooX.',
    '.XoOoXooOoX',
    'XooooXooooX',
    'XooooXooooX',
    '.XooXXXooX.',
    '..XXX.XXX..',
    '...........',
], { X: INK, o: P.lnyPaint[7], O: P.lnyGoldLight, l: P.palmGreen }],
}

export const drawLnySpotlight = (id) => drawMarker(MARKERS, id)
