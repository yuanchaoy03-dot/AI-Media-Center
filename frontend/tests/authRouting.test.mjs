import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { registerHooks } from 'node:module'
import test from 'node:test'
import axios, { AxiosError } from 'axios'
import { createPinia, disposePinia, setActivePinia } from 'pinia'
import * as vue from 'vue'
import * as vueRouter from 'vue-router'
import ts from 'typescript'

registerHooks({
  resolve(specifier, context, next) {
    if (
      specifier.startsWith('.') &&
      context.parentURL?.includes('/src/') &&
      !/\.[cm]?[jt]s(?:\?|$)/.test(specifier)
    )
      return next(`${specifier}.ts`, context)
    return next(specifier, context)
  },
})
const storage = new Map()
globalThis.sessionStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key),
}
let respond
const originalAdapter = axios.defaults.adapter
axios.defaults.adapter = async (config) => {
  const result = await respond(axios.getUri(config), config)
  const response = { ...result, config, headers: {}, statusText: '' }
  if (!config.validateStatus || config.validateStatus(response.status)) return response
  throw new AxiosError('HTTP failure', 'ERR_BAD_REQUEST', config, undefined, response)
}
const authModule = await import('../src/stores/auth.ts')
axios.defaults.adapter = originalAdapter
const user = { id: 'user-a', username: 'alice', role: 'USER' }
const ok = (data) => ({ status: 200, data: JSON.stringify({ code: 'OK', message: '', data }) })
const failure = (status, code) => ({
  status,
  data: JSON.stringify({ code, message: '测试错误', data: null }),
})
const deferred = () => {
  let resolve
  const promise = new Promise((r) => {
    resolve = r
  })
  return { promise, resolve }
}
const routerSource = await readFile(new URL('../src/router/index.ts', import.meta.url), 'utf8')
const mainSource = await readFile(new URL('../src/main.ts', import.meta.url), 'utf8')
function compile(source) {
  return ts.transpileModule(source.replace('import.meta.env.BASE_URL', "'/'"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
}
const routers = []
function loadRouter({ token, preview = false } = {}) {
  storage.clear()
  if (token) storage.set('personal-cinema.access-token', token)
  const pinia = createPinia()
  const scope = vue.effectScope()
  const module = { exports: {} }
  // 运行真实路由表、守卫和 watch；仅用 memory history / 空页面替代浏览器环境。
  const require = (name) => {
    if (name === 'vue') return vue
    if (name === 'vue-router')
      return { ...vueRouter, createWebHistory: vueRouter.createMemoryHistory }
    if (name === '../stores/auth') return authModule
    if (name === '../stores/index') return { pinia }
    if (name === '../services/dataMode') return { mockPreview: preview }
    if (name.endsWith('.vue')) return { __esModule: true, default: {} }
    throw new Error(`Unexpected import: ${name}`)
  }
  setActivePinia(undefined)
  scope.run(() =>
    new Function('require', 'module', 'exports', compile(routerSource))(
      require,
      module,
      module.exports,
    ),
  )
  const router = module.exports.default
  const auth = authModule.useAuthStore(pinia)
  routers.push({ router, auth, pinia, scope })
  return { router, auth, pinia, signOut: module.exports.signOut }
}
test.afterEach(() => {
  for (const { router, auth, pinia, scope } of routers.splice(0)) {
    scope.stop()
    auth.logout()
    router.listening = false
    disposePinia(pinia)
  }
  setActivePinia(undefined)
})

test('first protected navigation without token works before app installs Pinia', async () => {
  respond = () => assert.fail('empty session reached auth API')
  const { router, auth } = loadRouter()
  setActivePinia(undefined)
  await router.push('/media-sources')
  assert.equal(router.currentRoute.value.name, 'login')
  assert.equal(auth.user, null)
  assert.equal(auth.tokenPresent, false)
})

test('refreshed protected navigation waits for me; auth pages redirect only after verified identity', async () => {
  const delayed = deferred()
  const started = deferred()
  let calls = 0
  respond = (path, config) => {
    calls++
    assert.equal(path, '/api/auth/me')
    assert.equal(config.headers.Authorization, 'Bearer refreshed-token')
    started.resolve()
    return delayed.promise
  }
  const { router, auth } = loadRouter({ token: 'refreshed-token' })
  assert.equal(auth.user, null)
  setActivePinia(undefined)
  const navigation = router.push('/media-sources')
  await started.promise
  assert.equal(auth.verifying, true)
  assert.notEqual(router.currentRoute.value.name, 'media-sources')
  delayed.resolve(ok(user))
  await navigation
  assert.equal(router.currentRoute.value.name, 'media-sources')
  assert.deepEqual(auth.user, user)
  await router.push('/register')
  assert.equal(router.currentRoute.value.name, 'media-sources')
  assert.equal(calls, 1)
})

test('network failure sends navigation to login with token retained, and retry restores protected access', async () => {
  respond = async () => {
    throw new AxiosError('Network Error', 'ERR_NETWORK')
  }
  const { router, auth } = loadRouter({ token: 'retry-token' })
  await router.push('/media-sources')
  assert.equal(router.currentRoute.value.name, 'login')
  assert.equal(auth.user, null)
  assert.equal(auth.tokenPresent, true)
  assert.ok(auth.error)
  respond = async () => ok(user)
  await router.push('/media-sources')
  assert.equal(router.currentRoute.value.name, 'media-sources')
  assert.deepEqual(auth.user, user)
})

test('invalid identity on refresh clears token and keeps the backend notice on login', async () => {
  for (const [status, code] of [
    [401, 'UNAUTHENTICATED'],
    [403, 'ACCOUNT_DISABLED'],
  ]) {
    respond = async () => failure(status, code)
    const { router, auth } = loadRouter({ token: 'expired-token' })
    await router.push('/media-sources')
    assert.equal(router.currentRoute.value.name, 'login')
    assert.equal(auth.tokenPresent, false)
    assert.equal(auth.user, null)
    assert.equal(auth.notice, '测试错误')
    assert.equal(storage.size, 0)
  }
})

test('epoch watcher redirects an invalidated protected session and signOut clears trusted identity', async () => {
  respond = async () => ok(user)
  const { router, auth, signOut } = loadRouter({ token: 'valid-token' })
  await router.push('/media-sources')
  const navigated = deferred()
  const removeHook = router.afterEach((to, from, failure) => {
    if (!failure && to.name === 'login') navigated.resolve()
  })
  respond = async () => failure(403, 'ACCOUNT_DISABLED')
  await assert.rejects(auth.authenticatedRequest('/media-sources'), { code: 'ACCOUNT_DISABLED' })
  await navigated.promise
  removeHook()
  assert.equal(router.currentRoute.value.name, 'login')
  assert.equal(auth.notice, '测试错误')
  respond = async (path) =>
    path.endsWith('/login')
      ? ok({ accessToken: 'new-token', tokenType: 'Bearer', expiresIn: 3600 })
      : ok(user)
  await auth.login('alice', 'test-only-password', new AbortController().signal)
  await router.push('/media-sources')
  const signedOut = deferred()
  router.afterEach((to, from, failure) => {
    if (!failure && to.name === 'login') signedOut.resolve()
  })
  signOut()
  await signedOut.promise
  assert.equal(router.currentRoute.value.name, 'login')
  assert.equal(auth.user, null)
  assert.equal(auth.tokenPresent, false)
})

test('Mock Preview bypasses auth APIs and keeps preview routes without creating a session', async () => {
  respond = () => assert.fail('Mock Preview reached auth API')
  const { router, auth } = loadRouter({ preview: true })
  for (const path of ['/media-sources', '/library', '/login']) {
    await router.push(path)
    assert.equal(router.currentRoute.value.path, path)
  }
  await router.push('/library')
  auth.logout()
  await vue.nextTick()
  assert.equal(router.currentRoute.value.name, 'library')
  assert.equal(auth.user, null)
  assert.equal(auth.tokenPresent, false)
  assert.equal(storage.size, 0)
})

test('Mock Preview guards preserve a stored token without requesting or restoring real identity', async () => {
  const calls = []
  respond = async (path) => {
    calls.push(path)
    return ok(user)
  }
  const { router, auth } = loadRouter({ token: 'preview-retained-token', preview: true })
  for (const path of ['/media-sources', '/library', '/login', '/register']) {
    await router.push(path)
    assert.equal(router.currentRoute.value.path, path)
  }
  assert.deepEqual(calls, [])
  assert.equal(auth.user, null)
  assert.equal(auth.verifying, false)
  assert.equal(auth.tokenPresent, true)
  assert.equal(storage.get('personal-cinema.access-token'), 'preview-retained-token')
})

test('main installs the shared Pinia before Router and component setup uses that same store', async () => {
  const { router, auth, pinia } = loadRouter()
  const installed = []
  let mounted
  const app = vue.createApp({})
  const realUse = app.use.bind(app)
  app.use = (plugin) => {
    installed.push(plugin)
    return realUse(plugin)
  }
  app.mount = (selector) => {
    mounted = selector
    return app
  }
  const require = (name) => {
    if (name === 'vue') return { ...vue, createApp: () => app }
    if (name === './router') return { __esModule: true, default: router }
    if (name === './stores/index') return { pinia }
    if (name.endsWith('.css') || name.endsWith('.vue')) return {}
    throw new Error(`Unexpected import: ${name}`)
  }
  setActivePinia(undefined)
  const module = { exports: {} }
  new Function('require', 'module', 'exports', compile(mainSource))(require, module, module.exports)
  assert.deepEqual(installed, [pinia, router])
  assert.equal(mounted, '#app')
  assert.equal(
    app.runWithContext(() => authModule.useAuthStore()),
    auth,
  )
})
