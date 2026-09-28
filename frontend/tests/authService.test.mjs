import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import test from 'node:test'

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith('.') && context.parentURL?.includes('/src/') && !/\.[cm]?[jt]s(?:\?|$)/.test(specifier)) return next(`${specifier}.ts`, context)
    return next(specifier, context)
  },
})
const storage = new Map()
globalThis.sessionStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) }
const auth = await import('../src/services/authService.ts')
const { getOwnedSources } = await import('../src/services/ownedSourceService.ts')
const { request } = await import('../src/services/http.ts')
const user = { id: 'user-a', username: 'alice', role: 'USER' }
const ok = data => new Response(JSON.stringify({ code: 'OK', message: '', data, requestId: 'test' }), { status: 200 })
const failure = (status, code) => new Response(JSON.stringify({ code, message: '测试错误', data: null, requestId: 'test' }), { status })
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
async function signIn(identity = user) {
  globalThis.fetch = async path => path.endsWith('/login') ? ok({ accessToken: 'synthetic-test-token', tokenType: 'Bearer', expiresIn: 3600 }) : ok(identity)
  assert.equal(await auth.login(identity.username, 'test-only-password', new AbortController().signal), true)
}
test.afterEach(() => auth.logout())

test('public credentials omit old bearer token; registration stores no password', async () => {
  await signIn()
  globalThis.fetch = async (path, options) => {
    assert.equal(path, '/api/auth/register')
    assert.equal(options.headers.Authorization, undefined)
    assert.deepEqual(Object.keys(JSON.parse(options.body)), ['username', 'password'])
    return ok(user)
  }
  await auth.register('alice', 'test-only-password', new AbortController().signal)
  assert.deepEqual(auth.takeLoginHint(), { username: 'alice', message: '账号已创建，请登录。' })
  assert.equal([...storage.values()].some(value => value.includes('password')), false)
})

test('refresh verifies identity and loads a real empty list; malformed/nonempty responses fail', async () => {
  await signIn()
  const refreshed = await import('../src/services/authService.ts?refresh')
  assert.equal(refreshed.authState.user, null)
  globalThis.fetch = async (path, options) => {
    assert.equal(options.headers.Authorization, 'Bearer synthetic-test-token')
    return path.endsWith('/me') ? ok(user) : ok([])
  }
  assert.equal(await refreshed.restoreSession(), true)
  assert.deepEqual(await getOwnedSources(new AbortController().signal), [])
  globalThis.fetch = async () => ok([{ id: 'unexpected' }])
  await assert.rejects(getOwnedSources(new AbortController().signal), { code: 'REQUEST_FAILED' })
  globalThis.fetch = async () => new Response('<h1>Bad gateway</h1>', { status: 502 })
  await assert.rejects(getOwnedSources(new AbortController().signal), { code: 'REQUEST_FAILED' })
  assert.equal(auth.hasToken(), true)
  refreshed.logout()
})

test('401 and disabled 403 clear identity; 500 and network failures preserve it', async () => {
  for (const [status, code] of [[500, 'INTERNAL_ERROR'], [0, 'REQUEST_FAILED'], [401, 'UNAUTHENTICATED'], [403, 'ACCOUNT_DISABLED']]) {
    await signIn()
    globalThis.fetch = async () => { if (!status) throw new TypeError('offline'); return failure(status, code) }
    await assert.rejects(getOwnedSources(new AbortController().signal), { code })
    assert.equal(auth.hasToken(), status !== 401 && status !== 403)
    assert.equal(auth.authState.user !== null, status !== 401 && status !== 403)
  }
})

test('late data and late unauthorized errors cannot refill or log out a new account', async () => {
  for (const late of [ok([]), failure(401, 'UNAUTHENTICATED')]) {
    await signIn()
    const delayed = deferred()
    globalThis.fetch = () => delayed.promise // Deliberately ignores AbortSignal to exercise the epoch check.
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
  globalThis.fetch = async path => path.endsWith('/login') ? ok({ accessToken: 'synthetic', tokenType: 'Bearer', expiresIn: 3600 }) : failure(500, 'INTERNAL_ERROR')
  assert.equal(await auth.login('alice', 'test-only-password', new AbortController().signal), false)
  assert.equal(auth.authState.user, null)
  assert.equal(auth.hasToken(), true)
  assert.ok(auth.authState.error)
  globalThis.fetch = async () => ok(user)
  assert.equal(await auth.restoreSession(), true)
})

test('late login after logout cannot install a token', async () => {
  const delayed = deferred()
  globalThis.fetch = () => delayed.promise
  const pending = auth.login('alice', 'test-only-password', new AbortController().signal)
  auth.logout()
  delayed.resolve(ok({ accessToken: 'late', tokenType: 'Bearer', expiresIn: 3600 }))
  assert.equal(await pending, false)
  assert.equal(auth.hasToken(), false)
  assert.equal(storage.size, 0)
})

test('invalid login remains a form error; request timeout is not an empty result', async t => {
  globalThis.fetch = async () => failure(401, 'INVALID_CREDENTIALS')
  await assert.rejects(auth.login('alice', 'bad', new AbortController().signal), { code: 'INVALID_CREDENTIALS' })
  assert.equal(auth.hasToken(), false)
  t.mock.timers.enable({ apis: ['setTimeout'] })
  globalThis.fetch = (path, { signal }) => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted'))))
  const pending = request('/auth/register', { body: { username: 'alice', password: 'test-only' } })
  t.mock.timers.tick(15000)
  await assert.rejects(pending, { code: 'REQUEST_FAILED' })
})
