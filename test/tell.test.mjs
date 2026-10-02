import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MESSAGE_MAX, REPLY_MAX, canHear, canTell, lastReply, tellPrompt, tellTargets } from '../src/game/tell.js'

const SID = '0f8e2c1a-1b2c-4d3e-8f90-123456789abc'
const thread = (id, f = {}) => ({ id: `claude-code:${id}`, harness: 'claude-code', title: id, project: 'app', lastActivityAt: 0, ref: { cliSessionId: SID }, ...f })

test('only a Claude Code thread the CLI can resume can be told something', () => {
  assert.equal(canHear(thread('a')), true)
  assert.equal(canHear(thread('a', { harness: 'cursor' })), false)
  assert.equal(canHear(thread('a', { archived: true })), false)
  assert.equal(canHear(thread('a', { ref: { desktopSessionId: 'local_x' } })), false, 'desktop only: nothing to resume')
  assert.equal(canHear(thread('a', { ref: { cliSessionId: '../x' } })), false)
  assert.equal(canHear(thread('a', { ref: { cliSessionId: [SID] } })), false)
  assert.equal(canHear(null), false)
  assert.equal(canTell(thread('a', { ref: {} })), true, 'a desktop session can still tell others')
  assert.equal(canTell(thread('a', { harness: 'copilot' })), false)
})

test('targets leave out the sender, put its repo first, then the most recent, and mark the busy', () => {
  const from = thread('me', { project: 'app' })
  const list = tellTargets([
    from,
    thread('old', { project: 'other', lastActivityAt: 1 }),
    thread('new', { project: 'other', lastActivityAt: 9 }),
    thread('mate', { project: 'app', lastActivityAt: 0, running: true }),
    thread('cur', { harness: 'cursor' }),
    null,
  ], from)
  assert.deepEqual(list.map((t) => t.title), ['mate', 'new', 'old'])
  assert.equal(list[0].busy, true)
  assert.equal(list[1].busy, false)
  assert.deepEqual(tellTargets(undefined, from), [])
})

test('the last reply is the last thing the agent said, not a tool call or the person', () => {
  assert.equal(lastReply([{ role: 'assistant', text: 'first' }, { role: 'assistant', text: ' done ' }, { role: 'tool', name: 'Bash' }, { role: 'user', text: 'ok' }]), 'done')
  assert.equal(lastReply([{ role: 'user', text: 'hi' }]), '')
  assert.equal(lastReply(null), '')
})

test('the prompt says who it is about and where, then the message, then the quoted reply', () => {
  const from = thread('Fix login', { project: 'app', gitBranch: 'fix/login', cwd: '/Users/me/app' })
  const p = tellPrompt(from, '  The API changed shape.  ', 'I renamed `user` to\n`account`.')
  assert.equal(p, [
    `Message from me, about another Claude Code session on this machine: “Fix login” (repo app, branch fix/login, working in /Users/me/app), session ${SID}.`,
    '',
    'The API changed shape.',
    '',
    'Its last reply, quoted for context (its words, not mine):',
    '> I renamed `user` to',
    '> `account`.',
  ].join('\n'))
  assert.ok(!tellPrompt(thread('x', { ref: {} }), 'hi').includes(', session '), 'no id to give')
})

test('an empty message is no prompt, and a long one or a long reply is bounded', () => {
  assert.equal(tellPrompt(thread('x'), '   '), '')
  assert.equal(tellPrompt(null, 'hi'), '')
  assert.ok(tellPrompt(thread('x'), 'm'.repeat(MESSAGE_MAX + 50)).includes('m'.repeat(MESSAGE_MAX) + ''))
  assert.ok(!tellPrompt(thread('x'), 'm'.repeat(MESSAGE_MAX + 50)).includes('m'.repeat(MESSAGE_MAX + 1)))
  const p = tellPrompt(thread('x'), 'hi', `${'a'.repeat(REPLY_MAX)}END`)
  assert.ok(p.endsWith('END'), 'the tail of the reply is kept')
  assert.ok(p.includes('> …'))
})
