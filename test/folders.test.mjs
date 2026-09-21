import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { listFolders } from '../server/folders.mjs'
import { tmpHome } from './helpers/fixtures.mjs'

let home, cleanup
before(() => {
  ;({ home, cleanup } = tmpHome())
  for (const d of ['zeta', 'Alpha', 'beta/inner', '.hidden']) fs.mkdirSync(path.join(home, d), { recursive: true })
  fs.writeFileSync(path.join(home, 'notes.txt'), 'x')
  fs.symlinkSync(path.join(home, 'zeta'), path.join(home, 'link'))
})
after(() => cleanup())

test('lists the folders inside, sorted, without files or dot-folders', async () => {
  const r = await listFolders(home)
  assert.equal(r.ok, true)
  assert.deepEqual(r.folders.map((f) => f.name), ['Alpha', 'beta', 'link', 'zeta'])
  assert.equal(r.folders[1].path, path.join(home, 'beta'))
  assert.equal(r.parent, path.dirname(home))
  assert.equal(r.more, false)
})

test('a blank folder means home, and the root has no parent', async () => {
  assert.equal((await listFolders('', { home })).path, home)
  const root = await listFolders(path.parse(home).root)
  assert.equal(root.ok, true)
  assert.equal(root.parent, '')
})

test('refuses relative, missing, non-string and file paths', async () => {
  for (const bad of ['relative', path.join(home, 'nope'), path.join(home, 'notes.txt'), 42, ['/']]) {
    assert.equal((await listFolders(bad, { home })).ok, false, String(bad))
  }
})
