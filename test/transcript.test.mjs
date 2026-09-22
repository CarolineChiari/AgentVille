import { test } from 'node:test'
import assert from 'node:assert/strict'
import { awaitingReply, cleanPrompt, readTranscriptMeta } from '../server/harnesses/claude-code/transcript.mjs'
import { jsonLines } from '../server/lib/fsutil.mjs'
import { assistantRecord, text, toolUse, userRecord } from './helpers/fixtures.mjs'

test('custom title wins over summary and first prompt', () => {
  const m = readTranscriptMeta([
    userRecord('first prompt'),
    { type: 'summary', summary: 'A summary' },
    { type: 'custom-title', customTitle: 'Custom' },
  ])
  assert.equal(m.customTitle, 'Custom')
  assert.equal(m.summary, 'A summary')
  assert.equal(m.firstPrompt, 'first prompt')
})

test('system-reminder wrappers are stripped from previews', () => {
  assert.equal(cleanPrompt('<system-reminder>ignore me</system-reminder> fix the bug'), 'fix the bug')
  assert.equal(cleanPrompt('<ide_selection>x</ide_selection>'), '')
  assert.equal(cleanPrompt('<command-name>/mcp'), '')
})

test('first prompt skips a wrapper-only message and reads array content', () => {
  const m = readTranscriptMeta([
    userRecord('<system-reminder>only this</system-reminder>'),
    userRecord([{ type: 'text', text: 'real question' }]),
  ])
  assert.equal(m.firstPrompt, 'real question')
})

test('sidechain records are ignored', () => {
  const m = readTranscriptMeta([userRecord('from a subagent', { isSidechain: true, cwd: '/elsewhere' }), userRecord('main')])
  assert.equal(m.firstPrompt, 'main')
  assert.equal(m.cwd, '/work/repo')
  assert.equal(awaitingReply([userRecord('hi'), assistantRecord(text('done')), userRecord('sub', { isSidechain: true })]), true)
})

test('HEAD is not a branch', () => {
  const m = readTranscriptMeta([userRecord('a', { gitBranch: 'HEAD' }), userRecord('b', { gitBranch: 'feature' })])
  assert.equal(m.gitBranch, 'feature')
})

test('awaitingReply is true after an end_turn without tool_use', () => {
  assert.equal(awaitingReply([userRecord('hi'), assistantRecord(text('all done'))]), true)
})

test('awaitingReply is false when the last assistant turn called a tool', () => {
  assert.equal(awaitingReply([userRecord('hi'), assistantRecord(toolUse())]), false)
  const stopped = assistantRecord(text('let me check'))
  stopped.message.stop_reason = 'tool_use'
  assert.equal(awaitingReply([stopped]), false)
})

test('awaitingReply is false when a user or tool-result record follows', () => {
  assert.equal(awaitingReply([assistantRecord(text('ok')), userRecord([{ type: 'tool_result', content: 'x' }])]), false)
  assert.equal(awaitingReply([]), false)
})

test('a half-written last line does not throw', () => {
  const records = jsonLines(JSON.stringify(userRecord('hi')) + '\n{"type":"assistant","mess')
  assert.doesNotThrow(() => readTranscriptMeta(records))
  assert.equal(awaitingReply(records), false)
})

import { readableUserText, summarizeTool, transcriptMessages } from '../server/harnesses/claude-code/transcript.mjs'

test('the conversation keeps prompts, replies and one line per tool call', () => {
  const msgs = transcriptMessages([
    userRecord('<system-reminder>noise</system-reminder>Please fix the login bug'),
    { ...assistantRecord([{ type: 'text', text: 'Looking now.' }]), message: { id: 'm1', role: 'assistant', content: [{ type: 'text', text: 'Looking now.' }] } },
    { ...assistantRecord([]), message: { id: 'm1', role: 'assistant', content: [{ type: 'tool_use', name: 'Bash', input: { command: 'npm   test' } }] } },
    userRecord([{ type: 'tool_result', content: 'ok' }]),
    userRecord('from a subagent', { isSidechain: true }),
    { ...assistantRecord([]), message: { id: 'm2', role: 'assistant', content: [{ type: 'text', text: 'Fixed.' }, { type: 'text', text: 'Tests pass.' }] } },
  ])
  assert.deepEqual(msgs.map((m) => m.role), ['user', 'assistant', 'tool', 'assistant'])
  assert.equal(msgs[0].text, 'Please fix the login bug')
  assert.deepEqual([msgs[2].name, msgs[2].detail], ['Bash', 'npm test'])
  assert.equal(msgs[3].text, 'Fixed.\n\nTests pass.')
})

test('reasoning is its own message, stitched across records and named by its record', () => {
  const think = (t, extra = {}) => ({
    ...assistantRecord([]),
    uuid: extra.uuid,
    message: { id: extra.id || 'm1', role: 'assistant', content: [{ type: 'thinking', thinking: t, signature: 'sig' }] },
  })
  const msgs = transcriptMessages([
    userRecord('why is it slow?'),
    think('First, the query.', { uuid: 'u1' }),
    think('Then the index.', { uuid: 'u2' }),
    { ...assistantRecord([]), message: { id: 'm1', role: 'assistant', content: [{ type: 'text', text: 'The index is missing.' }] } },
    { ...assistantRecord([]), uuid: 'u3', message: { id: 'm2', role: 'assistant', content: [{ type: 'redacted_thinking', data: 'xx' }] } },
  ])
  assert.deepEqual(msgs.map((m) => m.role), ['user', 'thinking', 'assistant', 'thinking'])
  // Two records of the one turn's thinking read as one thought, keyed by the first of them.
  assert.equal(msgs[1].text, 'First, the query.\n\nThen the index.')
  assert.equal(msgs[1].key, 'u1')
  assert.equal(msgs[3].text, '(reasoning redacted)')
  assert.equal(msgs.some((m) => 'msgId' in m), false)
})

test('slash commands show as themselves, arguments and all; wrapper-only messages vanish', () => {
  assert.equal(readableUserText('<command-name>/mcp</command-name><command-message>mcp</command-message>'), '/mcp')
  assert.equal(
    readableUserText('<command-message>loop</command-message><command-name>/loop</command-name><command-args>5m /babysit</command-args>'),
    '/loop 5m /babysit',
  )
  assert.equal(readableUserText('<local-command-caveat>x</local-command-caveat>'), '')
})

test('tool lines name MCP tools readably', () => {
  assert.deepEqual(summarizeTool({ name: 'mcp__Claude_Browser__computer', input: { action: 'click' } }), { name: 'Claude Browser · computer', detail: 'click' })
  assert.equal(summarizeTool({ name: 'Edit', input: { file_path: '/a/b.js' } }).detail, '/a/b.js')
})

test('a command comes back whole, line breaks and all, as well as on one line', () => {
  const command = 'cd app \\\n  && npm test -- --grep login'
  const t = summarizeTool({ name: 'Bash', input: { command, description: 'Run the login tests' } })
  assert.equal(t.code, command)
  assert.equal(t.detail, 'cd app \\ && npm test -- --grep login') // still one line, for anything that wants one
  assert.equal(summarizeTool({ name: 'Read', input: { file_path: '/a/b.js' } }).code, undefined)
})

import { pendingQuestion } from '../server/harnesses/claude-code/transcript.mjs'

test('a question or plan approval with no answer is pending; an answered one is not', () => {
  const ask = assistantRecord([{ type: 'tool_use', name: 'AskUserQuestion', input: {} }])
  assert.equal(pendingQuestion([userRecord('go'), ask]), true)
  assert.equal(pendingQuestion([ask, userRecord([{ type: 'tool_result', content: 'Terminal' }])]), false)
  assert.equal(pendingQuestion([assistantRecord([{ type: 'tool_use', name: 'ExitPlanMode', input: {} }])]), true)
  assert.equal(pendingQuestion([assistantRecord(toolUse())]), false)
})

test('task notifications and subagent hand-backs are not shown as the person speaking', () => {
  const note = '<task-notification>\n<task-id>bmuq57mur</task-id>\n<status>stopped</status>\n</task-notification>'
  const msgs = transcriptMessages([
    userRecord('Please fix the login bug', { origin: { kind: 'human' } }),
    userRecord(note, { origin: { kind: 'task-notification' } }),
    userRecord('[Subagent hand-back] report', { origin: { kind: 'peer' } }),
    // An older CLI writes no `origin`; the wrapper alone must still hide it.
    userRecord(note),
  ])
  assert.deepEqual(msgs.map((m) => m.text), ['Please fix the login bug'])
  assert.equal(readTranscriptMeta([userRecord('report', { origin: { kind: 'peer' } }), userRecord('real')]).firstPrompt, 'real')
})
