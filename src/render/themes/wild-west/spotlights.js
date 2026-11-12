// The Wild West's markers for a spotlight (named in src/sim/themes.js). See
// src/render/sprites/spotlights.js for what every theme's markers share.
import { PALETTE as P } from '../../sprites/palette.js'
import { INK, drawMarker } from '../../sprites/spotlights.js'

const MARKERS = {
  // A sheriff's star: five points with a bead on each, a shine on the upper left. The theme's first.
  star: [[
    '.....X.....',
    '....XoX....',
    '....XyX....',
    'XXXXXyyXXXX',
    'XoyyywyyyoX',
    '.XyywyyyyX.',
    '..XyyyyyX..',
    '..XyyYyyX..',
    '.XyyYXYyyX.',
    '.XyYX.XYyX.',
    'XoYX...XYoX',
    'XXX.....XXX',
  ], { X: INK, y: P.wwGold, Y: P.giltDark, w: P.wwGoldLight, o: P.wwGoldLight }],
  // A horseshoe, heels up for luck, its nail holes showing.
  horseshoe: [[
    'XXX.....XXX',
    'XiX.....XiX',
    'XiIX...XIiX',
    'XiIX...XIiX',
    'XinX...XniX',
    'XiIX...XIiX',
    'XinX...XniX',
    'XiIIX.XIIiX',
    '.XiIIXIIiX.',
    '.XiiiiiiiX.',
    '..XXiiiXX..',
    '....XXX....',
  ], { X: INK, i: P.wwIronLight, I: P.wwIron, n: P.wwBone }],
  // A saguaro with its arms up and a flower on its crown.
  cactus: [[
    '....XXX....',
    '...XbBbX...',
    '...XgGgX...',
    '.XXXgGgX...',
    'XgXXgGgXXX.',
    'XgGXgGgXgGX',
    'XgGXgGgXgGX',
    'XgGGgGgXgGX',
    '.XXXgGgGgX.',
    '...XgGgXX..',
    '..XXgGgXX..',
    '..XXXXXXX..',
  ], { X: INK, g: P.wwCactus, G: P.wwCactusDark, b: P.wwBloom, B: P.wwBloom }],
  // A cowboy boot, its heel and its stitching, a spur at the back.
  boot: [[
    '.XXXXX.....',
    '.XlLlX.....',
    '.XlslX.....',
    '.XlLlX.....',
    '.XlslX.....',
    '.XlLlX.....',
    '.XlslLXXX..',
    '.XllllllLX.',
    'XXllllllllX',
    'oXDDlllllLX',
    'XXDDXXXXXX.',
    '.XXX.......',
  ], { X: INK, l: P.wwLeather, L: P.wwLeatherDark, s: P.wwGold, D: P.wwTimberDark, o: P.wwIronLight }],
  // A wagon wheel: an iron tyre, a painted rim, spokes to the hub.
  wheel: [[
    '...XXXXX...',
    '..XrrrrrX..',
    '.XrXsXsXrX.',
    'XrXXsXsXXrX',
    'XrsshhhssrX',
    'XrXXhHhXXrX',
    'XrsshhhssrX',
    'XrXXsXsXXrX',
    '.XrXsXsXrX.',
    '..XrrrrrX..',
    '...XXXXX...',
    '..XXXXXXX..',
  ], { X: INK, r: P.wwPaint[0], s: P.wwTimberLight, h: P.wwTimber, H: P.wwIron }],
}

export const drawWestSpotlight = (id) => drawMarker(MARKERS, id)
