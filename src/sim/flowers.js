// Finished threads become flowers. What kind of flower says what kind of work it was; the colour
// is chance (seeded by the thread id, so it never changes). Pure data — no pixels in here.
import { hashString } from './rng.js'

/**
 * Work types, checked in order: the first whose pattern matches the title or opening prompt wins.
 * Order matters where words overlap ("fix the flaky test" is testing; "memory leak" is performance).
 */
export const WORK = [
  { id: 'review', label: 'code review', re: /\b(review|pr\b|pull request|merge|rebase|conflict|branch|cherry.?pick|handoff)/ },
  { id: 'test', label: 'testing', re: /\b(tests?\b|testing|spec\b|coverage|flaky|e2e|unit test)/ },
  { id: 'perf', label: 'performance', re: /\b(perf|performance|slow|speed|faster|optimi|memory|leak|profil|latency|cach)/ },
  { id: 'fix', label: 'bug fix', re: /\b(fix|bug|error|crash|broken|fail|issue|regress|wrong|stuck|not working|troubleshoot|debug)/ },
  { id: 'docs', label: 'docs', re: /\b(readme|docs?\b|document|write.?up|comments?\b|guide|changelog|notes?\b)/ },
  { id: 'ui', label: 'design & UI', re: /\b(ui\b|ux\b|design|css|styl|layout|button|dropdown|checkbox|dark mode|theme|svg|icon|colou?r|font|animat|menu|page|screen|frontend|responsive|floor plan)/ },
  { id: 'infra', label: 'infrastructure', re: /\b(deploy|ci\b|pipeline|docker|server|azure|aws|cloud|patch|powershell|scripts?\b|install|setup|config|devops|release|upgrade|dependenc|migrat|webpubsub|node \d)/ },
  { id: 'data', label: 'data & APIs', re: /\b(database|db\b|sql|schema|query|csv|dataset|tables?\b|data\b|json|mcp\b|api\b|endpoint)/ },
  { id: 'refactor', label: 'refactor', re: /\b(refactor|clean|rename|reorgani|simplif|tidy|restructur|split|extract|port\b)/ },
  { id: 'feature', label: 'new feature', re: /\b(add|build|implement|create|new\b|feature|support|make|enable|introduce|module|section)/ },
  { id: 'research', label: 'research & planning', re: /\?|\b(why|how|what|investigat|explain|research|plan|idea|explor|look at|understand|question|backlog|brainstorm)/ },
  { id: 'misc', label: 'odds & ends', re: /.^/ },
]
export const WORK_LABEL = Object.fromEntries(WORK.map((w) => [w.id, w.label]))

/**
 * Fifty kinds. `shape` is a drawing recipe the renderer knows; `size` s/m/l, `stem` short/mid/tall
 * and `leaves` 0–2 vary it. Each work type owns a family of related shapes.
 */
export const FLOWER_KINDS = [
  // bug fix — daisies
  { name: 'Daisy', work: 'fix', shape: 'daisy', size: 'm', stem: 'mid', leaves: 2 },
  { name: 'Oxeye Daisy', work: 'fix', shape: 'daisy', size: 'l', stem: 'tall', leaves: 1 },
  { name: 'Chamomile', work: 'fix', shape: 'daisy', size: 's', stem: 'short', leaves: 2 },
  { name: 'Aster', work: 'fix', shape: 'star', size: 'm', stem: 'mid', leaves: 1 },
  { name: 'Marguerite', work: 'fix', shape: 'daisy', size: 'm', stem: 'tall', leaves: 0 },
  // new feature — tulips and irises
  { name: 'Tulip', work: 'feature', shape: 'tulip', size: 'm', stem: 'mid', leaves: 1 },
  { name: 'Parrot Tulip', work: 'feature', shape: 'tulip', size: 'l', stem: 'mid', leaves: 2 },
  { name: 'Crocus', work: 'feature', shape: 'tulip', size: 's', stem: 'short', leaves: 0 },
  { name: 'Iris', work: 'feature', shape: 'lily', size: 'm', stem: 'tall', leaves: 1 },
  { name: 'Freesia', work: 'feature', shape: 'cluster', size: 'm', stem: 'mid', leaves: 1 },
  // refactor — greenery
  { name: 'Fern', work: 'refactor', shape: 'fern', size: 'm', stem: 'mid', leaves: 0 },
  { name: 'Clover', work: 'refactor', shape: 'clover', size: 'm', stem: 'short', leaves: 0 },
  { name: 'Moss Rose', work: 'refactor', shape: 'rose', size: 's', stem: 'short', leaves: 0 },
  { name: 'Sweet Pea', work: 'refactor', shape: 'cluster', size: 's', stem: 'tall', leaves: 2 },
  // docs — spikes
  { name: 'Lavender', work: 'docs', shape: 'spike', size: 'm', stem: 'mid', leaves: 0 },
  { name: 'Foxglove', work: 'docs', shape: 'spike', size: 'l', stem: 'tall', leaves: 1 },
  { name: 'Snapdragon', work: 'docs', shape: 'spike', size: 'm', stem: 'short', leaves: 2 },
  { name: 'Hyacinth', work: 'docs', shape: 'spike', size: 's', stem: 'short', leaves: 1 },
  // testing — small and many
  { name: 'White Clover', work: 'test', shape: 'clover', size: 's', stem: 'short', leaves: 1 },
  { name: 'Forget-me-not', work: 'test', shape: 'cluster', size: 's', stem: 'short', leaves: 1 },
  { name: 'Violet', work: 'test', shape: 'cross', size: 's', stem: 'short', leaves: 1 },
  { name: 'Pansy', work: 'test', shape: 'cross', size: 'm', stem: 'short', leaves: 2 },
  // design & UI — showy
  { name: 'Rose', work: 'ui', shape: 'rose', size: 'm', stem: 'mid', leaves: 2 },
  { name: 'Peony', work: 'ui', shape: 'rose', size: 'l', stem: 'mid', leaves: 1 },
  { name: 'Camellia', work: 'ui', shape: 'rose', size: 's', stem: 'tall', leaves: 0 },
  { name: 'Orchid', work: 'ui', shape: 'lily', size: 'l', stem: 'mid', leaves: 1 },
  { name: 'Poppy', work: 'ui', shape: 'cross', size: 'l', stem: 'tall', leaves: 1 },
  // performance — sunflowers
  { name: 'Sunflower', work: 'perf', shape: 'sunflower', size: 'l', stem: 'tall', leaves: 2 },
  { name: 'Marigold', work: 'perf', shape: 'sunflower', size: 's', stem: 'short', leaves: 1 },
  { name: 'Zinnia', work: 'perf', shape: 'sunflower', size: 'm', stem: 'mid', leaves: 1 },
  // infrastructure — hardy
  { name: 'Cactus Flower', work: 'infra', shape: 'cactus', size: 'm', stem: 'mid', leaves: 0 },
  { name: 'Barrel Cactus', work: 'infra', shape: 'cactus', size: 's', stem: 'short', leaves: 0 },
  { name: 'Thistle', work: 'infra', shape: 'puff', size: 'm', stem: 'mid', leaves: 2 },
  { name: 'Yucca', work: 'infra', shape: 'bell', size: 'l', stem: 'tall', leaves: 2 },
  // data & APIs — bells
  { name: 'Bluebell', work: 'data', shape: 'bell', size: 'm', stem: 'mid', leaves: 1 },
  { name: 'Lily of the Valley', work: 'data', shape: 'bell', size: 's', stem: 'short', leaves: 2 },
  { name: 'Columbine', work: 'data', shape: 'star', size: 's', stem: 'tall', leaves: 1 },
  { name: 'Fuchsia', work: 'data', shape: 'bell', size: 'l', stem: 'mid', leaves: 0 },
  // code review — lilies
  { name: 'Lily', work: 'review', shape: 'lily', size: 'm', stem: 'mid', leaves: 1 },
  { name: 'Lotus', work: 'review', shape: 'lily', size: 'l', stem: 'short', leaves: 0 },
  { name: 'Magnolia', work: 'review', shape: 'tulip', size: 'l', stem: 'tall', leaves: 0 },
  { name: 'Anemone', work: 'review', shape: 'cross', size: 'm', stem: 'mid', leaves: 1 },
  // research & planning — dandelions
  { name: 'Dandelion', work: 'research', shape: 'puff', size: 'm', stem: 'tall', leaves: 1 },
  { name: 'Dandelion Clock', work: 'research', shape: 'puff', size: 'l', stem: 'tall', leaves: 0 },
  { name: 'Buttercup', work: 'research', shape: 'daisy', size: 's', stem: 'mid', leaves: 1 },
  { name: 'Harebell', work: 'research', shape: 'bell', size: 'm', stem: 'tall', leaves: 0 },
  // odds & ends
  { name: 'Wildflower', work: 'misc', shape: 'daisy', size: 's', stem: 'mid', leaves: 1 },
  { name: 'Mushroom', work: 'misc', shape: 'mushroom', size: 'm', stem: 'short', leaves: 0 },
  { name: 'Toadstool', work: 'misc', shape: 'mushroom', size: 'l', stem: 'mid', leaves: 0 },
  { name: 'Cosmos', work: 'misc', shape: 'star', size: 'l', stem: 'tall', leaves: 1 },
]

const KINDS_BY_WORK = {}
FLOWER_KINDS.forEach((k, i) => (KINDS_BY_WORK[k.work] ||= []).push(i))

export function workOf(text) {
  const s = String(text || '').toLowerCase()
  return (WORK.find((w) => w.re.test(s)) || WORK.at(-1)).id
}

/**
 * The flower a finished thread leaves. `color` is a raw hash: the renderer picks the actual
 * colour from its own palette, so the sim never knows about colours.
 */
export function flowerFor(t) {
  const work = workOf(`${t.title || ''} ${t.preview || ''}`)
  const family = KINDS_BY_WORK[work]
  const kind = family[hashString(`flower:${t.id}`) % family.length]
  return { kind, color: hashString(`petal:${t.id}`), work }
}

/**
 * Labels that say what a PR was. `type:` labels are read before `area:` ones, since "chore in
 * the frontend" is a chore first.
 */
const LABEL_WORK = [
  [/bug|fix|defect|regression|hotfix/, 'fix'],
  [/test|qa\b/, 'test'],
  [/perf|performance|speed/, 'perf'],
  [/doc/, 'docs'],
  [/chore|refactor|maintenance|cleanup|tech.?debt/, 'refactor'],
  [/enhancement|feature|feat\b/, 'feature'],
  [/front.?end|\bui\b|\bux\b|design|css|style/, 'ui'],
  [/infra|ci\b|cd\b|deploy|devops|terraform|docker|automation|dependenc|config|build|release/, 'infra'],
  [/back.?end|api|data|database|schema|model/, 'data'],
  [/question|research|spike|discussion|rfc/, 'research'],
]
const SIZE_LABEL = /size\W*(xs|s|m|l|xl)\b/

export function workFromLabels(labels) {
  const sorted = [...labels].map((l) => l.toLowerCase()).sort((a, b) => Number(!a.startsWith('type')) - Number(!b.startsWith('type')))
  for (const l of sorted) {
    if (SIZE_LABEL.test(l) || /^(priority|status)\b/.test(l)) continue
    const hit = LABEL_WORK.find(([re]) => re.test(l))
    if (hit) return hit[1]
  }
  return null
}

export function sizeFromLabels(labels) {
  for (const l of labels) {
    const m = SIZE_LABEL.exec(l.toLowerCase())
    if (m) return m[1] === 'xs' || m[1] === 's' ? 's' : m[1] === 'm' ? 'm' : 'l'
  }
  return null
}

/**
 * The flower a pull request grows. Labels choose the kind (and a size label the bloom's size);
 * without them the title does. An unlabeled PR is always white — the one colour the random
 * palette never uses — so unlabeled work stands out as such.
 * @param {{ title: string, labels: string[] }} pr
 * @param {string} key a stable id, e.g. `pr:owner/repo#12`
 */
export function flowerForPr(pr, key) {
  const labels = pr.labels || []
  const work = workFromLabels(labels) || workOf(pr.title)
  const size = sizeFromLabels(labels)
  let family = KINDS_BY_WORK[work]
  const sized = size && family.filter((i) => FLOWER_KINDS[i].size === size)
  if (sized?.length) family = sized
  const kind = family[hashString(`flower:${key}`) % family.length]
  const white = labels.length === 0
  return { kind, color: hashString(`petal:${key}`), work, white }
}
