import { test } from 'node:test'
import assert from 'node:assert/strict'
import { decodeProjectDir, projectOf, splitWorktree } from '../server/harnesses/claude-code/project.mjs'

test('a worktree thread lands on its parent repo', () => {
  const p = projectOf({ cwd: '/code/app/.claude/worktrees/feat-x', originCwd: '/code/app' })
  assert.deepEqual(p, { project: 'app', projectPath: '/code/app', worktree: 'feat-x', cwd: '/code/app/.claude/worktrees/feat-x' })
})

test('a CLI-only worktree without originCwd still finds the repo', () => {
  const p = projectOf({ cwd: '/code/app/.claude/worktrees/feat-x' })
  assert.equal(p.project, 'app')
  assert.equal(p.projectPath, '/code/app')
})

test('both separators split worktrees', () => {
  assert.deepEqual(splitWorktree('C:\\code\\app\\.claude\\worktrees\\w1'), { root: 'C:\\code\\app', worktree: 'w1' })
  assert.equal(projectOf({ cwd: 'C:\\code\\app' }).project, 'app')
})

test('decodeProjectDir handles mac and Windows encodings', () => {
  assert.equal(decodeProjectDir('-Users-me-Code-app'), '/Users/me/Code/app')
  assert.equal(decodeProjectDir('C--Users-me-app'), 'C:\\Users\\me\\app')
})
