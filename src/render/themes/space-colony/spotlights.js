// The Space colony's markers for a spotlight (named in src/sim/themes.js). See
// src/render/sprites/spotlights.js for what every theme's markers share.
import { PALETTE as P } from '../../sprites/palette.js'
import { INK, drawMarker } from '../../sprites/spotlights.js'

const MARKERS = {
  // A habitat dome: glass over a garden, on a hull ring with its airlock. The theme's first marker.
  dome: [[
    '....XXX....',
    '..XXgggXX..',
    '.XgwgggggX.',
    '.XgwggggGX.',
    'XgggggggGGX',
    'XggTgTgggGX',
    'XgTTTTTggGX',
    'XXXXXXXXXXX',
    'XhhhhdhhhhX',
    'XhHHHdHHHhX',
    'XhhhhdhhhhX',
    '.XXXXXXXXX.',
  ], { X: INK, g: P.spaceGlass, w: P.spaceGlassLight, G: P.spaceGlassDark, T: P.spaceLeaf, h: P.spaceHull, H: P.spaceHullDark, d: P.spacePlateDark }],
  // A six-wheeled rover with its mast and camera.
  rover: [[
    '.....X.....',
    '....XmX....',
    '.....X.....',
    '..XXXXXXX..',
    '.XbbbbbbbX.',
    '.XbwwXbbbX.',
    'XbbbbbbbbbX',
    'XRRRRRRRRRX',
    'XXXXXXXXXXX',
    '.XkXX.XXkX.',
    'XkKkX.XkKkX',
    '.XXX...XXX.',
  ], { X: INK, m: P.spacePlateLight, b: P.spaceHull, w: P.spaceGlass, R: P.spacePaint[1], k: P.spacePlateDark, K: P.spacePlate }],
  // A rocket on its pad, the flame just lit.
  rocket: [[
    '.....X.....',
    '....XrX....',
    '...XrRrX...',
    '...XhhhX...',
    '...XhwhX...',
    '...XhgGX...',
    '...XhhhX...',
    '...XrrrX...',
    '..XXhhhXX..',
    '.XrXhhhXrX.',
    '.XXXfffXXX.',
    '....XfX....',
  ], { X: INK, r: P.spacePaint[3], R: P.spaceHull, h: P.spaceHull, w: P.spaceGlassLight, g: P.spaceGlass, G: P.spaceGlassDark, f: P.flameTip }],
  // A radar dish tilted at the sky on its mast.
  dish: [[
    '........X..',
    '..XXXXX.Xs.',
    '.XdddddXXX.',
    'XdDDDDDdXX.',
    'XdDddddDdX.',
    '.XdDDDDdX..',
    '..XXXXXX...',
    '....XmX....',
    '....XmX....',
    '...XmmmX...',
    '..XmmmmmX..',
    '..XXXXXXX..',
  ], { X: INK, d: P.spaceHull, D: P.spaceHullDark, s: P.spacePaint[3], m: P.spacePlateLight }],
  // A spacesuit helmet, the visor catching the light.
  helmet: [[
    '...XXXXX...',
    '..XhhhhhX..',
    '.XhwhhhhhX.',
    'XhhXXXXXhhX',
    'XhXvvvvvXhX',
    'XhXvWvvvXhX',
    'XhXvvvvvXhX',
    'XhhXXXXXhhX',
    '.XhhhhhhhX.',
    '.XcccGcccX.',
    '..XcccccX..',
    '...XXXXX...',
  ], { X: INK, h: P.spaceHull, w: P.spaceHullLight, v: P.spacePlateDark, W: P.spaceGlassLight, c: P.spacePaint[1], G: P.spaceHazard }],
}

export const drawSpaceSpotlight = (id) => drawMarker(MARKERS, id)
