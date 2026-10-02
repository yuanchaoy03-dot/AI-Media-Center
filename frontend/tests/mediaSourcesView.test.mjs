import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (
      specifier.startsWith('.') &&
      context.parentURL?.includes('/src/') &&
      !/\.[cm]?[jt]s(?:\?|$)/.test(specifier)
    ) {
      return nextResolve(`${specifier}.ts`, context)
    }
    return nextResolve(specifier, context)
  },
})

const service = await import('../src/services/mediaSourceService.ts')
const { parse, compileScript } = await import('@vue/compiler-sfc')
const ts = await import('typescript')
const vue = await import('vue')
const source = await readFile(
  new URL('../src/views/MediaSourcesPreviewView.vue', import.meta.url),
  'utf8',
)
const { descriptor } = parse(source)
const script = compileScript(descriptor, { id: 'media-sources-regression' })
const code = ts.transpileModule(script.content, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const pushes = []
const module = { exports: {} }
const require = (name) => {
  if (name === 'vue') return { ...vue, onMounted() {} }
  if (name === 'vue-router')
    return {
      useRouter: () => ({
        push: (route) => {
          pushes.push(route)
          return Promise.resolve()
        },
      }),
      RouterLink: {},
    }
  if (name.endsWith('/mediaSourceService')) return service
  if (name.endsWith('/movieService')) return { getLibraryMovies: async () => [] }
  if (name.endsWith('.vue') || name.endsWith('.css')) return {}
  throw new Error(`Unexpected import: ${name}`)
}
new Function('require', 'module', 'exports', code)(require, module, module.exports)
const view = module.exports.default.setup({}, { expose() {} })
const byId = (id) => service.mediaSourceState.sources.find((item) => item.id === id)
const select = (id) => {
  view.menuSource.value = byId(id)
  view.menuTaskId.value = ''
}

test('list scan starts locally for two ready sources and opens the same running task', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  for (const id of ['source-home-nas', 'source-alist']) {
    select(id)
    view.menuAction('scan')
    assert.equal(pushes.length, 0)
    assert.equal(byId(id).lastScan, '扫描中')
    const tasks = service.mediaSourceState.tasks.filter(
      (task) => task.sourceId === id && task.status === 'running',
    )
    assert.equal(tasks.length, 1)
    view.menuSource.value = byId(id)
    view.menuTaskId.value = tasks[0].id // Opened while the task was running.
    t.mock.timers.tick(4000) // The menu click can arrive just after Mock completion.
    const count = service.mediaSourceState.tasks.length
    view.menuAction('scan')
    assert.deepEqual(pushes.pop(), {
      name: 'media-source-detail',
      params: { sourceId: id },
      query: { task: tasks[0].id },
      hash: '#recent-scans',
    })
    assert.equal(service.mediaSourceState.tasks.length, count)
  }
})

test('list scan sends unconfigured and paused sources to folders; connection issues keep their workflow', () => {
  select('source-new')
  view.menuAction('scan')
  assert.deepEqual(pushes.pop(), {
    name: 'media-source-detail',
    params: { sourceId: 'source-new' },
    hash: '#scan-roots',
  })
  service.setRootEnabled('source-ready', 'root-ready', false)
  select('source-ready')
  view.menuAction('scan')
  assert.deepEqual(pushes.pop(), {
    name: 'media-source-detail',
    params: { sourceId: 'source-ready' },
    hash: '#scan-roots',
  })
  assert.equal(
    service.mediaSourceState.roots.find((root) => root.id === 'root-ready').enabled,
    false,
  )
  select('source-nextcloud')
  view.menuAction('scan')
  assert.deepEqual(pushes.pop(), {
    name: 'media-source-detail',
    params: { sourceId: 'source-nextcloud' },
    query: { action: 'scan' },
  })
})

test('Preview explicitly injects Mock test/save and preserves new-source detail navigation', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const input = {
    name: '演示新增来源',
    address: 'https://preview.example.com/dav',
    username: 'synthetic-preview-user',
    password: 'synthetic-preview-password',
  }
  view.openDialog()
  const testing = view.testConnectionInput(input, new AbortController().signal)
  t.mock.timers.tick(850)
  assert.equal(await testing, true)
  const saving = view.savePreviewSource(input, new AbortController().signal)
  t.mock.timers.tick(250)
  const id = await saving
  const added = byId(id)
  assert.equal(added.name, input.name)
  assert.equal(added.lastScan, '尚未扫描')
  assert.equal('password' in added, false)
  assert.equal('username' in added, false)
  view.saved(id)
  assert.equal(view.dialogOpen.value, false)
  assert.deepEqual(pushes.pop(), {
    name: 'media-source-detail',
    params: { sourceId: id },
    query: { created: '1' },
  })
  view.openDialog(added)
  const editing = view.savePreviewSource(
    { ...input, name: '演示编辑来源' },
    new AbortController().signal,
    id,
  )
  t.mock.timers.tick(250)
  assert.equal(await editing, id)
  assert.equal(byId(id).name, '演示编辑来源')
  view.saved(id)
  assert.deepEqual(pushes.pop().query, {})
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(view.savePreviewSource(input, controller.signal), /请求已取消/)
})
