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
