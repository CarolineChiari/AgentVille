// Diwali's markers for a spotlight (named in src/sim/themes.js). See
// src/render/sprites/spotlights.js for what every theme's markers share.
import { PALETTE as P } from '../../sprites/palette.js'
import { INK, drawMarker } from '../../sprites/spotlights.js'

const MARKERS = {
  // A diya, the clay lamp with its flame: the first marker a folder shows.
  diya: [[
    '.....X.....',
    '....XyX....',
    '....XYX....',
    '....XyX....',
    '.....X.....',
    '...XXXXX...',
    '.XXcccccXX.',
    'XccrrrrrccX',
    'XcCcccccCcX',
    '.XcCCCCCcX.',
    '..XXCCCXX..',
    '....XXX....',
  ], { X: INK, y: P.flameTip, Y: P.glowCandle, c: P.diyaClayLight, C: P.diyaClay, r: P.diwaliPaint[0] }],
  // A rangoli: a mandala of coloured powder, a lotus at its heart.
  rangoli: [[
    '.....X.....',
    '....XmX....',
    '..X.XoX.X..',
    '.XbXXoXXbX.',
    '..XomoYmoX.',
    'XmoYYpYYomX',
    '..XomoYmoX.',
    '.XbXXoXXbX.',
    '..X.XoX.X..',
    '....XmX....',
    '.....X.....',
    '...........',
  ], { X: INK, m: P.diwaliPaint[0], o: P.marigold, b: P.diwaliPaint[2], Y: P.marigoldLight, p: P.white }],
  // A string of marigolds, the garland hung over every door.
  marigold: [[
    '...........',
    'X.........X',
    'XXX.....XXX',
    'XoXXXXXXXoX',
    '.XoYoXoYoX.',
    '.XYoYXYoYX.',
    '..XoXXXoX..',
    '..XoYXoYX..',
    '...XYXXY...',
    '....XoX....',
    '.....X.....',
    '...........',
  ], { X: INK, o: P.marigold, Y: P.marigoldLight }],
  // An akash kandil, the star lantern hung high.
  kandil: [[
    '.....X.....',
    '.....g.....',
    '....XrX....',
    '...XrrrX...',
    'XXXrrYrrXXX',
    '.XrrYyYrrX.',
    '..XrYyYrX..',
    'XXXrrYrrXXX',
    '...XrrrX...',
    '....XrX....',
    '....XgX....',
    '.....X.....',
  ], { X: INK, r: P.diwaliPaint[3], Y: P.glowCandle, y: P.flameTip, g: P.diwaliBrassLight }],
  // Mithai on a brass plate: laddoos and a square of barfi.
  mithai: [[
    '...........',
    '...........',
    '...XXX.....',
    '..XoYoX.XX.',
    '..XoooX.XpX',
    '...XXX..XpX',
    '.XXXXXXXXXX',
    'XhhhhhhhhhX',
    '.XhHHHHHhX.',
    '..XXXXXXX..',
    '...........',
    '...........',
  ], { X: INK, o: P.marigold, Y: P.marigoldLight, p: P.pistachio, h: P.diwaliBrassLight, H: P.diwaliBrass }],
}

export const drawDiwaliSpotlight = (id) => drawMarker(MARKERS, id)
