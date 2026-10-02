import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import test from 'node:test'
import axios, { AxiosError, CanceledError } from 'axios'
import { createPinia, disposePinia, setActivePinia, storeToRefs } from 'pinia'
import { nextTick } from 'vue'
import * as vue from 'vue'
import { readFile } from 'node:fs/promises'
import { parse, compileScript } from '@vue/compiler-sfc'
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
// Install before http.ts creates its instance. Exercise Axios serialization and
// response transformation; only the transport is replaced, never global fetch.
let respond
const originalAdapter = axios.defaults.adapter
axios.defaults.adapter = async (config) => {
  const result = await respond(axios.getUri(config), {
    ...config,
    body: config.data,
  })
  const response = { ...result, config, headers: {}, statusText: '' }
  if (!config.validateStatus || config.validateStatus(response.status)) return response
  throw new AxiosError(
    'HTTP failure',
    response.status >= 500 ? 'ERR_BAD_RESPONSE' : 'ERR_BAD_REQUEST',
    config,
    undefined,
    response,
  )
}
const { useAuthStore } = await import('../src/stores/auth.ts')
const { pinia } = await import('../src/stores/index.ts')
const auth = useAuthStore(pinia)
const { getOwnedSources, createOwnedSource, testOwnedSourceConnection } =
  await import('../src/services/ownedSourceService.ts')
const { request, ApiError } = await import('../src/services/http.ts')
axios.defaults.adapter = originalAdapter
const user = { id: 'user-a', username: 'alice', role: 'USER' }
const sourceInput = {
  name: '我的 WebDAV',
  address: 'https://dav.example.com/media/',
  username: 'dav-user',
  password: 'synthetic-dav-password',
}
const ownedSource = {
  id: 'owned-source-a',
  name: sourceInput.name,
  type: 'WebDAV',
  address: sourceInput.address,
  enabled: true,
  lastConnectionTestAt: '2026-10-02T06:30:00Z',
  createdAt: '2026-10-02T06:30:00Z',
}
const ok = (data, status = 200) => ({
  data: JSON.stringify({ code: 'OK', message: '', data, requestId: 'test' }),
  status,
})
const failure = (status, code, fieldErrors) => ({
  data: JSON.stringify({ code, message: '测试错误', data: null, requestId: 'test', fieldErrors }),
  status,
})
const deferred = () => {
  let resolve
  const promise = new Promise((r) => {
    resolve = r
  })
  return { promise, resolve }
}
const storageKey = 'personal-cinema.access-token'
const instances = []
function freshStore(token = 'synthetic-test-token') {
  storage.set(storageKey, token)
  const instance = createPinia()
  instances.push(instance)
  return useAuthStore(instance)
}
async function signIn(identity = user) {
  respond = async (path) =>
    path.endsWith('/login')
      ? ok({ accessToken: 'synthetic-test-token', tokenType: 'Bearer', expiresIn: 3600 })
      : ok(identity)
  assert.equal(
    await auth.login(identity.username, 'test-only-password', new AbortController().signal),
    true,
  )
}
test.afterEach(() => {
  auth.logout()
  for (const instance of instances.splice(0)) {
    useAuthStore(instance).logout()
    disposePinia(instance)
  }
  setActivePinia(undefined)
})

test('public credentials omit old bearer token; registration stores no password', async () => {
  await signIn()
  respond = async (path, options) => {
    assert.equal(path, '/api/auth/register')
    assert.equal(options.headers.Authorization, undefined)
    assert.deepEqual(Object.keys(JSON.parse(options.body)), ['username', 'password'])
    return ok(user, 201)
  }
  await auth.register('alice', 'test-only-password', new AbortController().signal)
  assert.deepEqual(auth.takeLoginHint(), { username: 'alice', message: '账号已创建，请登录。' })
  assert.equal(
    [...storage.values()].some((value) => value.includes('password')),
    false,
  )
})

test('refresh verifies identity and loads a real empty list; malformed responses fail', async () => {
  await signIn()
  // 新 Pinia 模拟刷新后的应用：只从 sessionStorage 读 Token，不缓存旧用户。
  const refreshed = freshStore()
  assert.equal(refreshed.user, null)
  respond = async (path, options) => {
    assert.equal(options.headers.Authorization, 'Bearer synthetic-test-token')
    return path.endsWith('/me') ? ok(user) : ok([])
  }
  assert.equal(await refreshed.restoreSession(), true)
  assert.deepEqual(refreshed.user, user)
  assert.deepEqual(await getOwnedSources(new AbortController().signal), [])
  respond = async () => ok([{ id: 'unexpected' }])
  await assert.rejects(getOwnedSources(new AbortController().signal), { code: 'REQUEST_FAILED' })
  respond = async () => ({ data: '<h1>Bad gateway</h1>', status: 502 })
  await assert.rejects(getOwnedSources(new AbortController().signal), { code: 'REQUEST_FAILED' })
  assert.equal(auth.tokenPresent, true)
  refreshed.logout()
})

test('401 and disabled 403 clear identity; 500 and network failures preserve it', async () => {
  for (const [status, code] of [
    [500, 'INTERNAL_ERROR'],
    [400, 'VALIDATION_FAILED'],
    [401, 'INVALID_CREDENTIALS'],
    [403, 'FORBIDDEN'],
    [0, 'REQUEST_FAILED'],
    [401, 'UNAUTHENTICATED'],
    [403, 'ACCOUNT_DISABLED'],
  ]) {
    await signIn()
    respond = async () => {
      if (!status) throw new AxiosError('Network Error', 'ERR_NETWORK')
      return failure(status, code)
    }
    await assert.rejects(getOwnedSources(new AbortController().signal), { code })
    assert.equal(auth.tokenPresent, code !== 'UNAUTHENTICATED' && code !== 'ACCOUNT_DISABLED')
    assert.equal(auth.user !== null, code !== 'UNAUTHENTICATED' && code !== 'ACCOUNT_DISABLED')
  }
})

test('late data and late unauthorized errors cannot refill or log out a new account', async () => {
  for (const late of [ok([]), failure(401, 'UNAUTHENTICATED')]) {
    await signIn()
    const delayed = deferred()
    respond = () => delayed.promise // Deliberately ignores AbortSignal to exercise the epoch check.
    const oldRequest = getOwnedSources(new AbortController().signal)
    auth.logout()
    await signIn({ id: 'user-b', username: 'bob', role: 'USER' })
    delayed.resolve(late)
    await assert.rejects(oldRequest, { code: 'STALE_REQUEST' })
    assert.equal(auth.user.id, 'user-b')
    assert.equal(auth.tokenPresent, true)
  }
})

test('failed identity restoration keeps token for retry and never establishes a user', async () => {
  respond = async (path) =>
    path.endsWith('/login')
      ? ok({ accessToken: 'synthetic', tokenType: 'Bearer', expiresIn: 3600 })
      : failure(500, 'INTERNAL_ERROR')
  assert.equal(await auth.login('alice', 'test-only-password', new AbortController().signal), false)
  assert.equal(auth.user, null)
  assert.equal(auth.tokenPresent, true)
  assert.ok(auth.error)
  respond = async () => ok(user)
  assert.equal(await auth.restoreSession(), true)
})

test('late login after logout cannot install a token', async () => {
  const delayed = deferred()
  respond = () => delayed.promise
  const pending = auth.login('alice', 'test-only-password', new AbortController().signal)
  auth.logout()
  delayed.resolve(ok({ accessToken: 'late', tokenType: 'Bearer', expiresIn: 3600 }))
  assert.equal(await pending, false)
  assert.equal(auth.tokenPresent, false)
  assert.equal(storage.size, 0)
})

test('invalid login remains a form error', async () => {
  respond = async () => failure(401, 'INVALID_CREDENTIALS')
  await assert.rejects(auth.login('alice', 'bad', new AbortController().signal), {
    code: 'INVALID_CREDENTIALS',
  })
  assert.equal(auth.tokenPresent, false)
})

test('login omits old token, then me uses the newly issued bearer', async () => {
  await signIn()
  const calls = []
  respond = async (path, options) => {
    calls.push(path)
    assert.equal(options.timeout, 15000)
    assert.equal(options.withCredentials, false)
    assert.equal(options.headers.Accept, 'application/json')
    if (path === '/api/auth/login') {
      assert.equal(options.method, 'post')
      assert.equal(options.headers.Authorization, undefined)
      assert.equal(options.headers['Content-Type'], 'application/json')
      assert.deepEqual(JSON.parse(options.body), {
        username: 'alice',
        password: 'test-only-password',
      })
      return ok({ accessToken: 'new-synthetic-token', tokenType: 'Bearer', expiresIn: 3600 })
    }
    assert.equal(path, '/api/auth/me')
    assert.equal(options.method, 'get')
    assert.equal(options.body, undefined)
    assert.equal(options.headers.Authorization, 'Bearer new-synthetic-token')
    return ok(user)
  }
  assert.equal(await auth.login('alice', 'test-only-password', new AbortController().signal), true)
  assert.deepEqual(calls, ['/api/auth/login', '/api/auth/me'])
  assert.equal(storage.get('personal-cinema.access-token'), 'new-synthetic-token')
  assert.deepEqual(auth.user, user)
})

test('malformed login data never installs a token', async () => {
  for (const data of [
    null,
    {},
    { accessToken: '', tokenType: 'Bearer', expiresIn: 3600 },
    { accessToken: 'synthetic', tokenType: 'Cookie', expiresIn: 3600 },
    { accessToken: 'synthetic', tokenType: 'Bearer', expiresIn: 60 },
  ]) {
    respond = async () => ok(data)
    await assert.rejects(auth.login('alice', 'test-only-password', new AbortController().signal), {
      code: 'REQUEST_FAILED',
    })
    assert.equal(auth.tokenPresent, false)
    assert.equal(storage.size, 0)
  }
})

test('Axios rejected HTTP responses retain Spring Boot status, code and string field errors', async () => {
  for (const [status, code] of [
    [400, 'VALIDATION_FAILED'],
    [401, 'INVALID_CREDENTIALS'],
    [401, 'UNAUTHENTICATED'],
    [403, 'ACCOUNT_DISABLED'],
    [409, 'USERNAME_TAKEN'],
    [500, 'INTERNAL_ERROR'],
    [501, 'SOURCE_LIST_NOT_READY'],
  ]) {
    respond = async () => failure(status, code, { username: '测试字段错误', ignored: 42 })
    await assert.rejects(request('/auth/register', { body: {} }), (error) => {
      assert.ok(error instanceof ApiError)
      assert.equal(error.status, status)
      assert.equal(error.code, code)
      assert.equal(error.message, '测试错误')
      assert.deepEqual(error.fieldErrors, { username: '测试字段错误' })
      return true
    })
  }
})

test('invalid envelopes and HTML map to the fixed network message', async () => {
  for (const data of [
    '<h1>Bad gateway</h1>',
    '{',
    'null',
    '[]',
    '{}',
    '{"message":"","data":null}',
    '{"code":"OK","data":null}',
    '{"code":"OK","message":""}',
    '{"code":1,"message":"","data":null}',
    '{"code":"OK","message":1,"data":null}',
    '{"code":"NOT_OK","message":"","data":null}',
  ]) {
    for (const status of [200, 502]) {
      // A valid non-OK envelope on an error status remains a business error.
      if (status === 502 && data.includes('NOT_OK')) continue
      respond = async () => ({ status, data })
      await assert.rejects(request('/auth/me'), {
        status: 0,
        code: 'REQUEST_FAILED',
        message: '请求未完成，请检查网络后重试。',
      })
    }
  }
})

test('Axios timeout and network errors preserve the session', async () => {
  await signIn()
  for (const code of ['ECONNABORTED', 'ETIMEDOUT', 'ERR_NETWORK', 'ECONNREFUSED']) {
    respond = async (path, config) => {
      assert.equal(config.timeout, 15000)
      throw new AxiosError('Internal English transport detail', code)
    }
    await assert.rejects(getOwnedSources(new AbortController().signal), {
      status: 0,
      code: 'REQUEST_FAILED',
      message: '请求未完成，请检查网络后重试。',
    })
    assert.equal(auth.tokenPresent, true)
  }
})

test('external cancellation and logout abort the Axios signal and yield stale requests', async () => {
  for (const cancel of ['external', 'logout']) {
    await signIn()
    const external = new AbortController()
    let transportSignal
    respond = (path, { signal }) =>
      new Promise((resolve, reject) => {
        transportSignal = signal
        signal.addEventListener('abort', () => reject(new CanceledError()), { once: true })
      })
    const pending = getOwnedSources(external.signal)
    assert.equal(transportSignal.aborted, false)
    if (cancel === 'external') external.abort()
    else auth.logout()
    assert.equal(transportSignal.aborted, true)
    await assert.rejects(pending, { code: 'STALE_REQUEST' })
    assert.equal(auth.tokenPresent, cancel === 'external')
  }
})

test('pre-aborted requests never reach the adapter; direct request keeps ApiError contract', async () => {
  await signIn()
  respond = () => assert.fail('aborted request reached transport')
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(getOwnedSources(controller.signal), { code: 'STALE_REQUEST' })
  await assert.rejects(request('/auth/me', { signal: controller.signal }), {
    status: 0,
    code: 'REQUEST_FAILED',
  })
  assert.equal(auth.tokenPresent, true)
})

test('Pinia owns all shared auth state and explicit instances work without active Pinia', async () => {
  setActivePinia(undefined)
  assert.equal(useAuthStore(pinia), auth)
  assert.deepEqual(
    Object.keys(pinia.state.value.auth).sort(),
    ['user', 'epoch', 'verifying', 'tokenPresent', 'error', 'notice', 'registeredUsername'].sort(),
  )
  const refs = storeToRefs(auth)
  await signIn()
  assert.equal(refs.user.value.username, 'alice')
  const separate = freshStore()
  assert.equal(separate.user, null)
  assert.equal(separate.tokenPresent, true)
  // 另一个 Pinia 成为 active 后，真实业务 service 仍必须使用应用的共享实例。
  setActivePinia(instances.at(-1))
  respond = async () => ok([])
  assert.deepEqual(await getOwnedSources(new AbortController().signal), [])
  assert.equal(separate.user, null)
  const epoch = refs.epoch.value
  auth.logout()
  await nextTick()
  assert.equal(refs.user.value, null)
  assert.equal(refs.tokenPresent.value, false)
  assert.equal(refs.epoch.value, epoch + 1)
})

test('empty session cannot restore or send protected HTTP', async () => {
  auth.logout()
  respond = () => assert.fail('empty session reached transport')
  assert.equal(await auth.restoreSession(), false)
  assert.equal(auth.verifying, false)
  await assert.rejects(getOwnedSources(new AbortController().signal), { code: 'UNAUTHENTICATED' })
})

test('concurrent restoration reuses one request and a failed attempt can retry', async () => {
  const restored = freshStore()
  let calls = 0
  let delayed = deferred()
  respond = (path, options) => {
    calls++
    assert.equal(path, '/api/auth/me')
    assert.equal(options.headers.Authorization, 'Bearer synthetic-test-token')
    return delayed.promise
  }
  const first = restored.restoreSession()
  const second = restored.restoreSession()
  assert.equal(restored.verifying, true)
  assert.equal(calls, 1)
  delayed.resolve(failure(500, 'INTERNAL_ERROR'))
  assert.deepEqual(await Promise.all([first, second]), [false, false])
  assert.equal(restored.tokenPresent, true)
  assert.equal(restored.verifying, false)
  assert.equal(restored.error, '测试错误')
  delayed = deferred()
  const retry = restored.restoreSession()
  const concurrentRetry = restored.restoreSession()
  assert.equal(calls, 2)
  assert.equal(restored.error, '')
  delayed.resolve(ok(user))
  assert.deepEqual(await Promise.all([retry, concurrentRetry]), [true, true])
  assert.deepEqual(restored.user, user)
  assert.equal(restored.verifying, false)
  assert.equal(await restored.restoreSession(), true)
  assert.equal(calls, 2)
})

test('restoration preserves token on network/protocol errors but clears explicit invalid identity', async () => {
  for (const response of [
    failure(500, 'INTERNAL_ERROR'),
    ok(null),
    ok({ ...user, role: 'OTHER' }),
    { data: '<h1>Bad gateway</h1>', status: 502 },
    null,
    failure(401, 'UNAUTHENTICATED'),
    failure(403, 'ACCOUNT_DISABLED'),
  ]) {
    const restored = freshStore()
    const epoch = restored.epoch
    respond = async () => {
      if (!response) throw new AxiosError('Network Error', 'ERR_NETWORK')
      return response
    }
    assert.equal(await restored.restoreSession(), false)
    const expired = response?.status === 401 || response?.status === 403
    assert.equal(restored.user, null)
    assert.equal(restored.verifying, false)
    assert.equal(restored.tokenPresent, !expired)
    assert.equal(storage.has(storageKey), !expired)
    assert.equal(restored.epoch, epoch + Number(expired))
    if (expired) {
      assert.equal(restored.notice, '测试错误')
      assert.equal(restored.error, '')
    } else assert.ok(restored.error)
  }
})

test('logout clears every auth field and cancels all pending protected requests', async () => {
  await signIn()
  respond = async () => ok(user, 201)
  await auth.register('alice', 'test-only-password', new AbortController().signal)
  auth.error = '旧提示'
  const signals = []
  respond = (path, { signal }) =>
    new Promise((resolve, reject) => {
      signals.push(signal)
      signal.addEventListener('abort', () => reject(new CanceledError()), { once: true })
    })
  const requests = [
    getOwnedSources(new AbortController().signal),
    getOwnedSources(new AbortController().signal),
  ]
  const epoch = auth.epoch
  auth.logout()
  assert.equal(signals.length, 2)
  assert.equal(
    signals.every((signal) => signal.aborted),
    true,
  )
  for (const pending of requests) await assert.rejects(pending, { code: 'STALE_REQUEST' })
  assert.deepEqual(auth.$state, {
    user: null,
    epoch: epoch + 1,
    verifying: false,
    tokenPresent: false,
    error: '',
    notice: '',
    registeredUsername: '',
  })
  assert.equal(storage.size, 0)
})

test('login and registration signals cancel on form exit or logout without installing identity/hints', async () => {
  for (const action of ['login', 'register']) {
    for (const cancel of ['external', 'logout']) {
      const external = new AbortController()
      let transportSignal
      respond = (path, { signal, headers }) =>
        new Promise((resolve, reject) => {
          assert.equal(headers.Authorization, undefined)
          transportSignal = signal
          signal.addEventListener('abort', () => reject(new CanceledError()), { once: true })
        })
      const pending = auth[action]('alice', 'test-only-password', external.signal)
      assert.equal(transportSignal.aborted, false)
      if (cancel === 'external') external.abort()
      else auth.logout()
      assert.equal(transportSignal.aborted, true)
      assert.equal(await pending, false)
      assert.equal(auth.user, null)
      assert.equal(auth.tokenPresent, false)
      assert.equal(auth.registeredUsername, '')
      assert.equal(auth.notice, '')
      assert.equal(storage.size, 0)
    }
  }
})

test('late registration cannot overwrite a new account or its notice', async () => {
  const delayed = deferred()
  let oldSignal
  respond = (path, { signal }) => {
    oldSignal = signal
    return delayed.promise
  }
  const old = auth.register('alice', 'test-only-password', new AbortController().signal)
  await signIn({ id: 'user-b', username: 'bob', role: 'USER' })
  assert.equal(oldSignal.aborted, true)
  delayed.resolve(ok(user, 201))
  assert.equal(await old, false)
  assert.equal(auth.user.username, 'bob')
  assert.equal(auth.registeredUsername, '')
  assert.equal(auth.notice, '')
})

test('old restoration cannot finish or clear the new account restoration', async () => {
  for (const late of [
    ok(user),
    failure(401, 'UNAUTHENTICATED'),
    failure(403, 'ACCOUNT_DISABLED'),
  ]) {
    const restored = freshStore()
    const delayedOld = deferred()
    let oldSignal
    respond = (path, { signal }) => {
      oldSignal = signal
      return delayedOld.promise
    }
    const old = restored.restoreSession()
    const delayedNew = deferred()
    const meStarted = deferred()
    respond = async (path) => {
      if (path.endsWith('/login'))
        return ok({ accessToken: 'bob-token', tokenType: 'Bearer', expiresIn: 3600 })
      meStarted.resolve()
      return delayedNew.promise
    }
    const login = restored.login('bob', 'test-only-password', new AbortController().signal)
    await meStarted.promise
    assert.equal(oldSignal.aborted, true)
    delayedOld.resolve(late)
    assert.equal(await old, false)
    assert.equal(restored.verifying, true)
    assert.equal(restored.user, null)
    assert.equal(restored.error, '')
    assert.equal(restored.notice, '')
    let duplicateCalls = 0
    respond = () => {
      duplicateCalls++
      return ok(user)
    }
    const reused = restored.restoreSession()
    assert.equal(duplicateCalls, 0)
    delayedNew.resolve(ok({ id: 'user-b', username: 'bob', role: 'USER' }))
    assert.deepEqual(await Promise.all([login, reused]), [true, true])
    assert.equal(restored.user.username, 'bob')
    assert.equal(restored.verifying, false)
    assert.equal(storage.get(storageKey), 'bob-token')
  }
})

test('a late public login cannot replace the token of a newer login', async () => {
  const delayed = deferred()
  let oldSignal
  respond = (path, { signal }) => {
    oldSignal = signal
    return delayed.promise
  }
  const old = auth.login('alice', 'test-only-password', new AbortController().signal)
  await signIn({ id: 'user-b', username: 'bob', role: 'USER' })
  assert.equal(oldSignal.aborted, true)
  delayed.resolve(ok({ accessToken: 'alice-token', tokenType: 'Bearer', expiresIn: 3600 }))
  assert.equal(await old, false)
  assert.equal(auth.user.username, 'bob')
  assert.equal(storage.get(storageKey), 'synthetic-test-token')
})

test('registration creates no session, consumes its hint once, and validates the returned user', async () => {
  auth.logout()
  respond = async () => ok(user, 201)
  assert.equal(
    await auth.register('alice', 'test-only-password', new AbortController().signal),
    true,
  )
  assert.equal(auth.user, null)
  assert.equal(auth.tokenPresent, false)
  assert.equal(storage.size, 0)
  assert.deepEqual(auth.takeLoginHint(), { username: 'alice', message: '账号已创建，请登录。' })
  assert.deepEqual(auth.takeLoginHint(), { username: '', message: '' })
  for (const malformed of [
    null,
    {},
    { ...user, id: 1 },
    { ...user, username: null },
    { ...user, role: 'OTHER' },
  ]) {
    respond = async () => ok(malformed, 201)
    await assert.rejects(
      auth.register('alice', 'test-only-password', new AbortController().signal),
      { code: 'REQUEST_FAILED' },
    )
    assert.equal(auth.registeredUsername, '')
    assert.equal(auth.notice, '')
  }
})

// 与现有组件测试一致：执行真实 SFC setup，仅替换 DOM 生命周期和导航。
// auth Store / ownedSourceService / Axios 请求链均保持真实实现。
async function componentSetup(path, props = {}, { preview = false, instance = pinia } = {}) {
  const source = await readFile(new URL(`../src/${path}`, import.meta.url), 'utf8')
  const { descriptor } = parse(source)
  const script = compileScript(descriptor, { id: 'auth-component-regression' })
  const code = ts.transpileModule(script.content, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const routes = []
  const events = []
  const unmounts = []
  let mount
  const require = (name) => {
    if (name === 'vue')
      return {
        ...vue,
        onMounted: (callback) => {
          mount = callback
        },
        onBeforeUnmount: (callback) => unmounts.push(callback),
      }
    if (name === 'vue-router')
      return {
        RouterView: {},
        RouterLink: {},
        useRoute: () => vue.reactive({ fullPath: '/media-sources', meta: {} }),
        useRouter: () => ({
          push: async (route) => {
            routes.push(route)
          },
          replace: async (route) => {
            routes.push(route)
          },
        }),
      }
    if (name.endsWith('/stores/auth')) return { useAuthStore }
    if (name.endsWith('/services/dataMode')) return { mockPreview: preview }
    if (name.endsWith('/services/http')) return { ApiError }
    if (name.endsWith('/services/ownedSourceService'))
      return { getOwnedSources, createOwnedSource, testOwnedSourceConnection }
    if (name === './router') return { signOut: () => auth.logout() }
    if (name.endsWith('.vue') || name.endsWith('.css') || name.endsWith('.svg')) return {}
    throw new Error(`Unexpected import: ${name}`)
  }
  const module = { exports: {} }
  new Function('require', 'module', 'exports', code)(require, module, module.exports)
  const app = vue.createApp({})
  app.use(instance)
  const scope = vue.effectScope()
  const ui = app.runWithContext(() =>
    scope.run(() =>
      module.exports.default.setup(props, {
        expose() {},
        emit: (event, ...args) => events.push([event, ...args]),
      }),
    ),
  )
  return {
    ui,
    routes,
    events,
    mount,
    unmount: () => {
      unmounts.forEach((callback) => callback())
      scope.stop()
    },
  }
}

test('Mock Preview with a stored token keeps auth forms isolated from real identity restoration', async () => {
  const restored = freshStore('preview-retained-token')
  const instance = instances.at(-1)
  const calls = []
  respond = async (path) => {
    calls.push(path)
    return ok(user)
  }
  for (const mode of ['login', 'register']) {
    const form = await componentSetup(
      'components/auth/AuthForm.vue',
      { mode },
      {
        preview: true,
        instance,
      },
    )
    try {
      assert.equal(form.ui.auth, restored)
      await form.ui.retryIdentity()
      assert.deepEqual(calls, [])
      assert.equal(form.ui.needsRestore.value, false)
      assert.equal(restored.user, null)
      assert.equal(restored.verifying, false)
      form.ui.username.value = 'alice'
      form.ui.password.value = 'test-only-password'
      form.ui.confirmation.value = 'test-only-password'
      await form.ui.submit()
      assert.equal(form.ui.message.value, '当前为开发预览，账号服务未启用。')
      assert.deepEqual(form.routes, [])
      assert.deepEqual(calls, [])
      assert.equal(restored.user, null)
      assert.equal(restored.tokenPresent, true)
      assert.equal(storage.get(storageKey), 'preview-retained-token')
    } finally {
      form.unmount()
    }
  }
})

test('normal auth form still restores a valid stored token after a Preview visit', async () => {
  const restored = freshStore('preview-retained-token')
  const instance = instances.at(-1)
  const preview = await componentSetup(
    'components/auth/AuthForm.vue',
    { mode: 'login' },
    {
      preview: true,
      instance,
    },
  )
  preview.unmount()
  const form = await componentSetup('components/auth/AuthForm.vue', { mode: 'login' }, { instance })
  const calls = []
  respond = async (path, options) => {
    calls.push(path)
    assert.equal(options.headers.Authorization, 'Bearer preview-retained-token')
    return ok(user)
  }
  try {
    assert.equal(restored.user, null)
    assert.equal(form.ui.needsRestore.value, true)
    await form.ui.retryIdentity()
    assert.deepEqual(calls, ['/api/auth/me'])
    assert.deepEqual(restored.user, user)
    assert.equal(form.ui.needsRestore.value, false)
    assert.deepEqual(form.routes, [{ name: 'media-sources' }])
    assert.equal(storage.get(storageKey), 'preview-retained-token')
  } finally {
    form.unmount()
  }
})

test('App and AuthForm share Pinia identity; epoch clears shell state and retry uses restored user', async () => {
  const shell = await componentSetup('App.vue')
  const form = await componentSetup('components/auth/AuthForm.vue', { mode: 'login' })
  try {
    assert.equal(shell.ui.auth, auth)
    assert.equal(form.ui.auth, auth)
    shell.ui.searchOpen.value = true
    shell.ui.showNotice('旧账号消息')
    respond = async (path) =>
      path.endsWith('/login')
        ? ok({ accessToken: 'synthetic', tokenType: 'Bearer', expiresIn: 3600 })
        : failure(500, 'INTERNAL_ERROR')
    form.ui.username.value = 'alice'
    form.ui.password.value = 'test-only-password'
    await form.ui.submit()
    assert.equal(form.ui.password.value, '')
    assert.equal(form.ui.needsRestore.value, true)
    assert.deepEqual(form.routes, [])
    assert.equal(shell.ui.searchOpen.value, false)
    assert.equal(shell.ui.notice.value, '')
    respond = async () => ok(user)
    await form.ui.retryIdentity()
    assert.equal(form.ui.needsRestore.value, false)
    assert.deepEqual(form.routes, [{ name: 'media-sources' }])
    assert.equal(shell.ui.auth.user.username, 'alice')
  } finally {
    shell.unmount()
    form.unmount()
  }
})

test('canceled registration cannot navigate the old AuthForm', async () => {
  const form = await componentSetup('components/auth/AuthForm.vue', { mode: 'register' })
  try {
    form.ui.username.value = 'alice'
    form.ui.password.value = 'test-only-password'
    form.ui.confirmation.value = 'test-only-password'
    const delayed = deferred()
    respond = () => delayed.promise
    const submitting = form.ui.submit()
    auth.logout()
    delayed.resolve(ok(user, 201))
    await submitting
    assert.deepEqual(form.routes, [])
    assert.equal(form.ui.password.value, '')
    assert.equal(form.ui.confirmation.value, '')
    assert.equal(auth.notice, '')
  } finally {
    form.unmount()
  }
})

test('real MediaSourcesView keeps loading, error, retry and empty states through Pinia requests', async () => {
  await signIn()
  const view = await componentSetup('views/MediaSourcesView.vue')
  try {
    const delayed = deferred()
    respond = (path, config) => {
      assert.equal(path, '/api/media-sources')
      assert.equal(config.headers.Authorization, 'Bearer synthetic-test-token')
      return delayed.promise
    }
    const loading = view.mount()
    assert.equal(view.ui.status.value, 'loading')
    delayed.resolve(failure(500, 'INTERNAL_ERROR'))
    await loading
    assert.equal(view.ui.status.value, 'error')
    assert.equal(view.ui.error.value, '测试错误')
    assert.equal(auth.tokenPresent, true)
    respond = async () => ok([])
    await view.ui.load()
    assert.equal(view.ui.status.value, 'empty')
    assert.equal(view.ui.error.value, '')
    let signal
    const old = deferred()
    respond = (path, config) => {
      signal = config.signal
      return old.promise
    }
    const pending = view.ui.load()
    view.unmount()
    assert.equal(signal.aborted, true)
    old.resolve(ok([]))
    await pending
    assert.equal(view.ui.status.value, 'loading') // 已卸载页面不能由旧响应回填。
  } finally {
    view.unmount()
  }
})

test('owned WebDAV test/create POST JSON with bearer, and the saved source reloads after refresh', async () => {
  await signIn()
  const calls = []
  respond = async (path, config) => {
    calls.push(path)
    assert.equal(config.headers.Authorization, 'Bearer synthetic-test-token')
    assert.equal(config.method, 'post')
    assert.deepEqual(JSON.parse(config.body), sourceInput)
    return path.endsWith('/test-connection')
      ? ok({ testedAt: ownedSource.lastConnectionTestAt })
      : ok(ownedSource, 201)
  }
  assert.deepEqual(await testOwnedSourceConnection(sourceInput, new AbortController().signal), {
    testedAt: ownedSource.lastConnectionTestAt,
  })
  assert.deepEqual(await createOwnedSource(sourceInput, new AbortController().signal), ownedSource)
  assert.deepEqual(calls, ['/api/media-sources/test-connection', '/api/media-sources'])
  respond = async (path, config) => {
    assert.equal(config.method, 'get')
    assert.equal(config.body, undefined)
    return path.endsWith('/me') ? ok(user) : ok([ownedSource])
  }
  const refreshed = freshStore()
  assert.equal(await refreshed.restoreSession(), true)
  assert.deepEqual(await getOwnedSources(new AbortController().signal), [ownedSource])
  assert.deepEqual([...storage.entries()], [[storageKey, 'synthetic-test-token']])
})

test('owned DTO validation rejects wrong types, credentials, duplicate IDs and invalid UTC times', async () => {
  await signIn()
  for (const malformed of [
    null,
    {},
    { ...ownedSource, enabled: 'true' },
    { ...ownedSource, type: 'SMB' },
    { ...ownedSource, id: '' },
    { ...ownedSource, name: '   ' },
    { ...ownedSource, address: 'https://username:secret@example.com/' },
    { ...ownedSource, lastConnectionTestAt: 'just now' },
    { ...ownedSource, createdAt: '2026-02-31T06:30:00Z' },
    { ...ownedSource, createdAt: '2026-10-02T14:30:00+08:00' },
    { ...ownedSource, password: 'should-not-be-returned' },
    { ...ownedSource, connectionConfig: 'encrypted-should-not-be-returned' },
  ]) {
    respond = async () => ok([malformed])
    await assert.rejects(getOwnedSources(new AbortController().signal), { code: 'REQUEST_FAILED' })
    respond = async () => ok(malformed, 201)
    await assert.rejects(createOwnedSource(sourceInput, new AbortController().signal), {
      code: 'REQUEST_FAILED',
    })
  }
  respond = async () => ok([ownedSource, ownedSource])
  await assert.rejects(getOwnedSources(new AbortController().signal), { code: 'REQUEST_FAILED' })
  respond = async () => ok([{ ...ownedSource, lastConnectionTestAt: null }])
  assert.deepEqual(await getOwnedSources(new AbortController().signal), [
    { ...ownedSource, lastConnectionTestAt: null },
  ])
  respond = async () => ok({ ...ownedSource, lastConnectionTestAt: null }, 201)
  await assert.rejects(createOwnedSource(sourceInput, new AbortController().signal), {
    code: 'REQUEST_FAILED',
  })
  for (const malformed of [
    null,
    {},
    { testedAt: 'now' },
    { testedAt: null },
    { testedAt: ownedSource.createdAt, password: 'secret' },
  ]) {
    respond = async () => ok(malformed)
    await assert.rejects(testOwnedSourceConnection(sourceInput, new AbortController().signal), {
      code: 'REQUEST_FAILED',
    })
  }
  assert.equal(auth.tokenPresent, true)
})

test('test and create POST requests cancel on page exit or logout and ignore late account responses', async () => {
  for (const operation of [testOwnedSourceConnection, createOwnedSource]) {
    for (const cancel of ['external', 'logout']) {
      await signIn()
      const external = new AbortController()
      const delayed = deferred()
      let signal
      respond = (path, config) => {
        signal = config.signal
        return delayed.promise
      }
      const pending = operation(sourceInput, external.signal)
      if (cancel === 'external') external.abort()
      else auth.logout()
      assert.equal(signal.aborted, true)
      await signIn({ id: 'user-b', username: 'bob', role: 'USER' })
      delayed.resolve(
        ok(operation === createOwnedSource ? ownedSource : { testedAt: ownedSource.createdAt }),
      )
      await assert.rejects(pending, { code: 'STALE_REQUEST' })
      assert.equal(auth.user.username, 'bob')
      assert.equal(auth.tokenPresent, true)
    }
  }
})

test('real source page injects real operations, refreshes after save, and keeps unsupported actions local', async () => {
  await signIn()
  const view = await componentSetup('views/MediaSourcesView.vue')
  try {
    respond = async () => ok([])
    await view.mount()
    view.ui.addSource()
    assert.equal(view.ui.dialogOpen.value, true)
    respond = async (path) =>
      path.endsWith('/test-connection')
        ? ok({ testedAt: ownedSource.createdAt })
        : ok(ownedSource, 201)
    assert.equal(await view.ui.testConnection(sourceInput, new AbortController().signal), true)
    assert.equal(
      await view.ui.saveConnection(sourceInput, new AbortController().signal),
      ownedSource.id,
    )
    respond = async () => ok([ownedSource])
    await view.ui.saved()
    assert.equal(view.ui.dialogOpen.value, false)
    assert.equal(view.ui.status.value, 'ready')
    assert.deepEqual(view.ui.sourceList.value, [ownedSource])
    assert.deepEqual(view.routes, [])
    for (const action of ['detail', 'scan', 'edit', 'remove']) {
      view.ui.menuSource.value = ownedSource
      view.ui.unavailable(action)
      assert.equal(view.ui.menuSource.value, undefined)
      assert.match(view.ui.notice.value, /尚未开放/)
      assert.deepEqual(view.routes, [])
    }
    view.ui.addSource()
    auth.logout()
    assert.equal(view.ui.dialogOpen.value, false)
    assert.deepEqual(view.ui.sourceList.value, [])
    assert.equal(view.ui.notice.value, '')
  } finally {
    view.unmount()
  }
})

test('source dialog cancels edited and closed tests, invalidates old success, and clears credentials', async () => {
  let testResult = deferred()
  const signals = []
  const inputs = []
  const dialog = await componentSetup('components/media-source/SourceDialog.vue', {
    testConnection: (input, signal) => {
      inputs.push(input)
      signals.push(signal)
      return testResult.promise
    },
    saveConnection: async () => 'saved-id',
  })
  const ui = dialog.ui
  try {
    ui.form.value = { reportValidity: () => true }
    Object.assign(ui.input, sourceInput)
    const first = ui.test()
    assert.equal(ui.testing.value, true)
    ui.input.address = 'https://changed.example.com/'
    ui.changed()
    assert.equal(signals[0].aborted, true)
    assert.equal(ui.testing.value, false)
    assert.equal(ui.success.value, false)
    assert.equal(inputs[0].address, sourceInput.address)
    testResult.resolve(true)
    await first
    assert.equal(ui.success.value, false)
    assert.match(ui.feedback.value, /重新测试/)
    testResult = deferred()
    const second = ui.test()
    testResult.resolve(true)
    await second
    assert.equal(ui.success.value, true)
    assert.doesNotMatch(ui.feedback.value, /演示/)
    ui.input.password = 'changed-password'
    ui.changed()
    assert.equal(ui.success.value, false)
    await ui.save()
    assert.deepEqual(dialog.events, [])
    testResult = deferred()
    const third = ui.test()
    ui.close()
    assert.equal(signals[2].aborted, true)
    assert.equal(ui.input.password, '')
    assert.equal(ui.input.username, '')
    testResult.resolve(true)
    await third
    assert.equal(ui.success.value, false)
    assert.deepEqual(dialog.events, [['close']])
  } finally {
    dialog.unmount()
  }
})

test('source dialog clears credentials after real save and ignores a POST completing after unmount', async () => {
  await signIn()
  for (const canceled of [false, true]) {
    const dialog = await componentSetup('components/media-source/SourceDialog.vue', {
      testConnection: async (input, signal) => {
        await testOwnedSourceConnection(input, signal)
        return true
      },
      saveConnection: async (input, signal) => (await createOwnedSource(input, signal)).id,
    })
    const ui = dialog.ui
    try {
      ui.form.value = { reportValidity: () => true }
      Object.assign(ui.input, sourceInput)
      respond = async () => ok({ testedAt: ownedSource.createdAt })
      await ui.test()
      const delayed = deferred()
      let transportSignal
      respond = (path, config) => {
        transportSignal = config.signal
        return delayed.promise
      }
      const saving = ui.save()
      assert.equal(ui.saving.value, true)
      if (canceled) {
        dialog.unmount()
        assert.equal(transportSignal.aborted, true)
      }
      delayed.resolve(ok(ownedSource, 201))
      await saving
      assert.equal(ui.input.password, '')
      assert.equal(ui.input.username, '')
      assert.deepEqual(dialog.events, canceled ? [] : [['saved', ownedSource.id]])
    } finally {
      dialog.unmount()
    }
  }
})

test('source dialog retains the explicit preview connection message', async () => {
  const dialog = await componentSetup('components/media-source/SourceDialog.vue', {
    preview: true,
    testConnection: async () => true,
    saveConnection: async () => 'preview-id',
  })
  try {
    dialog.ui.form.value = { reportValidity: () => true }
    Object.assign(dialog.ui.input, sourceInput)
    await dialog.ui.test()
    assert.equal(dialog.ui.success.value, true)
    assert.match(dialog.ui.feedback.value, /连接成功（演示）/)
    await dialog.ui.save()
    assert.deepEqual(dialog.events, [['saved', 'preview-id']])
  } finally {
    dialog.unmount()
  }
})
