import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import test from 'node:test'

// Node 24 strips TypeScript; resolve the project's bundler-style relative imports.
// No browser hooks, added dependency, or emitted test build is needed.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('.') && context.parentURL?.includes('/src/') && !/\.[cm]?[jt]s(?:\?|$)/.test(specifier)) {
      return nextResolve(`${specifier}.ts`, context)
    }
    return nextResolve(specifier, context)
  },
})
let caseId = 0
const fresh = () => import(`../src/services/mediaSourceService.ts?case=${caseId++}`)
const input = { name: '测试连接', address: 'https://fixture.example.com/dav', username: 'fictional', password: 'fictional-only' }
const settle = async (t, promise, ms) => { t.mock.timers.tick(ms); return promise }

test('reject credential-bearing or non-HTTP endpoints without echoing secrets', async () => {
  const service = await fresh()
  for (const address of ['file:///tmp', 'https://name:secret@example.com/', 'https://example.com/?token=secret', 'https://example.com/#secret', 'invalid']) {
    assert.throws(() => service.validateEndpoint(address), error => !error.message.includes('secret'))
  }
  assert.equal(service.validateEndpoint(input.address), input.address)
})

test('saving a connection does not create roots, tasks or returned credentials; editing preserves roots', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const s = await fresh()
  const previousTasks = s.mediaSourceState.tasks.length
  const id = await settle(t, s.saveSource(input), 250)
  const source = s.mediaSourceState.sources.find(item => item.id === id)
  assert.equal(source.type, 'WebDAV')
  assert.equal(source.lastScan, '尚未扫描')
  assert.equal('password' in source, false)
  assert.equal('username' in source, false)
  assert.equal(s.mediaSourceState.roots.filter(root => root.sourceId === id).length, 0)
  assert.equal(s.mediaSourceState.tasks.length, previousTasks)
  s.addScanRoots(id, ['/TV'])
  await settle(t, s.saveSource({ ...input, name: '编辑名称', password: '' }, id), 250)
  assert.equal(s.mediaSourceState.roots.find(root => root.sourceId === id).path, '/TV')
})

test('directory browsing is read-only; save validates the whole selection and deduplicates', async () => {
  const s = await fresh()
  const before = JSON.stringify(s.mediaSourceState)
  assert.equal(s.browseDirectory('source-new', '/').find(entry => entry.name === 'Movies').kind, 'directory')
  s.browseDirectory('source-new', '/Movies/纪录片')
  assert.equal(JSON.stringify(s.mediaSourceState), before)
  assert.throws(() => s.addScanRoots('source-new', ['/Movies', '/missing']))
  assert.equal(JSON.stringify(s.mediaSourceState), before)
  s.addScanRoots('source-new', ['/Movies', '/Movies', '/TV'])
  assert.equal(s.mediaSourceState.roots.filter(root => root.sourceId === 'source-new').length, 2)
  assert.throws(() => s.setRootEnabled('source-alist', 'root-nas-movies', false))
})

test('scan guards distinguish unavailable sources, no roots and all roots disabled', async () => {
  const s = await fresh()
  for (const id of ['missing', 'source-nextcloud', 'source-new']) assert.throws(() => s.startScan(id))
  s.setRootEnabled('source-ready', 'root-ready', false)
  assert.throws(() => s.startScan('source-ready'))
  const byId = id => s.mediaSourceState.sources.find(source => source.id === id)
  assert.equal(s.scanLabel(byId('source-nextcloud')), '检查连接')
  assert.equal(s.scanLabel(byId('source-new')), '选择扫描目录')
  assert.equal(s.scanLabel(byId('source-ready')), '启用扫描目录')
})

test('one running task per source; snapshot survives disabling/removing roots; completion invents no movies', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const s = await fresh()
  s.setRootEnabled('source-home-nas', 'root-nas-4k', false)
  const id = s.startScan('source-home-nas')
  assert.equal(s.startScan('source-home-nas'), id)
  s.removeScanRoot('source-home-nas', 'root-nas-movies')
  s.addScanRoots('source-home-nas', ['/TV'])
  const task = s.mediaSourceState.tasks.find(item => item.id === id)
  assert.deepEqual(task.rootPaths, ['/Movies'])
  assert.equal(task.status, 'running')
  t.mock.timers.tick(4000)
  assert.equal(task.status, 'completed')
  assert.deepEqual(task.recognizedMovieIds, [])
  assert.deepEqual(task.rootPaths, ['/Movies'])
})

test('removing a source cancels its running task and removes only its configuration', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const s = await fresh()
  s.startScan('source-home-nas')
  s.removeSource('source-home-nas')
  t.mock.timers.tick(4000)
  for (const collection of [s.mediaSourceState.roots, s.mediaSourceState.tasks]) assert.equal(collection.some(item => item.sourceId === 'source-home-nas'), false)
  assert.equal(s.mediaSourceState.sources.length, 4)
})

test('connection loss during execution produces failed state without losing its snapshot', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  // A connected fixture becoming unreachable models a remote outage, without a real request.
  const fixtures = await import('../src/mocks/mediaSources.ts')
  const source = fixtures.mockMediaSources.find(item => item.id === 'source-nextcloud')
  const previous = source.status
  source.status = 'available'
  const s = await fresh()
  source.status = previous
  const id = s.startScan('source-nextcloud')
  await settle(t, s.testSourceConnection('source-nextcloud'), 650)
  t.mock.timers.tick(3350)
  const task = s.mediaSourceState.tasks.find(item => item.id === id)
  assert.equal(task.status, 'failed')
  assert.deepEqual(task.rootPaths, ['/Cinema'])
  assert.ok(task.error)
})
