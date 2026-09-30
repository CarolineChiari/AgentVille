// Small sprites drawn as text, one string per row and one character per pixel: `.` is clear, and
// every other character is looked up in a legend of palette colours.
import { PixelCanvas } from './pixel.js'

/**
 * @param {string[]} rows   every row the same length
 * @param {Record<string, string>} legend  character → colour
 */
export function fromArt(rows, legend) {
  const w = rows[0].length
  const pc = new PixelCanvas(w, rows.length)
  rows.forEach((row, y) => {
    if (row.length !== w) throw new Error(`Row ${y} is ${row.length} wide, not ${w}: ${row}`)
    for (let x = 0; x < w; x++) {
      const ch = row[x]
      if (ch === '.') continue
      if (!legend[ch]) throw new Error(`No colour for "${ch}" in row ${y}: ${row}`)
      pc.px(x, y, legend[ch])
    }
  })
  return pc
}
