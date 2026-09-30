// What a theme holds up over a villager someone is keeping an eye on: the countryside village's
// five, and the size every theme's are drawn at. A theme's own are in its pack
// (src/render/themes/<id>/spotlights.js) and named in src/sim/themes.js. However a marker looks,
// it means the same thing, "this one": the renderer bobs it over the villager's head, rings its
// feet in the spotlight's pink and points to it from the edge of the screen.
import { PALETTE as P } from './palette.js'
import { fromArt } from './art.js'

/** Every marker is this size, so the renderer can stand any theme's over anybody. Odd, to have a middle column. */
export const MARKER_W = 11
export const MARKER_H = 12

/** Outlined in the same ink as a plot's name, so a marker stands out on any ground, day or night. */
export const INK = P.labelInk

const MARKERS = {
  arrow: [[
    '...XXXXX...',
    '...X+ooX...',
    '...X+ooX...',
    '...X+ooX...',
    '...X+ooX...',
    '...X+ooX...',
    '.XXX+ooXXX.',
    '.X+ooooooX.',
    '..X+ooooX..',
    '...X+ooX...',
    '....XoX....',
    '.....X.....',
  ], { X: INK, o: P.spotlight, '+': P.spotlightLight }],
  star: [[
    '.....X.....',
    '....XyX....',
    '....XyX....',
    'XXXXywyXXXX',
    'XwyyyyyyyYX',
    '.XyyyyyyYX.',
    '..XyyyyyX..',
    '..XyyYyyX..',
    '.XyyYXYyyX.',
    '.XyYX.XYyX.',
    'XyYX...XYyX',
    'XXX.....XXX',
  ], { X: INK, y: P.gilt, Y: P.giltDark, w: P.glitterGlow }],
  heart: [[
    '...........',
    '.XXX...XXX.',
    'XrrrX.XrrrX',
    'XrwrrXrrrrX',
    'XrwrrrrrrRX',
    'XrrrrrrrrRX',
    '.XrrrrrrRX.',
    '..XrrrrRX..',
    '...XrrRX...',
    '....XRX....',
    '.....X.....',
    '...........',
  ], { X: INK, r: P.fruit, R: P.apple, w: P.white }],
  balloon: [[
    '...XXXXX...',
    '..XbbbbbX..',
    '.XbwbbbbBX.',
    '.XbwbbbbBX.',
    '.XbbbbbbBX.',
    '.XbbbbbbBX.',
    '..XbbbbBX..',
    '...XbbBX...',
    '....XXX....',
    '.....X.....',
    '....X......',
    '.....X.....',
  ], { X: INK, b: P.berry, B: P.steelDark, w: P.white }],
  crown: [[
    '...........',
    '...........',
    'X....X....X',
    'XyX.XyX.XyX',
    'XyyXyyyXyyX',
    'XwyyyyyyyYX',
    'XyryybyyrYX',
    'XyyyyyyyyYX',
    'XYYYYYYYYYX',
    'XXXXXXXXXXX',
    '...........',
    '...........',
  ], { X: INK, y: P.gilt, Y: P.giltDark, w: P.glitterGlow, r: P.fruit, b: P.berry }],
}

/**
 * A marker from `markers` (id → [rows, legend]) as a sprite, every one MARKER_W by MARKER_H.
 * An id the set doesn't have is null, so the registry can hand it on.
 */
export function drawMarker(markers, id) {
  const m = Object.hasOwn(markers, id) ? markers[id] : null
  return m ? fromArt(m[0], m[1]) : null
}

/** The village's own markers; anything it doesn't know is its arrow, so a marker is always drawn. */
export const drawSpotlight = (id) => drawMarker(MARKERS, id) || drawMarker(MARKERS, 'arrow')
