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
const {
  getOwnedSources,
  getOwnedSourceDirectory,
  getOwnedSourceScanRoots,
  saveOwnedSourceScanRoots,
  createOwnedSource,
  testOwnedSourceConnection,
} = await import('../src/services/ownedSourceService.ts')
const scanRootPaths = await import('../src/services/scanRootPaths.ts')
const ownedScanService = await import('../src/services/ownedScanService.ts')
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
const ownedRoots = [
  { id: 'root-a', sourceId: ownedSource.id, path: '/Movies', enabled: false },
  { id: 'root-b', sourceId: ownedSource.id, path: '/TV', enabled: true },
]
const scanTask = {
  id: 'scan-a',
  sourceId: ownedSource.id,
  status: 'pending',
  rootPaths: ['/TV'],
  discoveredCount: 0,
  persistedCount: 0,
  directoryCount: 0,
  errorCode: null,
  errorMessage: null,
  createdAt: '2026-10-03T06:30:00Z',
  startedAt: null,
  finishedAt: null,
}
const mediaResource = {
  id: 'resource-a',
  sourceId: ownedSource.id,
  path: '/TV/Movie.mkv',
  name: 'Movie.mkv',
  size: 1024,
  modifiedAt: '2026-10-03T06:00:00Z',
  recognitionStatus: 'unidentified',
  nameCandidate: { title: 'Movie', year: null, editionLabel: null },
}
const resourcesPage = (items = [mediaResource], page = 0, total = items.length) => ({
  items,
  total,
  page,
  pageSize: 50,
})
const flushRequests = () => new Promise((resolve) => setImmediate(resolve))
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

test('login cancellation during identity verification never reports success to its canceled form', async () => {
  const external = new AbortController()
  const delayed = deferred()
  let identitySignal
  respond = (path, { signal }) => {
    if (path.endsWith('/login'))
      return ok({ accessToken: 'synthetic-test-token', tokenType: 'Bearer', expiresIn: 3600 })
    assert.equal(path, '/api/auth/me')
    identitySignal = signal
    return delayed.promise
  }
  const login = auth.login('alice', 'test-only-password', external.signal)
  await flushRequests()
  assert.equal(auth.verifying, true)
  external.abort()
  // Identity restoration belongs to the current session, even after its form exits.
  assert.equal(identitySignal.aborted, false)
  delayed.resolve(ok(user))
  assert.equal(await login, false)
  assert.deepEqual(auth.user, user)
  assert.equal(auth.verifying, false)
  assert.equal(auth.error, '')
  // POST already issued a valid token; the next page can explicitly verify it again.
  assert.equal(auth.tokenPresent, true)
})

test('canceling a login waiter preserves identity restoration needed by another caller', async () => {
  const external = new AbortController()
  const delayed = deferred()
  let identitySignal
  let identityCalls = 0
  respond = (path, { signal }) => {
    if (path.endsWith('/login'))
      return ok({ accessToken: 'synthetic-test-token', tokenType: 'Bearer', expiresIn: 3600 })
    identityCalls++
    identitySignal = signal
    return delayed.promise
  }
  const login = auth.login('alice', 'test-only-password', external.signal)
  await flushRequests()
  const restoration = auth.restoreSession()
  external.abort()
  assert.equal(identitySignal.aborted, false)
  assert.equal(identityCalls, 1)
  delayed.resolve(ok(user))
  assert.equal(await login, false)
  assert.equal(await restoration, true)
  assert.deepEqual(auth.user, user)
})

test('logout during login verification prevents a late identity from replacing a new account', async () => {
  const delayed = deferred()
  let identitySignal
  respond = (path, { signal }) => {
    if (path.endsWith('/login'))
      return ok({ accessToken: 'synthetic-old-token', tokenType: 'Bearer', expiresIn: 3600 })
    identitySignal = signal
    return delayed.promise
  }
  const login = auth.login('alice', 'test-only-password', new AbortController().signal)
  await flushRequests()
  auth.logout()
  assert.equal(identitySignal.aborted, true)
  const nextUser = { id: 'user-b', username: 'bob', role: 'USER' }
  await signIn(nextUser)
  delayed.resolve(ok(user))
  assert.equal(await login, false)
  assert.deepEqual(auth.user, nextUser)
  assert.equal(auth.tokenPresent, true)
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
      return {
        getOwnedSources,
        getOwnedSourceDirectory,
        getOwnedSourceScanRoots,
        saveOwnedSourceScanRoots,
        createOwnedSource,
        testOwnedSourceConnection,
      }
    if (name.endsWith('/services/scanRootPaths')) return scanRootPaths
    if (name.endsWith('/services/ownedScanService')) return ownedScanService
    if (name === './router') return { signOut: () => auth.logout() }
    if (name.endsWith('.vue') || name.endsWith('.css') || name.endsWith('.svg')) return {}
    throw new Error(`Unexpected import: ${name}`)
  }
  const module = { exports: {} }
  new Function('require', 'module', 'exports', code)(require, module, module.exports)
  const app = vue.createApp({})
  app.use(instance)
  const scope = vue.effectScope()
  const setupProps = vue.reactive(props)
  const ui = app.runWithContext(() =>
    scope.run(() =>
      module.exports.default.setup(setupProps, {
        expose() {},
        emit: (event, ...args) => events.push([event, ...args]),
      }),
    ),
  )
  return {
    ui,
    routes,
    events,
    props: setupProps,
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

test('identity retry never navigates an unmounted form or cancels shared restoration', async () => {
  for (const shared of [false, true]) {
    const restored = freshStore()
    const instance = instances.at(-1)
    const form = await componentSetup(
      'components/auth/AuthForm.vue',
      { mode: 'login' },
      { instance },
    )
    const delayed = deferred()
    let identitySignal
    respond = (path, { signal }) => {
      assert.equal(path, '/api/auth/me')
      identitySignal = signal
      return delayed.promise
    }
    try {
      const retry = form.ui.retryIdentity()
      const restoration = shared ? restored.restoreSession() : undefined
      form.unmount()
      assert.equal(identitySignal.aborted, false)
      delayed.resolve(ok(user))
      await retry
      if (restoration) assert.equal(await restoration, true)
      assert.deepEqual(form.routes, [])
      assert.equal(form.ui.message.value, '')
      assert.deepEqual(restored.user, user)
      await form.ui.retryIdentity()
      assert.deepEqual(form.routes, [])
    } finally {
      form.unmount()
    }
  }
})

test('using another account during login verification leaves the current form clear', async () => {
  const form = await componentSetup('components/auth/AuthForm.vue', { mode: 'login' })
  const delayed = deferred()
  respond = (path) =>
    path.endsWith('/login')
      ? ok({ accessToken: 'synthetic-test-token', tokenType: 'Bearer', expiresIn: 3600 })
      : delayed.promise
  try {
    form.ui.username.value = 'alice'
    form.ui.password.value = 'test-only-password'
    const submitting = form.ui.submit()
    await flushRequests()
    assert.equal(auth.verifying, true)
    form.ui.useAnotherAccount()
    assert.equal(form.ui.message.value, '')
    delayed.resolve(ok(user))
    await submitting
    assert.equal(form.ui.message.value, '')
    assert.equal(form.ui.password.value, '')
    assert.equal(form.ui.pending.value, false)
    assert.deepEqual(form.routes, [])
    assert.equal(auth.user, null)
    assert.equal(auth.tokenPresent, false)
  } finally {
    form.unmount()
  }
})

test('identity retry cannot copy a later session notice after using another account', async () => {
  const restored = freshStore()
  const instance = instances.at(-1)
  const form = await componentSetup('components/auth/AuthForm.vue', { mode: 'login' }, { instance })
  const delayed = deferred()
  respond = () => delayed.promise
  try {
    const retry = form.ui.retryIdentity()
    form.ui.useAnotherAccount()
    restored.notice = '新会话通知'
    delayed.resolve(ok(user))
    await retry
    assert.equal(form.ui.message.value, '')
    assert.equal(restored.notice, '新会话通知')
    assert.deepEqual(form.routes, [])
    assert.equal(restored.user, null)
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

test('owned directory GET encodes each segment once and carries the current bearer only to Spring Boot', async () => {
  await signIn()
  const sourceId = 'source /?#'
  const path = '/电影/中文 空格 &?#%文件夹🎬'
  const directory = {
    path,
    entries: [
      { name: '子目录', path: `${path}/子目录`, kind: 'directory' },
      { name: '电影 (2026).mkv', path: `${path}/电影 (2026).mkv`, kind: 'file' },
    ],
  }
  respond = async (url, config) => {
    assert.equal(
      url,
      `/api/media-sources/${encodeURIComponent(sourceId)}/directory?path=${encodeURIComponent(path)}`,
    )
    assert.equal(config.method, 'get')
    assert.equal(config.body, undefined)
    assert.equal(config.headers.Authorization, 'Bearer synthetic-test-token')
    return ok(directory)
  }
  assert.deepEqual(
    await getOwnedSourceDirectory(sourceId, path, new AbortController().signal),
    directory,
  )
  respond = async () => ok({ path: '/', entries: [] })
  assert.deepEqual(await getOwnedSourceDirectory('source-a', '/', new AbortController().signal), {
    path: '/',
    entries: [],
  })
  assert.deepEqual([...storage.entries()], [[storageKey, 'synthetic-test-token']])
})

test('owned directory rejects malformed, credential-bearing, duplicate and non-direct entries', async () => {
  await signIn()
  const entry = { name: '电影', path: '/Movies/电影', kind: 'directory' }
  const valid = { path: '/Movies', entries: [entry] }
  for (const invalid of [
    null,
    {},
    [],
    { ...valid, password: 'synthetic-secret' },
    { ...valid, path: '/Other' },
    { ...valid, path: '/Movies/' },
    { ...valid, entries: null },
    { ...valid, entries: [entry, entry] },
    { ...valid, entries: [null] },
    { ...valid, entries: [[]] },
    { ...valid, entries: [{ ...entry, name: '' }] },
    { ...valid, entries: [{ ...entry, name: '其他名字' }] },
    { ...valid, entries: [{ ...entry, path: '/Else/电影' }] },
    { ...valid, entries: [{ ...entry, name: '电影/子目录', path: '/Movies/电影/子目录' }] },
    { ...valid, entries: [{ ...entry, path: 'https://dav.example.com/Movies/电影' }] },
    { ...valid, entries: [{ ...entry, kind: 'symlink' }] },
    { ...valid, entries: [{ ...entry, password: 'synthetic-secret' }] },
    {
      ...valid,
      entries: Array.from({ length: 2001 }, (_, index) => ({
        name: `item${index}`,
        path: `/Movies/item${index}`,
        kind: 'file',
      })),
    },
    ...[
      '.',
      '..',
      'back\\slash',
      'encoded%2Fslash',
      'encoded%2Edot',
      'encoded%5Cslash',
      'nested%252fslash',
      'nested%25252edot',
      'nested%25255cslash',
      'a\nb',
      'a\u0080b',
      '\ud800',
      'x'.repeat(2048),
    ].map((name) => ({ ...valid, entries: [{ ...entry, name, path: `/Movies/${name}` }] })),
  ]) {
    respond = async () => ok(invalid)
    await assert.rejects(
      getOwnedSourceDirectory('source-a', '/Movies', new AbortController().signal),
      (error) => {
        assert.equal(error.code, 'REQUEST_FAILED')
        assert.equal(error.message, '目录响应异常，请稍后重试。')
        return true
      },
    )
  }
  respond = () => assert.fail('unsafe directory path reached transport')
  for (const path of [
    '',
    'Movies',
    '//Movies',
    '/Movies/',
    '/Movies//child',
    '/.',
    '/../x',
    '/%2f',
    '/%252f',
    '/%25252e',
    '/%25255c',
  ])
    await assert.rejects(getOwnedSourceDirectory('source-a', path, new AbortController().signal), {
      code: 'REQUEST_FAILED',
    })
  assert.equal(auth.tokenPresent, true)
})

test('real directory workflow opens from its dedicated action, enters folders, retries errors and shows an empty directory', async () => {
  await signIn()
  const view = await componentSetup('views/MediaSourcesView.vue')
  const entries = [
    { name: 'Movies', path: '/Movies', kind: 'directory' },
    { name: 'README.txt', path: '/README.txt', kind: 'file' },
  ]
  const paths = []
  try {
    respond = async () => ok([ownedSource])
    await view.mount()
    respond = async (url) => {
      const path = new URL(url, 'http://localhost').searchParams.get('path')
      paths.push(path)
      return ok({ path, entries: path === '/' ? entries : [] })
    }
    await view.ui.openDirectory(ownedSource)
    assert.equal(view.ui.browsingSource.value.id, ownedSource.id)
    assert.equal(view.ui.directoryPath.value, '/')
    assert.deepEqual(view.ui.directoryEntries.value, entries)
    assert.equal(view.ui.directoryLoading.value, false)
    assert.equal(view.ui.directoryError.value, '')
    await view.ui.loadDirectory('/Movies')
    assert.equal(view.ui.directoryPath.value, '/Movies')
    assert.deepEqual(view.ui.directoryEntries.value, [])
    assert.equal(view.ui.directoryError.value, '')
    respond = async () => failure(502, 'SOURCE_DIRECTORY_FAILED')
    await view.ui.loadDirectory('/')
    assert.equal(view.ui.directoryLoading.value, false)
    assert.equal(view.ui.directoryError.value, '测试错误')
    assert.deepEqual(view.ui.directoryEntries.value, [])
    respond = async () => ok({ path: '/', entries })
    await view.ui.loadDirectory(view.ui.directoryPath.value)
    assert.equal(view.ui.directoryError.value, '')
    assert.deepEqual(view.ui.directoryEntries.value, entries)
    view.ui.closeDirectory()
    assert.equal(view.ui.browsingSource.value, undefined)
    assert.deepEqual(view.routes, [])
    assert.deepEqual(paths, ['/', '/Movies'])
  } finally {
    view.unmount()
  }
})

test('fast directory navigation and source switching cancel and isolate each late response', async () => {
  await signIn()
  const view = await componentSetup('views/MediaSourcesView.vue')
  const old = deferred()
  let oldSignal
  try {
    respond = (url, config) => {
      oldSignal = config.signal
      return old.promise
    }
    const opening = view.ui.openDirectory(ownedSource)
    assert.equal(view.ui.directoryLoading.value, true)
    respond = async () => ok({ path: '/Movies', entries: [] })
    await view.ui.loadDirectory('/Movies')
    assert.equal(oldSignal.aborted, true)
    old.resolve(ok({ path: '/', entries: [{ name: 'stale', path: '/stale', kind: 'directory' }] }))
    await opening
    assert.equal(view.ui.directoryPath.value, '/Movies')
    assert.deepEqual(view.ui.directoryEntries.value, [])
    assert.equal(view.ui.directoryLoading.value, false)

    const delayed = deferred()
    respond = (url, config) => {
      oldSignal = config.signal
      return delayed.promise
    }
    const previousSource = view.ui.openDirectory(ownedSource)
    respond = async () => ok({ path: '/', entries: [] })
    await view.ui.openDirectory({ ...ownedSource, id: 'source-b', name: 'Other source' })
    assert.equal(oldSignal.aborted, true)
    delayed.resolve(failure(502, 'SOURCE_DIRECTORY_FAILED'))
    await previousSource
    assert.equal(view.ui.browsingSource.value.id, 'source-b')
    assert.equal(view.ui.directoryError.value, '')
    assert.deepEqual(view.ui.directoryEntries.value, [])
  } finally {
    view.unmount()
  }
})

test('closing, unmounting and switching accounts cancel directory HTTP and clear private entries', async () => {
  for (const cancel of ['close', 'unmount', 'account']) {
    await signIn()
    const view = await componentSetup('views/MediaSourcesView.vue')
    try {
      respond = async () => ok([ownedSource])
      await view.mount()
      respond = async () => ok({ path: '/', entries: [{ name: 'a', path: '/a', kind: 'file' }] })
      await view.ui.openDirectory(ownedSource)
      const delayed = deferred()
      let signal
      respond = (url, config) => {
        signal = config.signal
        return delayed.promise
      }
      const pending = view.ui.loadDirectory('/Movies')
      assert.deepEqual(view.ui.directoryEntries.value, [])
      if (cancel === 'close') view.ui.closeDirectory()
      else if (cancel === 'unmount') view.unmount()
      else {
        auth.logout()
        await signIn({ id: 'user-b', username: 'bob', role: 'USER' })
      }
      assert.equal(signal.aborted, true)
      delayed.resolve(failure(401, 'UNAUTHENTICATED'))
      await pending
      assert.equal(view.ui.browsingSource.value, undefined)
      assert.deepEqual(view.ui.directoryEntries.value, [])
      assert.equal(view.ui.directoryPath.value, '/')
      assert.equal(view.ui.directoryError.value, '')
      assert.equal(view.ui.directoryLoading.value, false)
      assert.equal(auth.user.username, cancel === 'account' ? 'bob' : 'alice')
      assert.equal(auth.tokenPresent, true)
    } finally {
      view.unmount()
    }
  }
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
    for (const action of ['detail', 'edit', 'remove']) {
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

test('owned scan roots use authenticated GET and explicit PUT JSON without caching across reads', async () => {
  await signIn()
  const sourceId = 'source /?#'
  const path = '/电影/中文 空格 &?#%文件夹🎬'
  const roots = [{ id: 'root-special', sourceId, path, enabled: false }]
  const calls = []
  respond = async (url, config) => {
    calls.push(config.method)
    assert.equal(url, `/api/media-sources/${encodeURIComponent(sourceId)}/scan-roots`)
    assert.equal(config.headers.Authorization, 'Bearer synthetic-test-token')
    if (config.method === 'put') {
      assert.equal(config.headers['Content-Type'], 'application/json')
      assert.deepEqual(JSON.parse(config.body), { paths: [path] })
    } else {
      assert.equal(config.method, 'get')
      assert.equal(config.body, undefined)
    }
    return ok(roots)
  }
  assert.deepEqual(
    await saveOwnedSourceScanRoots(sourceId, [path], new AbortController().signal),
    roots,
  )
  assert.deepEqual(await getOwnedSourceScanRoots(sourceId, new AbortController().signal), roots)
  assert.deepEqual(calls, ['put', 'get'])
  respond = async (url, config) => {
    assert.equal(config.method, 'get')
    return ok([])
  }
  assert.deepEqual(await getOwnedSourceScanRoots(sourceId, new AbortController().signal), [])
  respond = async (url, config) => {
    assert.equal(config.method, 'put')
    assert.deepEqual(JSON.parse(config.body), { paths: [] })
    return ok([])
  }
  assert.deepEqual(await saveOwnedSourceScanRoots(sourceId, [], new AbortController().signal), [])
  assert.deepEqual([...storage.entries()], [[storageKey, 'synthetic-test-token']])
})

test('scan root responses reject wrong ownership, unsafe paths, duplicate IDs and overlapping ranges', async () => {
  await signIn()
  const first = ownedRoots[0]
  const operations = [
    () => getOwnedSourceScanRoots(ownedSource.id, new AbortController().signal),
    () => saveOwnedSourceScanRoots(ownedSource.id, ['/Movies'], new AbortController().signal),
  ]
  const invalidResponses = [
    null,
    {},
    [null],
    [[]],
    [{ ...first, id: '' }],
    [{ ...first, id: ' ' }],
    [{ ...first, sourceId: 'another-owner-source' }],
    [{ ...first, sourceId: undefined }],
    [{ ...first, enabled: 'true' }],
    [{ ...first, password: 'synthetic-secret' }],
    [first, first],
    [first, { ...first, id: 'different-id' }],
    [first, { ...first, id: 'child', path: '/Movies/child', enabled: true }],
    [first, { ...first, id: 'parent', path: '/', enabled: false }],
    Array.from({ length: 33 }, (_, index) => ({
      ...first,
      id: `id-${index}`,
      path: `/root-${index}`,
    })),
    ...[
      '',
      'Movies',
      '/Movies/',
      '//Movies',
      '/Movies//child',
      '/Movies/../TV',
      '/Movies/./child',
      '/back\\slash',
      '/%2f',
      '/%252f',
      '/%25252e',
      '/%25255c',
      '/a\nb',
      '/a\u0080b',
      '/\ud800',
      `/${'x'.repeat(2048)}`,
    ].map((path) => [{ ...first, path }]),
  ]
  for (const response of invalidResponses) {
    respond = async () => ok(response)
    for (const operation of operations)
      await assert.rejects(operation(), (error) => {
        assert.equal(error.code, 'REQUEST_FAILED')
        assert.equal(error.message.includes('synthetic-secret'), false)
        return true
      })
  }
  respond = async () => ok(ownedRoots)
  assert.deepEqual(
    await getOwnedSourceScanRoots(ownedSource.id, new AbortController().signal),
    ownedRoots,
  )
  assert.equal(auth.tokenPresent, true)
})

test('invalid root selections never reach transport and mismatched successful saves are rejected', async () => {
  await signIn()
  respond = () => assert.fail('invalid selection reached HTTP')
  for (const paths of [
    ['/Movies', '/Movies'],
    ['/Movies', '/Movies/child'],
    ['/Movies/child', '/Movies'],
    ['/', '/Movies'],
    ['/Movies/'],
    ['/../Movies'],
    ['Movies'],
    ['/%25252e'],
    Array.from({ length: 33 }, (_, index) => `/root-${index}`),
  ])
    await assert.rejects(
      saveOwnedSourceScanRoots(ownedSource.id, paths, new AbortController().signal),
      { code: 'VALIDATION_FAILED' },
    )
  await assert.rejects(getOwnedSourceScanRoots(' ', new AbortController().signal), {
    code: 'REQUEST_FAILED',
  })
  await assert.rejects(saveOwnedSourceScanRoots('', [], new AbortController().signal), {
    code: 'REQUEST_FAILED',
  })
  respond = async () => ok([ownedRoots[0]])
  await assert.rejects(
    saveOwnedSourceScanRoots(ownedSource.id, ['/TV'], new AbortController().signal),
    { code: 'REQUEST_FAILED' },
  )
  respond = async () => ok([])
  await assert.rejects(
    saveOwnedSourceScanRoots(ownedSource.id, ['/Movies'], new AbortController().signal),
    { code: 'REQUEST_FAILED' },
  )
  assert.equal(auth.tokenPresent, true)
})

test('scan root GET and PUT retain backend failures and clear identity only on session invalidation', async () => {
  for (const operation of [
    () => getOwnedSourceScanRoots(ownedSource.id, new AbortController().signal),
    () => saveOwnedSourceScanRoots(ownedSource.id, ['/Movies'], new AbortController().signal),
  ]) {
    for (const [status, code] of [
      [401, 'UNAUTHENTICATED'],
      [403, 'ACCOUNT_DISABLED'],
      [403, 'FORBIDDEN'],
      [404, 'SOURCE_NOT_FOUND'],
      [409, 'SCAN_ROOT_CONFLICT'],
      [502, 'SOURCE_DIRECTORY_FAILED'],
    ]) {
      await signIn()
      respond = async () => failure(status, code)
      await assert.rejects(operation(), { status, code, message: '测试错误' })
      assert.equal(auth.tokenPresent, !['UNAUTHENTICATED', 'ACCOUNT_DISABLED'].includes(code))
    }
  }
})

test('scan root GET and PUT cancel on exit or account change and ignore late success or unauthorized data', async () => {
  for (const operation of [
    (signal) => getOwnedSourceScanRoots(ownedSource.id, signal),
    (signal) => saveOwnedSourceScanRoots(ownedSource.id, ['/Movies', '/TV'], signal),
  ]) {
    for (const cancel of ['external', 'account']) {
      for (const late of [ok(ownedRoots), failure(401, 'UNAUTHENTICATED')]) {
        await signIn()
        const external = new AbortController()
        const delayed = deferred()
        let signal
        respond = (url, config) => {
          signal = config.signal
          return delayed.promise
        }
        const pending = operation(external.signal)
        if (cancel === 'external') external.abort()
        else auth.logout()
        assert.equal(signal.aborted, true)
        await signIn({ id: 'user-b', username: 'bob', role: 'USER' })
        delayed.resolve(late)
        await assert.rejects(pending, { code: 'STALE_REQUEST' })
        assert.equal(auth.user.id, 'user-b')
        assert.equal(auth.tokenPresent, true)
      }
    }
  }
})

const realSelectionProps = (sourceId = ownedSource.id) => ({
  sourceId,
  loadRoots: getOwnedSourceScanRoots,
  loadDirectory: async (id, path, signal) =>
    (await getOwnedSourceDirectory(id, path, signal)).entries,
  saveRoots: saveOwnedSourceScanRoots,
})
const selectionDirectory = (url) => {
  const path = new URL(url, 'http://localhost').searchParams.get('path')
  return ok({
    path,
    entries:
      path === '/'
        ? [
            { name: 'Movies', path: '/Movies', kind: 'directory' },
            { name: 'TV', path: '/TV', kind: 'directory' },
            { name: 'README.txt', path: '/README.txt', kind: 'file' },
          ]
        : [],
  })
}

test('real directory selection discards drafts, retries failed PUT and rereads saved IDs and paused roots', async () => {
  await signIn()
  let persisted = [ownedRoots[0]]
  let failSave = false
  const calls = []
  respond = async (url, config) => {
    calls.push(
      config.method === 'put' ? 'save' : url.endsWith('/scan-roots') ? 'roots' : 'directory',
    )
    if (!url.endsWith('/scan-roots')) return selectionDirectory(url)
    if (config.method === 'put') {
      if (failSave)
        return failure(502, 'SOURCE_DIRECTORY_FAILED', { paths: '文件夹暂时无法读取。' })
      persisted = JSON.parse(config.body).paths.map(
        (path, index) =>
          persisted.find((root) => root.path === path) ?? {
            id: `created-${index}`,
            sourceId: ownedSource.id,
            path,
            enabled: true,
          },
      )
    }
    return ok(persisted)
  }
  const discarded = await componentSetup(
    'components/media-source/DirectorySelection.vue',
    realSelectionProps(),
  )
  try {
    await discarded.mount()
    assert.equal(discarded.ui.selectionState('/Movies').text, '扫描已暂停')
    discarded.ui.select('/TV')
    assert.equal(discarded.ui.dirty.value, true)
    discarded.ui.close()
    assert.deepEqual(discarded.events, [['loaded', [ownedRoots[0]], ownedSource.id], ['close']])
    assert.deepEqual(persisted, [ownedRoots[0]])
    assert.equal(calls.includes('save'), false)
  } finally {
    discarded.unmount()
  }
  const dialog = await componentSetup(
    'components/media-source/DirectorySelection.vue',
    realSelectionProps(),
  )
  try {
    await dialog.mount()
    assert.deepEqual(dialog.ui.draftSelectedPaths.value, ['/Movies'])
    dialog.ui.select('/TV')
    failSave = true
    await dialog.ui.save()
    assert.equal(dialog.ui.error.value, '文件夹暂时无法读取。')
    assert.equal(dialog.ui.saving.value, false)
    assert.equal(dialog.ui.dirty.value, true)
    assert.deepEqual(dialog.ui.draftSelectedPaths.value, ['/Movies', '/TV'])
    assert.deepEqual(dialog.ui.initialSelectedPaths.value, ['/Movies'])
    assert.deepEqual(dialog.events, [['loaded', [ownedRoots[0]], ownedSource.id]])
    assert.deepEqual(persisted, [ownedRoots[0]])
    failSave = false
    await dialog.ui.save()
    assert.equal(dialog.ui.error.value, '')
    assert.equal(dialog.ui.dirty.value, false)
    assert.deepEqual(dialog.events.at(-1), ['saved', persisted, ownedSource.id])
    assert.equal(persisted[0].id, ownedRoots[0].id)
    assert.equal(persisted[0].enabled, false)
    assert.equal(persisted[1].enabled, true)
  } finally {
    dialog.unmount()
  }
  const refreshed = await componentSetup(
    'components/media-source/DirectorySelection.vue',
    realSelectionProps(),
  )
  try {
    await refreshed.mount()
    assert.deepEqual(refreshed.ui.roots.value, persisted)
    assert.deepEqual(refreshed.ui.draftSelectedPaths.value, ['/Movies', '/TV'])
    assert.deepEqual(calls.slice(-2), ['roots', 'directory'])
    refreshed.ui.select('/Movies')
    refreshed.ui.select('/TV')
    await refreshed.ui.save()
    assert.deepEqual(persisted, [])
    assert.deepEqual(refreshed.events.at(-1), ['saved', [], ownedSource.id])
    assert.deepEqual([...storage.entries()], [[storageKey, 'synthetic-test-token']])
  } finally {
    refreshed.unmount()
  }
})

test('directory selection retries root and browse failures without losing or prematurely saving the draft', async () => {
  await signIn()
  let rootFailure = true
  let directoryFailure = false
  const calls = []
  respond = async (url, config) => {
    calls.push(url)
    assert.equal(config.method, 'get')
    if (url.endsWith('/scan-roots'))
      return rootFailure ? failure(500, 'INTERNAL_ERROR') : ok(ownedRoots)
    return directoryFailure ? failure(502, 'SOURCE_DIRECTORY_FAILED') : selectionDirectory(url)
  }
  const dialog = await componentSetup(
    'components/media-source/DirectorySelection.vue',
    realSelectionProps(),
  )
  try {
    await dialog.mount()
    assert.equal(dialog.ui.initialized.value, false)
    assert.equal(dialog.ui.loading.value, false)
    assert.equal(dialog.ui.directoryError.value, '测试错误')
    assert.equal(calls.length, 1)
    dialog.ui.select('/Movies')
    await dialog.ui.save()
    assert.equal(calls.length, 1)
    rootFailure = false
    await dialog.ui.retry()
    assert.equal(dialog.ui.initialized.value, true)
    assert.equal(dialog.ui.directoryError.value, '')
    assert.deepEqual(dialog.ui.draftSelectedPaths.value, ['/Movies', '/TV'])
    dialog.ui.select('/TV')
    assert.deepEqual(dialog.ui.draftSelectedPaths.value, ['/Movies'])
    directoryFailure = true
    await dialog.ui.navigateDirectory('/Movies')
    assert.equal(dialog.ui.directoryError.value, '测试错误')
    assert.deepEqual(dialog.ui.entries.value, [])
    assert.deepEqual(dialog.ui.draftSelectedPaths.value, ['/Movies'])
    dialog.ui.select('/Movies')
    assert.deepEqual(dialog.ui.draftSelectedPaths.value, ['/Movies'])
    directoryFailure = false
    await dialog.ui.retry()
    assert.equal(dialog.ui.currentPath.value, '/Movies')
    assert.equal(dialog.ui.directoryError.value, '')
    assert.deepEqual(dialog.ui.draftSelectedPaths.value, ['/Movies'])
    assert.deepEqual(dialog.events, [['loaded', ownedRoots, ownedSource.id]])
  } finally {
    dialog.unmount()
  }
})

test('directory selection blocks changes during PUT and isolates roots, browsing and saves after close, unmount or source switch', async () => {
  for (const phase of ['roots', 'directory', 'save']) {
    for (const cancel of ['close', 'unmount', 'source']) {
      await signIn()
      respond = async (url) =>
        url.endsWith('/scan-roots') ? ok(ownedRoots) : selectionDirectory(url)
      const dialog = await componentSetup(
        'components/media-source/DirectorySelection.vue',
        realSelectionProps(),
      )
      try {
        if (phase !== 'roots') await dialog.mount()
        const delayed = deferred()
        let oldSignal
        const received = deferred()
        respond = (url, config) => {
          oldSignal = config.signal
          received.resolve()
          return delayed.promise
        }
        let pending
        if (phase === 'roots') pending = dialog.mount()
        else if (phase === 'directory') pending = dialog.ui.navigateDirectory('/Movies')
        else {
          dialog.ui.select('/TV')
          pending = dialog.ui.save()
        }
        await received.promise
        if (phase === 'save') {
          assert.equal(dialog.ui.saving.value, true)
          dialog.ui.select('/Movies')
          await dialog.ui.navigateDirectory('/Movies')
          assert.deepEqual(dialog.ui.draftSelectedPaths.value, ['/Movies'])
          assert.equal(dialog.ui.currentPath.value, '/')
        }
        if (cancel === 'close') dialog.ui.close()
        else if (cancel === 'unmount') dialog.unmount()
        else {
          respond = async (url) => (url.endsWith('/scan-roots') ? ok([]) : selectionDirectory(url))
          dialog.props.sourceId = 'source-b'
          await nextTick()
        }
        assert.equal(oldSignal.aborted, true)
        delayed.resolve(
          phase === 'directory'
            ? ok({
                path: '/Movies',
                entries: [{ name: 'stale', path: '/Movies/stale', kind: 'file' }],
              })
            : ok(ownedRoots),
        )
        await pending
        if (cancel === 'source') {
          // Let the new root read and subsequent directory request settle.
          for (let turn = 0; turn < 10 && dialog.ui.loading.value; turn++) await nextTick()
          assert.deepEqual(dialog.ui.roots.value, [])
          assert.deepEqual(dialog.ui.draftSelectedPaths.value, [])
          assert.equal(dialog.ui.currentPath.value, '/')
          assert.equal(dialog.ui.directoryError.value, '')
        }
        assert.equal(
          dialog.ui.entries.value.some((entry) => entry.name === 'stale'),
          false,
        )
        assert.deepEqual(
          dialog.events.filter(([event]) => event === 'close' || event === 'saved'),
          cancel === 'close' ? [['close']] : [],
        )
      } finally {
        dialog.unmount()
      }
    }
  }
})

test('source list distinguishes loading, empty, paused roots and per-source errors, then retries only the failed source', async () => {
  await signIn()
  const sourceB = { ...ownedSource, id: 'source-b', name: '第二个来源' }
  const sourceC = { ...ownedSource, id: 'source-c', name: '第三个来源' }
  const delayed = deferred()
  const received = deferred()
  const calls = []
  respond = async (url) => {
    calls.push(url)
    if (url === '/api/media-sources') return ok([ownedSource, sourceB, sourceC])
    if (url.includes(`/${ownedSource.id}/`)) return ok(ownedRoots)
    if (url.includes('/source-b/')) return ok([])
    received.resolve()
    return delayed.promise
  }
  const view = await componentSetup('views/MediaSourcesView.vue')
  try {
    const loading = view.mount()
    await received.promise
    assert.equal(view.ui.status.value, 'ready')
    assert.equal(view.ui.folderSummary(sourceC.id), '正在读取影片文件夹…')
    delayed.resolve(failure(502, 'SOURCE_DIRECTORY_FAILED'))
    await loading
    assert.equal(view.ui.folderSummary(ownedSource.id), '已选择 2 个影片文件夹 · 1 个已暂停')
    assert.equal(view.ui.folderSummary(sourceB.id), '未选择影片文件夹')
    assert.equal(view.ui.folderSummary(sourceC.id), '影片文件夹读取失败')
    assert.equal(view.ui.status.value, 'ready')
    assert.equal(view.ui.error.value, '')
    assert.equal(view.ui.scanRoots.value[sourceC.id].error, '测试错误')
    const retryRoots = [{ id: 'root-c', sourceId: sourceC.id, path: '/Cinema', enabled: true }]
    respond = async (url) => {
      calls.push(url)
      assert.equal(url, '/api/media-sources/source-c/scan-roots')
      return ok(retryRoots)
    }
    await view.ui.loadScanRoots(sourceC.id)
    assert.equal(view.ui.folderSummary(sourceC.id), '已选择 1 个影片文件夹')
    assert.deepEqual(view.ui.scanRoots.value[ownedSource.id].roots, ownedRoots)
    assert.deepEqual(calls.slice(-1), ['/api/media-sources/source-c/scan-roots'])
    assert.equal(calls.filter((url) => url === '/api/media-sources').length, 1)
  } finally {
    view.unmount()
  }
})

test('saving roots replaces the source summary and cancels an older summary GET without starting a scan', async () => {
  await signIn()
  const view = await componentSetup('views/MediaSourcesView.vue')
  const delayed = deferred()
  let signal
  const calls = []
  try {
    respond = (url, config) => {
      calls.push(url)
      signal = config.signal
      assert.equal(config.method, 'get')
      return delayed.promise
    }
    const oldRead = view.ui.loadScanRoots(ownedSource.id)
    view.ui.openSelection(ownedSource)
    assert.equal(view.ui.selectingSource.value.id, ownedSource.id)
    view.ui.selectionSaved(ownedRoots, ownedSource.id)
    assert.equal(signal.aborted, true)
    assert.equal(view.ui.selectingSource.value, undefined)
    assert.equal(view.ui.folderSummary(ownedSource.id), '已选择 2 个影片文件夹 · 1 个已暂停')
    assert.match(view.ui.notice.value, /已保存.*尚未开始扫描/)
    delayed.resolve(ok([]))
    await oldRead
    assert.deepEqual(view.ui.scanRoots.value[ownedSource.id].roots, ownedRoots)
    assert.deepEqual(calls, [`/api/media-sources/${ownedSource.id}/scan-roots`])
    assert.deepEqual(view.routes, [])
    view.ui.notice.value = ''
    view.ui.openSelection({ ...ownedSource, id: 'source-b' })
    view.ui.selectionLoaded(ownedRoots, ownedSource.id)
    view.ui.selectionSaved(ownedRoots, ownedSource.id)
    assert.equal(view.ui.selectingSource.value.id, 'source-b')
    assert.equal(view.ui.scanRoots.value['source-b'], undefined)
    assert.equal(view.ui.notice.value, '')
    view.ui.selectionLoaded([], 'source-b')
    assert.equal(view.ui.folderSummary('source-b'), '未选择影片文件夹')
    assert.equal(view.ui.selectingSource.value.id, 'source-b')
  } finally {
    view.unmount()
  }
})

test('rapid selection browsing cancels an earlier directory read while keeping the draft and current folder', async () => {
  await signIn()
  respond = async (url) => (url.endsWith('/scan-roots') ? ok(ownedRoots) : selectionDirectory(url))
  const dialog = await componentSetup(
    'components/media-source/DirectorySelection.vue',
    realSelectionProps(),
  )
  try {
    await dialog.mount()
    dialog.ui.select('/TV')
    const delayed = deferred()
    let signal
    respond = (url, config) => {
      signal = config.signal
      return delayed.promise
    }
    const oldBrowse = dialog.ui.navigateDirectory('/Movies')
    respond = async (url) => selectionDirectory(url)
    await dialog.ui.navigateDirectory('/TV')
    assert.equal(signal.aborted, true)
    delayed.resolve(
      ok({ path: '/Movies', entries: [{ name: 'stale', path: '/Movies/stale', kind: 'file' }] }),
    )
    await oldBrowse
    assert.equal(dialog.ui.currentPath.value, '/TV')
    assert.equal(dialog.ui.loading.value, false)
    assert.equal(dialog.ui.directoryError.value, '')
    assert.deepEqual(dialog.ui.entries.value, [])
    assert.deepEqual(dialog.ui.draftSelectedPaths.value, ['/Movies'])
    assert.equal(dialog.ui.dirty.value, true)
    assert.equal(
      dialog.events.some(([event]) => event === 'saved'),
      false,
    )
  } finally {
    dialog.unmount()
  }
})

test('list refresh, page exit and account switching cancel late summary reads without refilling old source roots', async () => {
  for (const cancel of ['reload', 'unmount', 'account']) {
    await signIn()
    const view = await componentSetup('views/MediaSourcesView.vue')
    const delayed = deferred()
    let signal
    try {
      respond = (url, config) => {
        signal = config.signal
        return delayed.promise
      }
      const oldRead = view.ui.loadScanRoots(ownedSource.id)
      view.ui.openSelection(ownedSource)
      if (cancel === 'reload') {
        respond = async () => ok([])
        await view.ui.load()
      } else if (cancel === 'unmount') view.unmount()
      else {
        auth.logout()
        await signIn({ id: 'user-b', username: 'bob', role: 'USER' })
      }
      assert.equal(signal.aborted, true)
      delayed.resolve(cancel === 'account' ? failure(401, 'UNAUTHENTICATED') : ok(ownedRoots))
      await oldRead
      assert.equal(view.ui.selectingSource.value, undefined)
      assert.equal(
        Object.values(view.ui.scanRoots.value).some((selection) => selection.roots.length),
        false,
      )
      if (cancel !== 'unmount') assert.deepEqual(view.ui.scanRoots.value, {})
      assert.equal(view.ui.notice.value, '')
      assert.equal(auth.user.username, cancel === 'account' ? 'bob' : 'alice')
      assert.equal(auth.tokenPresent, true)
    } finally {
      view.unmount()
    }
  }
})

test('account switching closes the selection and cancels its PUT before a late unauthorized response can affect the new account', async () => {
  await signIn()
  const view = await componentSetup('views/MediaSourcesView.vue')
  view.ui.openSelection(ownedSource)
  const dialog = await componentSetup(
    'components/media-source/DirectorySelection.vue',
    realSelectionProps(),
  )
  // The SFC harness does not render children; reproduce the parent's v-if unmount.
  const stop = vue.watch(
    () => view.ui.selectingSource.value,
    (source) => {
      if (!source) dialog.unmount()
    },
    { flush: 'sync' },
  )
  try {
    respond = async (url) =>
      url.endsWith('/scan-roots') ? ok(ownedRoots) : selectionDirectory(url)
    await dialog.mount()
    dialog.ui.select('/TV')
    const delayed = deferred()
    let signal
    respond = (url, config) => {
      signal = config.signal
      return delayed.promise
    }
    const saving = dialog.ui.save()
    auth.logout()
    assert.equal(view.ui.selectingSource.value, undefined)
    assert.equal(signal.aborted, true)
    await signIn({ id: 'user-b', username: 'bob', role: 'USER' })
    delayed.resolve(failure(401, 'UNAUTHENTICATED'))
    await saving
    assert.equal(
      dialog.events.some(([event]) => event === 'saved'),
      false,
    )
    assert.deepEqual(view.ui.scanRoots.value, {})
    assert.equal(view.ui.notice.value, '')
    assert.equal(auth.user.username, 'bob')
    assert.equal(auth.tokenPresent, true)
  } finally {
    stop()
    dialog.unmount()
    view.unmount()
  }
})

test('owned scan service uses authenticated bodyless POST, persistent task GET and resource pagination', async () => {
  await signIn()
  const calls = []
  respond = async (url, config) => {
    calls.push([url, config.method, config.body, config.headers.Authorization])
    if (url.includes('/resources?')) return ok(resourcesPage())
    return config.method === 'post' ? ok(scanTask, 202) : ok([scanTask])
  }
  const signal = new AbortController().signal
  assert.deepEqual(await ownedScanService.startOwnedSourceScan(ownedSource.id, signal), scanTask)
  assert.deepEqual(await ownedScanService.getOwnedSourceScans(ownedSource.id, signal), [scanTask])
  assert.deepEqual(
    await ownedScanService.getOwnedSourceResources(ownedSource.id, 0, signal),
    resourcesPage(),
  )
  assert.deepEqual(calls, [
    [
      `/api/media-sources/${ownedSource.id}/scans`,
      'post',
      undefined,
      'Bearer synthetic-test-token',
    ],
    [`/api/media-sources/${ownedSource.id}/scans`, 'get', undefined, 'Bearer synthetic-test-token'],
    [
      `/api/media-sources/${ownedSource.id}/resources?page=0&pageSize=50`,
      'get',
      undefined,
      'Bearer synthetic-test-token',
    ],
  ])
  for (const [page, size] of [
    [-1, 50],
    [1.5, 50],
    [0, 0],
    [0, 101],
  ]) {
    await assert.rejects(
      ownedScanService.getOwnedSourceResources(ownedSource.id, page, signal, size),
      /响应异常/,
    )
  }
  await assert.rejects(ownedScanService.startOwnedSourceScan(' ', signal), /响应异常/)
  assert.equal(calls.length, 3)
})

test('owned scan DTOs reject foreign ownership, credentials, invalid states/counts/paths and malformed resources', async () => {
  await signIn()
  const signal = new AbortController().signal
  for (const task of [
    { ...scanTask, sourceId: 'someone-else' },
    { ...scanTask, password: 'unexpected' },
    { ...scanTask, status: 'unknown' },
    { ...scanTask, status: 'running' },
    { ...scanTask, status: 'completed' },
    { ...scanTask, finishedAt: '2026-10-03T06:31:00Z' },
    { ...scanTask, discoveredCount: -1 },
    { ...scanTask, persistedCount: 1 },
    { ...scanTask, directoryCount: 0.5 },
    { ...scanTask, rootPaths: ['/TV', '/TV/nested'] },
    { ...scanTask, rootPaths: ['/TV', '/TV'] },
    { ...scanTask, rootPaths: [] },
    { ...scanTask, rootPaths: ['/TV/../Movies'] },
    { ...scanTask, createdAt: '2026-02-31T06:30:00Z' },
    { ...scanTask, startedAt: '2026-10-03T14:30:00+08:00' },
  ]) {
    respond = async () => ok(task, 202)
    await assert.rejects(ownedScanService.startOwnedSourceScan(ownedSource.id, signal), /响应异常/)
  }
  for (const tasks of [
    [scanTask, scanTask],
    Array.from({ length: 21 }, (_, i) => ({ ...scanTask, id: `task-${i}` })),
  ]) {
    respond = async () => ok(tasks)
    await assert.rejects(ownedScanService.getOwnedSourceScans(ownedSource.id, signal), /响应异常/)
  }
  for (const resource of [
    { ...mediaResource, sourceId: 'someone-else' },
    { ...mediaResource, resourceUrl: 'https://example.com/private' },
    { ...mediaResource, name: 'wrong.mkv' },
    { ...mediaResource, path: '/TV/%2F.mkv' },
    { ...mediaResource, size: -1 },
    { ...mediaResource, size: Number.MAX_SAFE_INTEGER + 1 },
    { ...mediaResource, modifiedAt: 'invalid' },
    { ...mediaResource, recognitionStatus: 'identified' },
  ]) {
    respond = async () => ok(resourcesPage([resource]))
    await assert.rejects(
      ownedScanService.getOwnedSourceResources(ownedSource.id, 0, signal),
      /响应异常/,
    )
  }
  for (const page of [
    resourcesPage([mediaResource, mediaResource]),
    { ...resourcesPage(), page: 1 },
    { ...resourcesPage(), total: 0 },
  ]) {
    respond = async () => ok(page)
    await assert.rejects(
      ownedScanService.getOwnedSourceResources(ownedSource.id, 0, signal),
      /响应异常/,
    )
  }
  respond = async () => ok(resourcesPage([{ ...mediaResource, size: null, modifiedAt: null }]))
  const result = await ownedScanService.getOwnedSourceResources(ownedSource.id, 0, signal)
  assert.equal(result.items[0].size, null)
})

test('resource name candidates require the complete bounded DTO and do not replace file facts', async () => {
  await signIn()
  const signal = new AbortController().signal
  const candidate = { title: '某部电影', year: 2020, editionLabel: 'Extended Cut' }
  const withoutCandidate = { ...mediaResource }
  delete withoutCandidate.nameCandidate
  respond = async () => ok(resourcesPage([withoutCandidate]))
  await assert.rejects(
    ownedScanService.getOwnedSourceResources(ownedSource.id, 0, signal),
    /响应异常/,
  )
  for (const nameCandidate of [
    null,
    [],
    'Movie',
    {},
    { title: 'Movie', year: null },
    { ...candidate, confidence: 0.9 },
    { ...candidate, title: '' },
    { ...candidate, title: '   ' },
    { ...candidate, title: ' Movie ' },
    { ...candidate, title: '\u00a0Movie' },
    { ...candidate, title: 'Movie\u202f' },
    { ...candidate, title: '\ufeffMovie' },
    { ...candidate, title: 42 },
    { ...candidate, title: null },
    { ...candidate, year: 1887 },
    { ...candidate, year: 2100 },
    { ...candidate, year: 2020.5 },
    { ...candidate, year: '2020' },
    { ...candidate, editionLabel: '' },
    { ...candidate, editionLabel: 'extended cut' },
    { ...candidate, editionLabel: 'Extended Cut ' },
    { ...candidate, editionLabel: 42 },
  ]) {
    respond = async () => ok(resourcesPage([{ ...mediaResource, nameCandidate }]))
    await assert.rejects(
      ownedScanService.getOwnedSourceResources(ownedSource.id, 0, signal),
      /响应异常/,
      JSON.stringify(nameCandidate),
    )
  }
  const accepted = [
    candidate,
    { title: null, year: null, editionLabel: null },
    { title: '2001', year: null, editionLabel: null },
    { title: '最早年份', year: 1888, editionLabel: null },
    { title: '年份上界', year: 2099, editionLabel: null },
    ...[
      'Theatrical Cut',
      "Director's Cut",
      'Extended Cut',
      'Final Cut',
      'IMAX',
      'Special Edition',
      'Unrated',
      'Uncut',
      'Anniversary Edition',
    ].map((editionLabel) => ({ title: null, year: null, editionLabel })),
  ]
  for (const nameCandidate of accepted) {
    const resource = { ...mediaResource, nameCandidate }
    respond = async () => ok(resourcesPage([resource]))
    const result = await ownedScanService.getOwnedSourceResources(ownedSource.id, 0, signal)
    assert.deepEqual(result.items[0], resource)
  }
})

test('normalized candidates accept Unicode whitespace in file facts without failing the resource page', async () => {
  await signIn()
  const signal = new AbortController().signal
  const items = [mediaResource]
  for (const [index, whitespace] of ['\u00a0', '\u202f', '\ufeff', '\u2003'].entries()) {
    const names = [
      `Film${whitespace}(2020).mkv`,
      `${whitespace}Film.2020.mkv`,
      `${whitespace}Film${whitespace}(2020)${whitespace}.mkv`,
      'video.mkv',
    ]
    for (const [nameIndex, name] of names.entries()) {
      const directory =
        name === 'video.mkv' ? `/TV/${whitespace}Film${whitespace}(2020)${whitespace}` : '/TV'
      items.push({
        ...mediaResource,
        id: `unicode-resource-${index}-${nameIndex}`,
        path: `${directory}/${name}`,
        name,
        nameCandidate: { title: 'Film', year: 2020, editionLabel: null },
      })
    }
  }
  respond = async () => ok(resourcesPage(items))
  const result = await ownedScanService.getOwnedSourceResources(ownedSource.id, 0, signal)
  assert.deepEqual(result.items, items)
  assert.equal(result.total, items.length)
})

test('scan result candidate text distinguishes parsed names, partial labels and unavailable names', async () => {
  const dialog = await componentSetup('components/media-source/OwnedScanResults.vue', {
    sourceName: ownedSource.name,
    page: 0,
    loading: false,
    error: '',
    scanError: '',
  })
  try {
    assert.equal(
      dialog.ui.nameCandidateLabel({ title: '某部电影', year: 2020, editionLabel: 'Extended Cut' }),
      '名称解析候选：某部电影 · 2020 · Extended Cut',
    )
    assert.equal(
      dialog.ui.nameCandidateLabel({ title: '2001', year: null, editionLabel: null }),
      '名称解析候选：2001',
    )
    assert.equal(
      dialog.ui.nameCandidateLabel({ title: '某部电影', year: 2020, editionLabel: 'Uncut' }),
      '名称解析候选：某部电影 · 2020 · Uncut',
    )
    assert.equal(
      dialog.ui.nameCandidateLabel({ title: null, year: null, editionLabel: 'IMAX' }),
      '名称解析候选：IMAX',
    )
    assert.equal(
      dialog.ui.nameCandidateLabel({ title: null, year: null, editionLabel: null }),
      '名称暂无法解析',
    )
  } finally {
    dialog.unmount()
  }
})

test('scan polling restores persisted tasks, waits for each request, stops at completion and preserves unknown file facts', async (t) => {
  await signIn()
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const view = await componentSetup('views/MediaSourcesView.vue')
  const running = {
    ...scanTask,
    status: 'running',
    startedAt: scanTask.createdAt,
    directoryCount: 1,
    discoveredCount: 2,
    persistedCount: 2,
  }
  const delayed = deferred()
  let reads = 0
  respond = async (url) => {
    if (url === '/api/media-sources') return ok([ownedSource])
    if (url.endsWith('/scan-roots')) return ok(ownedRoots)
    reads++
    if (reads === 2) return delayed.promise
    return ok([
      reads < 3 ? running : { ...running, status: 'completed', finishedAt: '2026-10-03T06:31:00Z' },
    ])
  }
  try {
    await view.mount()
    assert.equal(reads, 1)
    assert.equal(view.ui.recentScans.value[0].status, 'running')
    assert.equal(view.ui.scanSummary(ownedSource.id), '本次入库 2 个文件')
    t.mock.timers.tick(1500)
    await flushRequests()
    assert.equal(reads, 2)
    t.mock.timers.tick(10000)
    await flushRequests()
    assert.equal(reads, 2)
    delayed.resolve(ok([running]))
    await flushRequests()
    t.mock.timers.tick(1500)
    await flushRequests()
    assert.equal(reads, 3)
    assert.equal(view.ui.recentScans.value[0].status, 'completed')
    t.mock.timers.tick(10000)
    await flushRequests()
    assert.equal(reads, 3)
  } finally {
    view.unmount()
  }
})

test('poll errors preserve persisted running state and require retry without claiming a failed scan', async (t) => {
  await signIn()
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const view = await componentSetup('views/MediaSourcesView.vue')
  const running = { ...scanTask, status: 'running', startedAt: scanTask.createdAt }
  let reads = 0
  respond = async (url) => {
    if (url === '/api/media-sources') return ok([ownedSource])
    if (url.endsWith('/scan-roots')) return ok(ownedRoots)
    reads++
    return reads === 1 ? ok([running]) : failure(503, 'UNAVAILABLE')
  }
  try {
    await view.mount()
    t.mock.timers.tick(1500)
    await flushRequests()
    assert.equal(view.ui.scans.value[ownedSource.id].status, 'error')
    assert.equal(view.ui.recentScans.value[0].status, 'running')
    t.mock.timers.tick(10000)
    await flushRequests()
    assert.equal(reads, 2)
    respond = async () =>
      ok([
        {
          ...running,
          status: 'failed',
          errorCode: 'SCAN_INTERRUPTED',
          errorMessage: '扫描已中断，请重试。',
          finishedAt: '2026-10-03T06:32:00Z',
        },
      ])
    await view.ui.loadScans(ownedSource.id)
    assert.equal(view.ui.recentScans.value[0].status, 'failed')
    assert.equal(view.ui.recentScans.value[0].errorCode, 'SCAN_INTERRUPTED')
  } finally {
    view.unmount()
  }
})

test('terminal scans refresh an open result list, including files saved before a failure', async (t) => {
  for (const status of ['completed', 'failed']) {
    await signIn()
    t.mock.timers.enable({ apis: ['setTimeout'] })
    const view = await componentSetup('views/MediaSourcesView.vue')
    const running = { ...scanTask, status: 'running', startedAt: scanTask.createdAt }
    const finished = {
      ...running,
      status,
      discoveredCount: 1,
      persistedCount: 1,
      directoryCount: 1,
      finishedAt: '2026-10-03T06:31:00Z',
      errorCode: status === 'failed' ? 'SOURCE_CONNECTION_FAILED' : null,
      errorMessage: status === 'failed' ? '来源连接失败，请重试。' : null,
    }
    let scansRead = 0
    let resourcesRead = 0
    respond = async (url) => {
      if (url === '/api/media-sources') return ok([ownedSource])
      if (url.endsWith('/scan-roots')) return ok(ownedRoots)
      if (url.endsWith('/scans')) return ok([++scansRead === 1 ? running : finished])
      assert.equal(url, `/api/media-sources/${ownedSource.id}/resources?page=0&pageSize=50`)
      return ok(resourcesPage(++resourcesRead === 1 ? [] : [mediaResource]))
    }
    try {
      await view.mount()
      await view.ui.openResults(running)
      assert.equal(view.ui.resourceResult.value.total, 0)
      assert.equal(view.ui.resultTask.value.status, 'running')
      t.mock.timers.tick(1500)
      await flushRequests()
      assert.equal(view.ui.resultTask.value.status, status)
      assert.deepEqual(view.ui.resourceResult.value.items, [mediaResource])
      assert.equal(view.ui.resourceResult.value.total, 1)
      assert.equal(view.ui.resourceLoading.value, false)
      assert.equal(view.ui.resourceError.value, '')
      assert.equal(resourcesRead, 2)
      t.mock.timers.tick(10000)
      await flushRequests()
      assert.equal(scansRead, 2)
      assert.equal(resourcesRead, 2)
    } finally {
      view.unmount()
      t.mock.timers.reset()
    }
  }
})

test('closing results cancels the automatic refresh and ignores its late resource response', async (t) => {
  await signIn()
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const view = await componentSetup('views/MediaSourcesView.vue')
  const running = { ...scanTask, status: 'running', startedAt: scanTask.createdAt }
  const completed = {
    ...running,
    status: 'completed',
    discoveredCount: 1,
    persistedCount: 1,
    directoryCount: 1,
    finishedAt: '2026-10-03T06:31:00Z',
  }
  const delayed = deferred()
  let refreshSignal
  let scansRead = 0
  let resourcesRead = 0
  respond = (url, config) => {
    if (url === '/api/media-sources') return ok([ownedSource])
    if (url.endsWith('/scan-roots')) return ok(ownedRoots)
    if (url.endsWith('/scans')) return ok([++scansRead === 1 ? running : completed])
    assert.equal(url, `/api/media-sources/${ownedSource.id}/resources?page=0&pageSize=50`)
    if (++resourcesRead === 1) return ok(resourcesPage([]))
    refreshSignal = config.signal
    return delayed.promise
  }
  try {
    await view.mount()
    await view.ui.openResults(running)
    t.mock.timers.tick(1500)
    await flushRequests()
    assert.equal(view.ui.resultTask.value.status, 'completed')
    assert.equal(view.ui.resourceLoading.value, true)
    assert.equal(resourcesRead, 2)
    assert.equal(refreshSignal.aborted, false)
    view.ui.closeResults()
    assert.equal(refreshSignal.aborted, true)
    delayed.resolve(ok(resourcesPage([mediaResource])))
    await flushRequests()
    assert.equal(view.ui.resultSource.value, undefined)
    assert.equal(view.ui.resourceResult.value, undefined)
    assert.equal(view.ui.resourceLoading.value, false)
    assert.equal(view.ui.resourceError.value, '')
    t.mock.timers.tick(10000)
    await flushRequests()
    assert.equal(resourcesRead, 2)
  } finally {
    view.unmount()
  }
})

test('source menu launches a real scan, isolates repeated submits and deduplicates an existing running task', async () => {
  await signIn()
  const view = await componentSetup('views/MediaSourcesView.vue')
  const delayed = deferred()
  let posts = 0
  respond = async (url, config) => {
    if (config.method === 'post') {
      posts++
      return delayed.promise
    }
    return ok([scanTask])
  }
  try {
    view.ui.menuSource.value = ownedSource
    const starting = view.ui.menuAction('scan')
    await flushRequests()
    assert.equal(posts, 1)
    assert.equal(view.ui.scanStarting.value[ownedSource.id], true)
    assert.equal(view.ui.menuSource.value, undefined)
    assert.equal(view.ui.browsingSource.value, undefined)
    await view.ui.startScan(ownedSource)
    assert.equal(posts, 1)
    delayed.resolve(ok(scanTask, 202))
    await starting
    await flushRequests()
    assert.equal(view.ui.scanStarting.value[ownedSource.id], false)
    assert.equal(view.ui.recentScans.value.length, 1)
    await view.ui.startScan(ownedSource)
    await flushRequests()
    assert.equal(posts, 2)
    assert.equal(view.ui.recentScans.value.length, 1)
  } finally {
    view.unmount()
  }
})

test('scan submit transport failure reports uncertain acceptance and requery recovers the saved task', async () => {
  await signIn()
  const view = await componentSetup('views/MediaSourcesView.vue')
  try {
    respond = async () => {
      throw new AxiosError('timeout', 'ECONNABORTED')
    }
    await view.ui.startScan(ownedSource)
    assert.match(view.ui.scanNotices.value[ownedSource.id], /结果尚不确定/)
    assert.equal(view.ui.recentScans.value.length, 0)
    respond = async () => ok([scanTask])
    await view.ui.loadScans(ownedSource.id)
    assert.equal(view.ui.scanNotices.value[ownedSource.id], '')
    assert.equal(view.ui.recentScans.value[0].id, scanTask.id)
  } finally {
    view.unmount()
  }
})

test('resources paginate, retry and cancel stale page/source/dialog responses', async () => {
  await signIn()
  const view = await componentSetup('views/MediaSourcesView.vue')
  const otherSource = { ...ownedSource, id: 'source-b', name: '另一个来源' }
  const completed = {
    ...scanTask,
    status: 'completed',
    startedAt: scanTask.createdAt,
    finishedAt: '2026-10-03T06:31:00Z',
  }
  view.ui.sourceList.value = [ownedSource, otherSource]
  const delayed = deferred()
  let oldSignal
  try {
    respond = async () => ok(resourcesPage([mediaResource], 0, 51))
    await view.ui.openResults(completed)
    assert.equal(view.ui.resourceResult.value.total, 51)
    respond = (url, config) => {
      oldSignal = config.signal
      return delayed.promise
    }
    const oldPage = view.ui.loadResources(1)
    await flushRequests()
    respond = async () => failure(502, 'RESOURCE_UNAVAILABLE')
    await view.ui.loadResources(0)
    assert.equal(oldSignal.aborted, true)
    assert.equal(view.ui.resourceError.value, '测试错误')
    respond = async () => ok(resourcesPage([mediaResource], 0, 51))
    await view.ui.loadResources()
    assert.equal(view.ui.resourceError.value, '')
    assert.equal(view.ui.resourceResult.value.page, 0)
    delayed.resolve(ok(resourcesPage([{ ...mediaResource, id: 'old-page' }], 1, 51)))
    await oldPage
    assert.equal(view.ui.resourceResult.value.items[0].id, mediaResource.id)
    const oldSource = deferred()
    respond = (url, config) => {
      oldSignal = config.signal
      return oldSource.promise
    }
    const reloading = view.ui.loadResources()
    respond = async () => ok(resourcesPage([{ ...mediaResource, sourceId: otherSource.id }]))
    await view.ui.openResults({ ...completed, id: 'scan-b', sourceId: otherSource.id })
    assert.equal(oldSignal.aborted, true)
    oldSource.resolve(ok(resourcesPage()))
    await reloading
    assert.equal(view.ui.resourceResult.value.items[0].sourceId, otherSource.id)
    const closing = deferred()
    respond = (url, config) => {
      oldSignal = config.signal
      return closing.promise
    }
    const reading = view.ui.loadResources()
    view.ui.closeResults()
    assert.equal(oldSignal.aborted, true)
    closing.resolve(ok(resourcesPage()))
    await reading
    assert.equal(view.ui.resultSource.value, undefined)
    assert.equal(view.ui.resourceResult.value, undefined)
  } finally {
    view.unmount()
  }
})

test('unmount and account switch cancel scan timers, pending submit and resources without old-response refill', async (t) => {
  for (const action of ['unmount', 'logout']) {
    await signIn()
    t.mock.timers.enable({ apis: ['setTimeout'] })
    const view = await componentSetup('views/MediaSourcesView.vue')
    view.ui.sourceList.value = [ownedSource]
    respond = async () => ok([scanTask])
    await view.ui.loadScans(ownedSource.id)
    const delayed = deferred()
    const requests = []
    respond = (url, config) => {
      requests.push(config.signal)
      return delayed.promise
    }
    const submitting = view.ui.startScan(ownedSource)
    const reading = view.ui.openResults(scanTask)
    await flushRequests()
    assert.equal(requests.length, 2)
    if (action === 'unmount') view.unmount()
    else auth.logout()
    assert.equal(
      requests.every((signal) => signal.aborted),
      true,
    )
    if (action === 'logout') await signIn({ id: 'user-b', username: 'bob', role: 'USER' })
    delayed.resolve(ok(scanTask, 202))
    await Promise.all([submitting, reading])
    assert.equal(view.ui.resultSource.value, undefined)
    assert.equal(view.ui.resourceResult.value, undefined)
    if (action === 'logout') assert.deepEqual(view.ui.scans.value, {})
    let calls = 0
    respond = async () => {
      calls++
      return ok([])
    }
    t.mock.timers.tick(10000)
    await flushRequests()
    assert.equal(calls, 0)
    view.unmount()
    t.mock.timers.reset()
  }
})
