import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import test from 'node:test'
import axios, { AxiosError, CanceledError } from 'axios'

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith('.') && context.parentURL?.includes('/src/') && !/\.[cm]?[jt]s(?:\?|$)/.test(specifier)) return next(`${specifier}.ts`, context)
    return next(specifier, context)
  },
})
const storage = new Map()
globalThis.sessionStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) }
// Install before http.ts creates its instance. Exercise Axios serialization and
// response transformation; only the transport is replaced, never global fetch.
let respond
const originalAdapter = axios.defaults.adapter
axios.defaults.adapter = async config => {
  const result = await respond(axios.getUri(config), {
    ...config, body: config.data,
  })
  const response = { ...result, config, headers: {}, statusText: '' }
  if (!config.validateStatus || config.validateStatus(response.status)) return response
  throw new AxiosError('HTTP failure', response.status >= 500 ? 'ERR_BAD_RESPONSE' : 'ERR_BAD_REQUEST', config, undefined, response)
}
const auth = await import('../src/services/authService.ts')
const { getOwnedSources } = await import('../src/services/ownedSourceService.ts')
const { request, ApiError } = await import('../src/services/http.ts')
axios.defaults.adapter = originalAdapter
const user = { id: 'user-a', username: 'alice', role: 'USER' }
const ok = (data, status = 200) => ({ data: JSON.stringify({ code: 'OK', message: '', data, requestId: 'test' }), status })
const failure = (status, code, fieldErrors) => ({ data: JSON.stringify({ code, message: '测试错误', data: null, requestId: 'test', fieldErrors }), status })
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
async function signIn(identity = user) {
  respond = async path => path.endsWith('/login') ? ok({ accessToken: 'synthetic-test-token', tokenType: 'Bearer', expiresIn: 3600 }) : ok(identity)
  assert.equal(await auth.login(identity.username, 'test-only-password', new AbortController().signal), true)
}
test.afterEach(() => auth.logout())

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
  assert.equal([...storage.values()].some(value => value.includes('password')), false)
})

test('refresh verifies identity and loads a real empty list; malformed/nonempty responses fail', async () => {
  await signIn()
  const refreshed = await import('../src/services/authService.ts?refresh')
  assert.equal(refreshed.authState.user, null)
  respond = async (path, options) => {
    assert.equal(options.headers.Authorization, 'Bearer synthetic-test-token')
    return path.endsWith('/me') ? ok(user) : ok([])
  }
  assert.equal(await refreshed.restoreSession(), true)
  assert.deepEqual(await getOwnedSources(new AbortController().signal), [])
  respond = async () => ok([{ id: 'unexpected' }])
  await assert.rejects(getOwnedSources(new AbortController().signal), { code: 'REQUEST_FAILED' })
  respond = async () => ({ data: '<h1>Bad gateway</h1>', status: 502 })
  await assert.rejects(getOwnedSources(new AbortController().signal), { code: 'REQUEST_FAILED' })
  assert.equal(auth.hasToken(), true)
  refreshed.logout()
})

test('401 and disabled 403 clear identity; 500 and network failures preserve it', async () => {
  for (const [status, code] of [[500, 'INTERNAL_ERROR'], [400, 'VALIDATION_FAILED'], [401, 'INVALID_CREDENTIALS'], [403, 'FORBIDDEN'], [0, 'REQUEST_FAILED'], [401, 'UNAUTHENTICATED'], [403, 'ACCOUNT_DISABLED']]) {
    await signIn()
    respond = async () => { if (!status) throw new AxiosError('Network Error', 'ERR_NETWORK'); return failure(status, code) }
    await assert.rejects(getOwnedSources(new AbortController().signal), { code })
    assert.equal(auth.hasToken(), code !== 'UNAUTHENTICATED' && code !== 'ACCOUNT_DISABLED')
    assert.equal(auth.authState.user !== null, code !== 'UNAUTHENTICATED' && code !== 'ACCOUNT_DISABLED')
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
    assert.equal(auth.authState.user.id, 'user-b')
    assert.equal(auth.hasToken(), true)
  }
})

test('failed identity restoration keeps token for retry and never establishes a user', async () => {
  respond = async path => path.endsWith('/login') ? ok({ accessToken: 'synthetic', tokenType: 'Bearer', expiresIn: 3600 }) : failure(500, 'INTERNAL_ERROR')
  assert.equal(await auth.login('alice', 'test-only-password', new AbortController().signal), false)
  assert.equal(auth.authState.user, null)
  assert.equal(auth.hasToken(), true)
  assert.ok(auth.authState.error)
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
  assert.equal(auth.hasToken(), false)
  assert.equal(storage.size, 0)
})

test('invalid login remains a form error', async () => {
  respond = async () => failure(401, 'INVALID_CREDENTIALS')
  await assert.rejects(auth.login('alice', 'bad', new AbortController().signal), { code: 'INVALID_CREDENTIALS' })
  assert.equal(auth.hasToken(), false)
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
      assert.deepEqual(JSON.parse(options.body), { username: 'alice', password: 'test-only-password' })
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
  assert.deepEqual(auth.authState.user, user)
})

test('malformed login data never installs a token', async () => {
  for (const data of [null, {}, { accessToken: '', tokenType: 'Bearer', expiresIn: 3600 },
    { accessToken: 'synthetic', tokenType: 'Cookie', expiresIn: 3600 },
    { accessToken: 'synthetic', tokenType: 'Bearer', expiresIn: 60 }]) {
    respond = async () => ok(data)
    await assert.rejects(auth.login('alice', 'test-only-password', new AbortController().signal), { code: 'REQUEST_FAILED' })
    assert.equal(auth.hasToken(), false)
    assert.equal(storage.size, 0)
  }
})

test('Axios rejected HTTP responses retain Spring Boot status, code and string field errors', async () => {
  for (const [status, code] of [[400, 'VALIDATION_FAILED'], [401, 'INVALID_CREDENTIALS'],
    [401, 'UNAUTHENTICATED'], [403, 'ACCOUNT_DISABLED'], [409, 'USERNAME_TAKEN'],
    [500, 'INTERNAL_ERROR'], [501, 'SOURCE_LIST_NOT_READY']]) {
    respond = async () => failure(status, code, { username: '测试字段错误', ignored: 42 })
    await assert.rejects(request('/auth/register', { body: {} }), error => {
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
  for (const data of ['<h1>Bad gateway</h1>', '{', 'null', '[]', '{}',
    '{"message":"","data":null}', '{"code":"OK","data":null}',
    '{"code":"OK","message":""}', '{"code":1,"message":"","data":null}',
    '{"code":"OK","message":1,"data":null}', '{"code":"NOT_OK","message":"","data":null}']) {
    for (const status of [200, 502]) {
      // A valid non-OK envelope on an error status remains a business error.
      if (status === 502 && data.includes('NOT_OK')) continue
      respond = async () => ({ status, data })
      await assert.rejects(request('/auth/me'), {
        status: 0, code: 'REQUEST_FAILED', message: '请求未完成，请检查网络后重试。',
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
      status: 0, code: 'REQUEST_FAILED', message: '请求未完成，请检查网络后重试。',
    })
    assert.equal(auth.hasToken(), true)
  }
})

test('external cancellation and logout abort the Axios signal and yield stale requests', async () => {
  for (const cancel of ['external', 'logout']) {
    await signIn()
    const external = new AbortController()
    let transportSignal
    respond = (path, { signal }) => new Promise((resolve, reject) => {
      transportSignal = signal
      signal.addEventListener('abort', () => reject(new CanceledError()), { once: true })
    })
    const pending = getOwnedSources(external.signal)
    assert.equal(transportSignal.aborted, false)
    if (cancel === 'external') external.abort()
    else auth.logout()
    assert.equal(transportSignal.aborted, true)
    await assert.rejects(pending, { code: 'STALE_REQUEST' })
    assert.equal(auth.hasToken(), cancel === 'external')
  }
})

test('pre-aborted requests never reach the adapter; direct request keeps ApiError contract', async () => {
  await signIn()
  respond = () => assert.fail('aborted request reached transport')
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(getOwnedSources(controller.signal), { code: 'STALE_REQUEST' })
  await assert.rejects(request('/auth/me', { signal: controller.signal }), { status: 0, code: 'REQUEST_FAILED' })
  assert.equal(auth.hasToken(), true)
})
