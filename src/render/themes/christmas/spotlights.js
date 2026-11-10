// Christmas's markers for a spotlight (named in src/sim/themes.js). See
// src/render/sprites/spotlights.js for what every theme's markers share.
import { PALETTE as P } from '../../sprites/palette.js'
import { INK, drawMarker } from '../../sprites/spotlights.js'

const MARKERS = {
  // A tree hung with baubles and a gold star on top: the first marker a folder shows.
  tree: [[
    '.....X.....',
    '....XyX....',
    '...XgggX...',
    '..XgrgGgX..',
    '...XXgXX...',
    '..XgGgbgX..',
    '.XgGgrgGgX.',
    '..XXXgXXX..',
    '.XgbgGgrgX.',
    'XgGgrgGgbgX',
    'XXXXXtXXXXX',
    '....XtX....',
  ], { X: INK, y: P.xmasBulbYellow, g: P.xmasFirLight, G: P.xmasFir, r: P.xmasHolly, b: P.xmasBulbBlue, t: P.xmasLog }],
  // A wrapped present with a bow and a ribbon down the middle.
  present: [[
    '..XXX.XXX..',
    '.XrrrXrrrX.',
    '.XrXrrrXrX.',
    '..XXXrXXX..',
    '.XXXXrXXXX.',
    '.XgggrgggX.',
    '.XgwgrgggX.',
    '.XgggrgggX.',
    '.XrrrrrrrX.',
    '.XgggrgggX.',
    '.XGGGrGGGX.',
    '.XXXXXXXXX.',
  ], { X: INK, r: P.xmasHolly, g: P.xmasPaint[1], G: P.xmasFirDark, w: P.xmasFirLight }],
  // A candy cane, hooked over at the top.
  candycane: [[
    '...XXXXX...',
    '..XrwrwrX..',
    '.XwrXXXwrX.',
    '.XrX..XwrX.',
    '.XXX..XrwX.',
    '......XwrX.',
    '......XrwX.',
    '......XwrX.',
    '......XrwX.',
    '......XwrX.',
    '......XrwX.',
    '......XXXX.',
  ], { X: INK, r: P.xmasCandyRed, w: P.xmasIcing }],
  // A snowman in a top hat and a red scarf.
  snowman: [[
    '...XXXXX...',
    '...XhhhX...',
    '..XXXXXXX..',
    '...XwwwX...',
    '...XeoeX...',
    '..XrrrrrX..',
    '..XXwwwXX..',
    '.XwwwcwwwX.',
    '.XwwwwwwwX.',
    '.XwwwcwwwX.',
    '..XwwwwwX..',
    '...XXXXX...',
  ], { X: INK, h: P.xmasLogDark, w: P.xmasSnow, e: P.xmasLogDark, o: P.xmasGumdrop, r: P.xmasHolly, c: P.xmasLogDark }],
  // A wreath of fir with berries and a red bow.
  wreath: [[
    '...XXXXX...',
    '.XXgGgGgXX.',
    'XgGXXXXXgGX',
    'XgXX...XXgX',
    'XGX.....XrX',
    'XrX.....XGX',
    'XGX.....XgX',
    'XgXX...XXGX',
    'XgGXXXXXgGX',
    '.XXgrXrgXX.',
    '..XrrXrrX..',
    '...XXXXX...',
  ], { X: INK, g: P.xmasFirLight, G: P.xmasFir, r: P.xmasHolly }],
}

export const drawChristmasSpotlight = (id) => drawMarker(MARKERS, id)
