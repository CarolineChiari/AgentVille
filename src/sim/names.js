// Villager names: deterministic, stable, pure — the same thread id always
// gets the same name. No DOM, no state.

import { hashString } from './rng.js'

/**
 * Short, pronounceable village names. Kept to 2 syllables where possible so
 * they read well in toasts and under villager sprites.
 */
export const VILLAGER_NAMES = [
  'Wren', 'Otto', 'Mabel', 'Finn', 'Hazel', 'Jude', 'Clover', 'Bram',
  'Ivy', 'Rowan', 'Sage', 'Theo', 'Poppy', 'Alder', 'Fern', 'Milo',
  'Juniper', 'Silas', 'Willa', 'Ezra', 'Maple', 'Oscar', 'Tansy', 'Hugh',
  'Briar', 'Nora', 'Cedar', 'Elsie', 'Flint', 'Greta', 'Hollis', 'Isla',
  'Jasper', 'Lark', 'Moss', 'Nell', 'Orson', 'Piper', 'Quill', 'Rue',
  'Sorrel', 'Tilda', 'Ash', 'Bea', 'Cole', 'Della', 'Elm', 'Faye',
  'Gus', 'Harriet', 'Ida', 'Jonah', 'Kit', 'Lena', 'Maud', 'Nico',
  'Olive', 'Pete', 'Robin', 'Sylvie', 'Tobin', 'Una', 'Vera', 'Walt',
  'Zelda', 'Amos', 'Birdie', 'Cyrus', 'Dot', 'Emmett', 'Flora', 'Gideon',
  'Hattie', 'Ike', 'June', 'Kip', 'Lula', 'Miles', 'Noa', 'Opal',
  'Perry', 'Queenie', 'Rufus', 'Sadie', 'Tate', 'Uma', 'Vince', 'Wendell',
  'Xanthe', 'Yara', 'Zeke', 'Alba', 'Bex', 'Corin', 'Daisy', 'Elias',
  'Freya', 'Gull', 'Hester', 'Ivo', 'Joss', 'Kestrel', 'Lotte', 'Merritt',
  'Niamh', 'Oslo', 'Petra', 'Reed', 'Suki', 'Thistle', 'Ursa', 'Vale',
  'Winslow', 'Yew', 'Zora', 'Ansel', 'Blythe', 'Cato', 'Demi', 'Enzo',
  'Fable', 'Grover', 'Hero', 'Ines', 'Jory', 'Kaia', 'Leif', 'Minna',
  'Newt', 'Odile', 'Pax', 'Rhea', 'Stellan', 'Tess', 'Ulric', 'Wrenna',
  'Yannis', 'Zephyr', 'Ari', 'Belle', 'Caspian', 'Dove', 'Edie', 'Fox',
  'Gemma', 'Hale', 'Isolde', 'Jett', 'Klara', 'Linden', 'Maren', 'Nils',
  'Ondine', 'Piers', 'Romy', 'Soren', 'Tamsin', 'Ulysses', 'Vida', 'Wilder',
  'Xenia', 'York', 'Zinnia', 'Auden', 'Bryn', 'Clement', 'Dusk', 'Eira',
  'Forrest', 'Goldie', 'Hawthorn', 'Imre', 'Junipero', 'Koa', 'Lior', 'Magnus',
  'Nerys', 'Oberon', 'Plum', 'Quincy', 'Rune', 'Sable', 'Torin', 'Undine',
  'Vesper', 'Wilbur', 'Ximena', 'Ysolde', 'Zane', 'Aster', 'Birch', 'Cerys',
]

/**
 * Returns the stable display name for a thread/villager id.
 * Pure: same input -> same output, no side effects.
 *
 * @param {string} threadId
 * @returns {string}
 */
export function nameFor(threadId) {
  return VILLAGER_NAMES[hashString(`name:${threadId}`) % VILLAGER_NAMES.length]
}
