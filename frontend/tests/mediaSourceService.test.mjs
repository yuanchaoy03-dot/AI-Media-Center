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

test('directory browsing is read-only; save validates the whole selection and rejects duplicates', async () => {
  const s = await fresh()
  const before = JSON.stringify(s.mediaSourceState)
  assert.equal(s.browseDirectory('source-new', '/').find(entry => entry.name === 'Movies').kind, 'directory')
  s.browseDirectory('source-new', '/Movies/纪录片')
  assert.equal(JSON.stringify(s.mediaSourceState), before)
  assert.throws(() => s.addScanRoots('source-new', ['/Movies', '/missing']))
  assert.equal(JSON.stringify(s.mediaSourceState), before)
  assert.throws(() => s.addScanRoots('source-new', ['/Movies', '/Movies', '/TV']))
  assert.equal(JSON.stringify(s.mediaSourceState), before)
  s.addScanRoots('source-new', ['/Movies', '/TV'])
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

const paths = await import('../src/services/scanRootPaths.ts')

test('path relations respect normalization, directory boundaries and root', () => {
  const cases = [
    ['/电影/4K', '/电影/4K', 'same'], ['/电影/', '/电影', 'same'],
    ['/电影', '/电影/4K/Remux', 'ancestor'], ['/电影/4K', '/电影', 'descendant'],
    ['/电影/4K', '/电影/1080P', 'none'], ['/电影', '/电影2', 'none'],
    ['/Movies', '/Movies-old', 'none'], ['/', '/电影', 'ancestor'],
    ['/电影', '/', 'descendant'], ['/', '/', 'same'],
  ]
  for (const [a, b, relation] of cases) assert.equal(paths.getScanRootRelation(a, b), relation)
  assert.equal(paths.normalizeScanRootPath('/电影//4K/'), '/电影/4K')
  for (const path of ['', '  ', '电影', '/电影/../TV', '/./TV']) assert.throws(() => paths.normalizeScanRootPath(path))
  assert.throws(() => paths.validateScanRootPaths(['/电影/', '/电影']))
  assert.equal(paths.sameScanRootSelection(['/TV', '/电影/'], ['/电影', '/TV']), true)
})

test('draft parent replacement includes every descendant and never restores removed children', () => {
  for (const draft of [['/电影/4K'], ['/电影/4K', '/电影/1080P', '/电影/动画']]) {
    assert.deepEqual(paths.findContainedDescendants('/电影', draft), draft)
    assert.deepEqual(paths.replaceDescendantsWithParent(draft, '/电影'), ['/电影'])
  }
  const original = ['/电影/4K', '/电影/动画', '/Movies']
  const replaced = paths.replaceDescendantsWithParent(original, '/电影')
  assert.deepEqual(original, ['/电影/4K', '/电影/动画', '/Movies'])
  assert.deepEqual(replaced, ['/Movies', '/电影'])
  assert.equal(paths.findCoveringAncestor('/电影/4K', replaced), '/电影')
  assert.throws(() => paths.replaceDescendantsWithParent(replaced, '/电影/4K'))
  assert.deepEqual(replaced.filter(path => path !== '/电影'), ['/Movies'])
  assert.deepEqual(paths.replaceDescendantsWithParent(original, '/'), ['/'])
})

test('service rejects duplicates and overlaps regardless of enabled; writes atomically', async () => {
  const s = await fresh()
  s.saveScanRootSelection('source-new', ['/电影/4K'])
  const before = JSON.stringify(s.mediaSourceState)
  for (const candidate of ['/电影/4K', '/电影/4K/', '/电影', '/']) {
    assert.throws(() => s.addScanRoots('source-new', [candidate]), /配置冲突/)
    assert.equal(JSON.stringify(s.mediaSourceState), before)
  }
  s.saveScanRootSelection('source-new', ['/电影'])
  const root = s.mediaSourceState.roots.find(root => root.sourceId === 'source-new')
  s.setRootEnabled('source-new', root.id, false)
  assert.throws(() => s.addScanRoots('source-new', ['/电影/4K']), /配置冲突/)
  const disabled = JSON.stringify(s.mediaSourceState)
  assert.throws(() => s.saveScanRootSelection('source-new', ['/TV', '/missing']))
  assert.throws(() => s.saveScanRootSelection('missing', []))
  assert.equal(JSON.stringify(s.mediaSourceState), disabled)
})

test('selection reconciliation retains id/enabled, removes membership, creates enabled siblings without tasks', async () => {
  const s = await fresh()
  const id = 'source-new'
  s.saveScanRootSelection(id, ['/Movies/电影', '/Movies/动画'])
  const roots = () => s.mediaSourceState.roots.filter(root => root.sourceId === id)
  const [first, second] = roots()
  s.setRootEnabled(id, first.id, false)
  const before = JSON.stringify(s.mediaSourceState)
  // Opening and discarding a detached draft cannot write to persisted state.
  const draft = roots().map(root => paths.normalizeScanRootPath(root.path))
  assert.ok(draft.includes(first.path))
  draft.splice(0, draft.length, '/Movies')
  assert.equal(JSON.stringify(s.mediaSourceState), before)
  s.saveScanRootSelection(id, [second.path, first.path + '/'])
  assert.equal(roots().find(root => root.path === first.path).id, first.id)
  assert.equal(roots().find(root => root.path === first.path).enabled, false)
  const tasks = JSON.stringify(s.mediaSourceState.tasks)
  const others = JSON.stringify(s.mediaSourceState.roots.filter(root => root.sourceId !== id))
  s.saveScanRootSelection(id, [first.path, '/Movies/纪录片'])
  assert.equal(roots().some(root => root.id === second.id), false)
  const added = roots().find(root => root.path === '/Movies/纪录片')
  assert.ok(added.id && added.id !== first.id && added.id !== second.id)
  assert.equal(added.enabled, true)
  assert.equal(JSON.stringify(s.mediaSourceState.tasks), tasks)
  assert.equal(JSON.stringify(s.mediaSourceState.roots.filter(root => root.sourceId !== id)), others)
  s.saveScanRootSelection(id, [])
  assert.deepEqual(roots(), [])
})

test('fixtures are disjoint; corrupted overlap rejects task creation even with a disabled root', async () => {
  const fixtures = await import('../src/mocks/mediaSources.ts')
  for (const source of fixtures.mockMediaSources) paths.validateScanRootPaths(fixtures.mockScanRoots.filter(root => root.sourceId === source.id).map(root => root.path))
  for (const enabled of [true, false]) {
    fixtures.mockScanRoots.push({ id: 'corrupt', sourceId: 'source-alist', path: '/Movies/动画', enabled })
    let s
    try { s = await fresh() } finally { fixtures.mockScanRoots.pop() }
    const before = JSON.stringify(s.mediaSourceState)
    assert.throws(() => s.startScan('source-alist'), /配置冲突/)
    assert.equal(JSON.stringify(s.mediaSourceState), before)
  }
})

test('legal siblings produce a frozen snapshot unaffected by selection reconciliation', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const s = await fresh()
  const siblings = ['/Movies/电影', '/Movies/动画', '/Movies/纪录片']
  s.saveScanRootSelection('source-new', siblings)
  const id = s.startScan('source-new')
  const task = s.mediaSourceState.tasks.find(task => task.id === id)
  assert.deepEqual(task.rootPaths, siblings)
  assert.equal(Object.isFrozen(task.rootPaths), true)
  s.saveScanRootSelection('source-new', ['/Movies'])
  assert.deepEqual(task.rootPaths, siblings)
  t.mock.timers.tick(4000)
})

// Exercise the actual setup state without DOM/browser dependencies.
async function directorySetup(service) {
  const { readFile } = await import('node:fs/promises')
  const { parse, compileScript } = await import('@vue/compiler-sfc')
  const ts = await import('typescript')
  const vue = await import('vue')
  const source = await readFile(new URL('../src/components/media-source/DirectoryBrowser.vue', import.meta.url), 'utf8')
  const { descriptor } = parse(source)
  const script = compileScript(descriptor, { id: 'directory-regression' })
  const code = ts.transpileModule(script.content, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const module = { exports: {} }
  const require = name => {
    if (name === 'vue') return { ...vue, onMounted() {}, onBeforeUnmount() {} }
    if (name.endsWith('/mediaSourceService')) return service
    if (name.endsWith('/scanRootPaths')) return paths
    if (name.endsWith('.vue')) return {}
    throw new Error(`Unexpected import: ${name}`)
  }
  new Function('require', 'module', 'exports', code)(require, module, module.exports)
  const events = []
  const setup = module.exports.default.setup({ sourceId: 'source-new' }, { expose() {}, emit: event => events.push(event) })
  return { setup, events, descriptor }
}

test('DirectoryBrowser actual draft: disabled roots selected, navigation independent, confirmation before replacement', async () => {
  const s = await fresh()
  s.saveScanRootSelection('source-new', ['/Movies/电影', '/Movies/动画', '/Movies/纪录片'])
  const root = s.mediaSourceState.roots.find(root => root.sourceId === 'source-new')
  s.setRootEnabled('source-new', root.id, false)
  const before = JSON.stringify(s.mediaSourceState)
  const { setup: ui } = await directorySetup(s)
  assert.equal(ui.dirty.value, false)
  assert.equal(ui.selectionState(root.path).selected, true)
  assert.equal(ui.selectionState(root.path).text, '已选择 · 已停用')
  assert.equal(ui.selectionState('/Movies').text, '含 3 个已选目录')
  ui.select('/Movies')
  assert.equal(ui.currentPath.value, '/')
  assert.equal(ui.replacement.value.descendants.length, 3)
  assert.equal(ui.draftSelectedPaths.value.length, 3)
  ui.replacement.value = undefined // Cancel replacement.
  assert.equal(ui.dirty.value, false)
  ui.select('/Movies')
  ui.confirmReplacement()
  assert.deepEqual(ui.draftSelectedPaths.value, ['/Movies'])
  assert.equal(ui.selectionState(root.path).ancestor, '/Movies')
  ui.currentPath.value = '/Movies/电影' // Covered directory remains browsable.
  ui.select(root.path)
  assert.deepEqual(ui.draftSelectedPaths.value, ['/Movies'])
  ui.select('/Movies')
  assert.deepEqual(ui.draftSelectedPaths.value, [])
  assert.equal(JSON.stringify(s.mediaSourceState), before) // Discard entire dialog.
})

test('DirectoryBrowser dirty membership and save; root replacement uses explicit confirmation', async () => {
  const s = await fresh()
  const { setup: ui, events } = await directorySetup(s)
  ui.save()
  assert.deepEqual(events, [])
  ui.select('/Movies/电影')
  ui.select('/Movies/动画')
  assert.equal(ui.currentPath.value, '/')
  assert.equal(ui.dirty.value, true)
  ui.select('/')
  assert.match(ui.replacementMessage.value, /全部可见目录.*2 个扫描目录/)
  assert.equal(ui.draftSelectedPaths.value.length, 2)
  ui.confirmReplacement()
  assert.deepEqual(ui.draftSelectedPaths.value, ['/'])
  ui.save()
  assert.deepEqual(events, ['saved'])
  assert.deepEqual(s.mediaSourceState.roots.filter(root => root.sourceId === 'source-new').map(root => root.path), ['/'])
  const { setup: reopened } = await directorySetup(s)
  reopened.select('/')
  reopened.select('/')
  assert.equal(reopened.dirty.value, false)
})

test('DirectoryBrowser template keeps navigation/toggle separate and accessible, with no nested buttons', async () => {
  const { descriptor } = await directorySetup(await fresh())
  const { baseParse } = await import('@vue/compiler-dom')
  const ast = baseParse(descriptor.template.content)
  const buttons = []
  function visit(node, withinButton = false) {
    const button = node.type === 1 && node.tag === 'button'
    if (button) { assert.equal(withinButton, false); buttons.push(node) }
    for (const child of node.children ?? []) visit(child, withinButton || button)
  }
  visit(ast)
  const attr = (node, name) => node.props.find(prop => prop.type === 6 && prop.name === name)?.value?.content
  const directive = (node, name, arg) => node.props.find(prop => prop.type === 7 && prop.name === name && prop.arg?.content === arg)?.exp?.content
  const open = buttons.find(node => attr(node, 'class') === 'directory-open')
  assert.equal(directive(open, 'on', 'click'), 'currentPath = entry.path')
  assert.equal(directive(open, 'bind', 'disabled'), "entry.kind !== 'directory'")
  const selections = buttons.filter(node => attr(node, 'class') === 'directory-select')
  assert.equal(selections.length, 2)
  for (const node of selections) {
    assert.match(directive(node, 'on', 'click'), /^select\(/)
    assert.match(directive(node, 'bind', 'aria-label'), /\.label$/)
    assert.match(directive(node, 'bind', 'disabled'), /ancestor/)
  }
  assert.equal(directive(buttons.find(node => directive(node, 'on', 'click') === 'save'), 'bind', 'disabled'), '!dirty')
  for (const node of buttons.filter(node => node.children.some(child => child.content === '取消'))) assert.equal(directive(node, 'on', 'click'), "emit('close')")
  assert.doesNotMatch(descriptor.template.content, /selected-director|directory-selection/)
  assert.doesNotMatch(descriptor.scriptSetup.content, /window\.confirm|fetch\(|axios/)
})
