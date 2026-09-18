// The registry. Adding a harness is one new directory here plus one line in this list.
import claudeCode from './claude-code/index.mjs'

export const HARNESSES = [claudeCode]

export const harnessById = (id, list = HARNESSES) => list.find((h) => h.id === id) || null

/** Detected on every call, so installing a harness while the village is open is noticed on the next poll. */
export async function detectedHarnesses(list = HARNESSES) {
  const flags = await Promise.all(list.map((h) => h.detect().catch(() => false)))
  return list.filter((_, i) => flags[i])
}
