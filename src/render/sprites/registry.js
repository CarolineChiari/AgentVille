// Every sprite the renderer draws comes through here, by name. A generated sprite is made on
// first use and kept; a hand-drawn PNG named in public/sprites/manifest.json replaces it.
//
// Names:  villager.<anim>.<facing>      (params: look)
//         building.<kind>.<stage>       (params: accent, variant, lit; wall and roofs from the plot's style;
//                                        low, down the sides of a courtyard, see `fitted`; wear, how
//                                        long since its thread did anything, see src/sim/wear.js)
//         tile.<kind>.<variant>         (params: tone, a lawn's green; links, a footpath's joins)
//         deco.<kind>.<variant>         (params: tone, a lawn's green, for lawn cover and fence
//                                        verges; ground too, for a path's grass fringe)
//         fence.<style>.<mask>          (style into FENCES; mask: 1 N, 2 E, 4 S, 8 W carry on)
//         static.<sprite>.<variant>     (params: lit; a board's variant is how many notes it shows)
//         landmark.<tier>.<stage>       (params: accent, variant, wall and roofs as a building's; lit, its
//                                        windows after dark; busy, somebody on its plot is in; frames
//                                        from its pack's landmark.frames)
//         flower.<kind>.<stage>         (params: color)
//         interior.<piece>.<variant>    (inside a building: the floor and wall of a room, and its
//                                        furniture. A variant means something different per piece;
//                                        see INTERIOR_VARIANTS in interiors.js)
//         fx.badge.<kind>   fx.z   fx.ring.<color>   fx.shadow.<w>   fx.shadow.<w>x<h>
//         fx.butterfly.<color>   fx.bird       (two frames each: wings up, wings down)
//         fx.bunting                    (the arrival square's, the size of its cell; two frames;
//                                        params: accents, the repos' colours it flies)
//         fx.crystal                    (floating over an obelisk; frame 1 glints)
//         fx.pigeon.<w|e>               (frames: standing, pecking, two of flight)
//         static.<sprite>.<variant> takes a frame too, for the fountain's water
//         tile.square.<y * 12 + x>      (one tile of the arrival square's floor)
//
// Any sprite's params may carry `theme`, a theme id. Its pack (src/render/themes/) gets the first
// look at the request and draws it its own way, or passes it on to the village's generators here.
import { drawVillager } from './villagers.js'
import { drawBuilding } from './buildings.js'
import { drawDeco, drawFence, drawStatic, drawTile } from './tiles.js'
import { drawBadge, drawBird, drawBunting, drawButterfly, drawCrystal, drawPigeon, drawRing, drawShadow, drawZ } from './effects.js'
import { drawFlower } from './flowers.js'
import { drawLandmark } from './landmarks.js'
import { drawInterior } from './interiors.js'
import { PACKS } from '../themes/index.js'

const memo = new Map()
const overrides = new Map() // name → canvas[] (one per frame)

/** The sprite's pixels, freshly drawn. Exported so tests can look at every sprite without a DOM. */
export function generate(name, frame, p) {
  const own = p.theme ? PACKS[p.theme]?.sprite?.(name, frame, p) : null
  if (own) return own
  const [group, a, b] = name.split('.')
  switch (group) {
    case 'villager':
      return drawVillager(p.look, a, b, frame)
    case 'building':
      return drawBuilding({ kind: a, stage: Number(b), accent: p.accent, variant: p.variant, lit: p.lit, frame, wall: p.wall, roofs: p.roofs, low: p.low, wear: p.wear })
    case 'tile':
      return drawTile(a, Number(b), p)
    case 'deco':
      return drawDeco(a, Number(b || 0), p)
    case 'fence':
      return drawFence(Number(a), Number(b))
    case 'flower':
      return drawFlower(Number(a), Number(b), p.color)
    case 'landmark':
      return drawLandmark({ tier: Number(a), stage: Number(b), variant: p.variant, accent: p.accent, wall: p.wall, roofs: p.roofs, lit: p.lit, busy: p.busy, frame })
    case 'static':
      return drawStatic(a, Number(b || 0), { ...p, frame })
    case 'interior':
      return drawInterior(a, Number(b || 0))
    case 'fx':
      if (a === 'badge') return drawBadge(b)
      if (a === 'z') return drawZ()
      if (a === 'ring') return drawRing(b)
      if (a === 'butterfly') return drawButterfly(Number(b), frame)
      if (a === 'bird') return drawBird(frame)
      if (a === 'bunting') return drawBunting(frame, p.accents)
      if (a === 'crystal') return drawCrystal(frame)
      if (a === 'pigeon') return b === 'e' ? drawPigeon(frame).flipX() : drawPigeon(frame)
      if (a === 'shadow') {
        // A bare width gets a shadow a third as deep; a building's is far wider than it is deep.
        const [w, h] = b.split('x').map(Number)
        return drawShadow(w, h || Math.max(3, Math.round(w / 3)))
      }
  }
  throw new Error(`No generator for sprite "${name}"`)
}

export function paramKey(p) {
  if (!p) return ''
  let s = ''
  for (const k of Object.keys(p).sort()) {
    const v = p[k]
    s += `${k}=${v && typeof v === 'object' ? Object.values(v).join(',') : v};`
  }
  return s
}

export const sprites = {
  /** @returns {HTMLCanvasElement} */
  get(name, frame = 0, params = undefined) {
    const o = overrides.get(name)
    if (o) return o[frame % o.length]
    const k = `${name}#${frame}|${paramKey(params)}`
    let c = memo.get(k)
    if (!c) {
      c = generate(name, frame, params || {}).toCanvas()
      memo.set(k, c)
    }
    return c
  },

  /**
   * Load hand-drawn overrides. Entry: { src, frameW, frameH, frames = 1, row = 0, col = 0 }.
   * Anything that fails to load keeps its generated version.
   */
  async init(manifestUrl = '/sprites/manifest.json') {
    let manifest
    try {
      manifest = await (await fetch(manifestUrl)).json()
    } catch {
      return
    }
    const entries = Object.entries(manifest?.sprites || {})
    await Promise.all(
      entries.map(async ([name, e]) => {
        try {
          const img = new Image()
          img.src = e.src
          await img.decode()
          const frames = []
          for (let i = 0; i < (e.frames || 1); i++) {
            const c = document.createElement('canvas')
            c.width = e.frameW
            c.height = e.frameH
            c.getContext('2d').drawImage(img, ((e.col || 0) + i) * e.frameW, (e.row || 0) * e.frameH, e.frameW, e.frameH, 0, 0, e.frameW, e.frameH)
            frames.push(c)
          }
          overrides.set(name, frames)
        } catch (err) {
          console.warn(`Sprite override "${name}" failed to load; using the generated one.`, err)
        }
      }),
    )
  },

  clear() {
    memo.clear()
  },
}
