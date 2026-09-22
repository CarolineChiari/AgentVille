import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatText } from '../src/ui/transcript.js'

test('transcript text is escaped before it is formatted', () => {
  const html = formatText('<img src=x onerror=alert(1)> **bold** `code`')
  assert.ok(!html.includes('<img'))
  assert.ok(html.includes('&lt;img'))
  assert.ok(html.includes('<b>bold</b>') && html.includes('<code>code</code>'))
})

test('code fences become preformatted blocks, escaped too', () => {
  const html = formatText('run:\n```sh\necho "<b>"\n```\ndone')
  assert.ok(html.includes('<pre>echo &quot;&lt;b&gt;&quot;</pre>'))
})

test('markdown tables become tables, with their cells escaped', () => {
  const html = formatText('| A | B |\n| --- | --- |\n| 1 | <i>x</i> |')
  assert.ok(html.startsWith('<table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>&lt;i&gt;x&lt;/i&gt;</td></tr></table>'), html)
})

import { nextDelay } from '../src/ui/transcript.js'

test('the panel hurries while the conversation moves and backs off once it stops', () => {
  assert.equal(nextDelay(30_000, { changed: true, live: false }), 2000)
  // A thread the scan cannot see as a live process is still read quickly while its file grows.
  assert.equal(nextDelay(30_000, { changed: true, live: false }), nextDelay(30_000, { changed: false, live: true }))
  let d = nextDelay(0, {})
  const steps = [d]
  for (let i = 0; i < 12; i++) steps.push((d = nextDelay(d, {})))
  assert.ok(steps.every((s, i) => i === 0 || s >= steps[i - 1]), steps.join(' '))
  assert.equal(d, 30_000, 'backs off to the slow poll and stays there')
  assert.equal(nextDelay(d, { changed: true }), 2000, 'and picks up again the moment something changes')
})
