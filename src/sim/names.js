// A short, stable name for every villager, so a thread can be talked about: "Wren is stuck".
// Pure: the same thread id always gets the same name. People rename threads (src/game/names.js);
// this is the villager's own name and is never saved.
import { hashString } from './rng.js'

// Only ever append: a villager's name is its id's hash into this list, so inserting or reordering
// would rename everyone. Short, easy to say, and no two the same.
export const VILLAGER_NAMES = [
  'Wren', 'Otto', 'Mabel', 'Finn', 'Hazel', 'Rufus', 'Ivy', 'Bram', 'Clover', 'Dot',
  'Egon', 'Fern', 'Gus', 'Hattie', 'Ike', 'Juniper', 'Kit', 'Lark', 'Milo', 'Nell',
  'Olive', 'Pip', 'Quill', 'Rue', 'Sage', 'Tansy', 'Uma', 'Vera', 'Wilf', 'Yara',
  'Zeb', 'Alder', 'Bea', 'Cass', 'Dill', 'Elm', 'Flint', 'Gemma', 'Hugo', 'Iris',
  'Jory', 'Kai', 'Lotte', 'Moss', 'Nan', 'Orrin', 'Posy', 'Quin', 'Rosa', 'Sorrel',
  'Tuck', 'Ulla', 'Vic', 'Willa', 'Xan', 'Yew', 'Zola', 'Ash', 'Basil', 'Cedar',
  'Daisy', 'Ember', 'Fable', 'Gwen', 'Heath', 'Ines', 'Jasper', 'Kestrel', 'Linden', 'Maple',
  'Nettle', 'Oak', 'Pearl', 'Quince', 'Robin', 'Sunny', 'Thistle', 'Una', 'Violet', 'Wick',
  'Yarrow', 'Zinnia', 'Arlo', 'Birdie', 'Cleo', 'Dune', 'Ernie', 'Faye', 'Gil', 'Hana',
  'Indigo', 'Jem', 'Kip', 'Lyle', 'Mina', 'Noor', 'Odette', 'Pru', 'Reed', 'Silas',
  'Tilly', 'Ugo', 'Vale', 'Wyn', 'Xia', 'Yves', 'Zadie', 'Aster', 'Bo', 'Coco',
  'Dex', 'Edie', 'Fitz', 'Greta', 'Hob', 'Ila', 'Joss', 'Kerry', 'Lou', 'Mott',
  'Nico', 'Opal', 'Percy', 'Rory', 'Sid', 'Tove', 'Ursa', 'Vim', 'Wes', 'Yuki',
  'Zed', 'Ada', 'Bert', 'Cora', 'Dana', 'Enid', 'Fenn', 'Gale', 'Hank', 'Ida',
  'Jude', 'Kemp', 'Lena', 'Mags', 'Ned', 'Ola', 'Pete', 'Ruth', 'Sal', 'Tess',
  'Moe', 'Van', 'Walt', 'Xena', 'Yul', 'Zara', 'Abe', 'Bryn', 'Cal', 'Dara',
  'Eli', 'Flo', 'Glen', 'Hope', 'Isla', 'Jo', 'Kira', 'Liv', 'Mae', 'Nova',
  'Orla', 'Pia', 'Remy', 'Sky', 'Tam', 'Uri', 'Vee', 'Wade', 'Yael', 'Zoe',
  'Ames', 'Bix', 'Cyd', 'Dov', 'Esme', 'Fay', 'Gray', 'Hal', 'Ivo', 'Jules',
]

/** The name this thread's villager goes by. */
export function nameFor(threadId) {
  return VILLAGER_NAMES[hashString(`name:${threadId}`) % VILLAGER_NAMES.length]
}
