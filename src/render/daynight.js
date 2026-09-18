// How much daylight there is at a given hour: 1 by day, 0 at night, an hour's ramp either side.
const DAWN = 6
const DUSK = 19.5
const RAMP = 1.25

export function dayFactor(hour) {
  const h = ((hour % 24) + 24) % 24
  if (h >= DAWN + RAMP && h <= DUSK - RAMP) return 1
  if (h <= DAWN - RAMP || h >= DUSK + RAMP) return 0
  if (h < 12) return (h - (DAWN - RAMP)) / (2 * RAMP)
  return 1 - (h - (DUSK - RAMP)) / (2 * RAMP)
}

export const hourNow = (d = new Date()) => d.getHours() + d.getMinutes() / 60

export function formatHour(hour) {
  const h = Math.floor(hour) % 24
  const m = Math.floor((hour % 1) * 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
