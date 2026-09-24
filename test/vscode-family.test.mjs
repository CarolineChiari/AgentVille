import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileUrl, folderUrl } from '../server/harnesses/vscode-family.mjs'

test('a folder link asks for its own window, so it never takes over another project’s', () => {
  assert.equal(folderUrl('vscode', '/Users/me/my app'), 'vscode://file/Users/me/my%20app/?windowId=_blank')
  assert.equal(folderUrl('cursor', 'C:\\code\\app'), 'cursor://file/C:/code/app/?windowId=_blank')
})

test('a file link has no trailing slash and no window of its own: it opens where its folder is', () => {
  assert.equal(fileUrl('vscode', '/Users/me/app/src/a b.js'), 'vscode://file/Users/me/app/src/a%20b.js')
  assert.equal(fileUrl('vscode', 'C:\\code\\app\\x.js'), 'vscode://file/C:/code/app/x.js')
})
