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
