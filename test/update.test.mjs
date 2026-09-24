import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { assetFor, createUpdater, normalizeAsset, replaceFile } from '../server/update.mjs'
import { tmpHome } from './helpers/fixtures.mjs'

const BUILD = Buffer.from('a new AgentVille')
const sha = (buf) => createHash('sha256').update(buf).digest('hex')
const asset = (name, buf = BUILD, extra = {}) => ({ name, size: buf.length, digest: `sha256:${sha(buf)}`, ...extra })

test('an asset is typed, and one without a digest is no asset at all', () => {
  assert.deepEqual(normalizeAsset(asset('AgentVille-0.55.0-portable.exe')), { name: 'AgentVille-0.55.0-portable.exe', size: BUILD.length, sha256: sha(BUILD) })
  assert.equal(normalizeAsset({ name: 'AgentVille-0.55.0-portable.exe', size: 10 }), null, 'size alone lets a swapped file through')
  assert.equal(normalizeAsset(asset('../evil.exe')), null)
  assert.equal(normalizeAsset(asset('*.exe')), null, 'the name becomes a gh glob: no wildcards')
  assert.equal(normalizeAsset(asset('x.exe', BUILD, { size: 0 })), null)
  assert.equal(normalizeAsset(null), null)
})

test('each kind finds its own build of that version', () => {
  const assets = [
    asset('AgentVille-0.55.0-arm64-mac.zip'),
    asset('AgentVille-0.55.0-portable.exe'),
    asset('AgentVille.Setup.0.55.0.exe'),
    asset('AgentVille-0.54.0-portable.exe'),
  ]
  assert.equal(assetFor(assets, 'portable', '0.55.0').name, 'AgentVille-0.55.0-portable.exe')
  assert.equal(assetFor(assets, 'installer', 'v0.55.0').name, 'AgentVille.Setup.0.55.0.exe')
  assert.equal(assetFor(assets, 'portable', '0.56.0'), null)
  assert.equal(assetFor(assets, 'mac', '0.55.0'), null)
  assert.equal(assetFor(undefined, 'portable', '0.55.0'), null)
})

/** A fake gh: the releases API answers with `assets`, and a download writes `body` where it was asked to. */
function fakeGh(assets, body = BUILD) {
  const calls = []
  const gh = async (args, opts) => {
    calls.push({ args, opts })
    if (args[0] === 'api') return JSON.stringify({ tag_name: 'v0.55.0', assets })
    if (args[0] === 'release' && args[1] === 'download') {
      const dir = args[args.indexOf('--dir') + 1]
      fs.writeFileSync(path.join(dir, args[args.indexOf('--pattern') + 1]), body)
      return ''
    }
    throw new Error(`unexpected gh ${args.join(' ')}`)
  }
  return { gh, calls }
}

test('a copy that has no way to restart says so and fetches nothing', async (t) => {
  const { home, cleanup } = tmpHome()
  t.after(cleanup)
  const { gh, calls } = fakeGh([])
  const u = createUpdater({ dataDir: home, gh })
  assert.equal(u.status().supported, false)
  u.download('0.55.0')
  await u.settle()
  assert.equal(calls.length, 0)
  assert.equal((await u.install()).ok, false)
})

test('the portable build is fetched through gh, checked, and handed over to restart into', async (t) => {
  const { home, cleanup } = tmpHome()
  t.after(cleanup)
  const { gh, calls } = fakeGh([asset('AgentVille-0.55.0-portable.exe'), asset('AgentVille.Setup.0.55.0.exe')])
  const installs = []
  const u = createUpdater({ dataDir: home, kind: 'portable', repo: 'me/app', gh, install: (plan) => (installs.push(plan), { ok: true }) })
  assert.equal((await u.install()).ok, false, 'nothing to restart into yet')
  assert.equal(u.download('0.55.0').state, 'downloading')
  u.download('0.55.0')
  await u.settle()
  assert.deepEqual(calls[0].args, ['api', 'repos/me/app/releases/tags/v0.55.0'])
  assert.deepEqual(calls[1].args, ['release', 'download', 'v0.55.0', '--repo', 'me/app', '--pattern', 'AgentVille-0.55.0-portable.exe', '--dir', u.dir, '--clobber'])
  assert.ok(calls[1].opts.timeoutMs > 60_000, 'a hundred megabytes gets longer than a list does')
  assert.equal(calls.length, 2, 'asking twice while it downloads fetches once')
  assert.deepEqual(u.status(), { supported: true, state: 'ready', version: '0.55.0', error: '' })
  u.download('0.55.0')
  await u.settle()
  assert.equal(calls.length, 2, 'a ready build is not fetched again')
  assert.deepEqual(await u.install(), { ok: true })
  assert.deepEqual(installs, [{ kind: 'portable', file: path.join(u.dir, 'AgentVille-0.55.0-portable.exe'), version: '0.55.0' }])
})

test('a download that is not what GitHub published is thrown away, and only retried when asked', async (t) => {
  const { home, cleanup } = tmpHome()
  t.after(cleanup)
  const { gh, calls } = fakeGh([asset('AgentVille.Setup.0.55.0.exe')], Buffer.from('a tampered AgentVill'))
  const u = createUpdater({ dataDir: home, kind: 'installer', gh, install: () => ({ ok: true }) })
  u.download('0.55.0')
  await u.settle()
  assert.equal(u.status().state, 'failed')
  assert.match(u.status().error, /didn't match/)
  assert.deepEqual(fs.readdirSync(u.dir), [], 'the bad file is gone')
  assert.equal((await u.install()).ok, false)
  u.download('0.55.0')
  await u.settle()
  assert.equal(calls.length, 2, 'a page polling every few seconds does not pull it again')
  u.download('0.55.0', { retry: true })
  await u.settle()
  assert.equal(calls.length, 4)
})

test('a release with no build of this kind fails without downloading anything', async (t) => {
  const { home, cleanup } = tmpHome()
  t.after(cleanup)
  const { gh, calls } = fakeGh([asset('AgentVille-0.55.0-mac.zip')])
  const u = createUpdater({ dataDir: home, kind: 'portable', gh, install: () => ({ ok: true }) })
  u.download('0.55.0')
  await u.settle()
  assert.equal(u.status().state, 'failed')
  assert.equal(calls.length, 1)
  u.download('nightly')
  assert.equal(u.status().version, '0.55.0', 'a version that does not parse is ignored')
})

test('old downloads are cleared, except the one this process runs from', async (t) => {
  const { home, cleanup } = tmpHome()
  t.after(cleanup)
  const u = createUpdater({ dataDir: home, kind: 'portable', gh: async () => '', install: () => ({ ok: true }) })
  await u.cleanup()
  fs.mkdirSync(u.dir, { recursive: true })
  for (const n of ['a.exe', 'b.exe']) fs.writeFileSync(path.join(u.dir, n), 'x')
  await u.cleanup(path.join(u.dir, 'b.exe'))
  assert.deepEqual(fs.readdirSync(u.dir), ['b.exe'])
})

test('the new build replaces the old one in place, waiting while it is still locked', async (t) => {
  const { home, cleanup } = tmpHome()
  t.after(cleanup)
  const source = path.join(home, 'new.exe')
  const target = path.join(home, 'AgentVille.exe')
  fs.writeFileSync(source, 'new')
  fs.writeFileSync(target, 'old')
  assert.equal(await replaceFile(source, target, { tries: 3, waitMs: 1 }), true)
  assert.equal(fs.readFileSync(target, 'utf8'), 'new')
  assert.deepEqual(fs.readdirSync(home).sort(), ['AgentVille.exe', 'new.exe'], 'nothing left beside it')
  // A directory in the way stands in for a file Windows won't let go of: the rename keeps failing.
  const locked = path.join(home, 'locked')
  fs.mkdirSync(path.join(locked, 'inside'), { recursive: true })
  assert.equal(await replaceFile(source, locked, { tries: 3, waitMs: 1 }), false)
  assert.ok(!fs.existsSync(`${locked}.update`), 'a copy that never landed is removed')
  assert.equal(await replaceFile(path.join(home, 'missing.exe'), target, { tries: 1, waitMs: 1 }), false)
})
