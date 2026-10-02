import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'
import test from 'node:test'
import axios from 'axios'

// Real loopback HTTP, no fetch/mock adapter. Node needs an origin for /api;
// only this test adapter supplies it before delegating to Axios's HTTP adapter.
const server = createServer((req, res) => {
  if (req.url === '/api/timeout' || req.url === '/api/cancel') return
  if (req.url === '/api/scan-roots') {
    let body = ''
    req.setEncoding('utf8')
    req.on('data', (chunk) => {
      body += chunk
    })
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(
        JSON.stringify({
          code: 'OK',
          message: '',
          data: {
            method: req.method,
            contentType: req.headers['content-type'],
            authorization: req.headers.authorization,
            body: JSON.parse(body),
          },
          requestId: 'test',
        }),
      )
    })
    return
  }
  if (req.url === '/api/html') {
    res.writeHead(502, { 'Content-Type': 'text/html' })
    res.end('<h1>Bad Gateway</h1>')
    return
  }
  res.writeHead(req.url === '/api/conflict' ? 409 : 200, { 'Content-Type': 'application/json' })
  res.end(
    JSON.stringify(
      req.url === '/api/conflict'
        ? { code: 'USERNAME_TAKEN', message: '这个用户名已被使用。', data: null, requestId: 'test' }
        : { code: 'OK', message: '', data: { path: req.url }, requestId: 'test' },
    ),
  )
})
server.listen(0, '127.0.0.1')
await once(server, 'listening')
const origin = `http://127.0.0.1:${server.address().port}`
const originalAdapter = axios.defaults.adapter
const transport = axios.getAdapter('http')
axios.defaults.adapter = (config) => {
  assert.equal(config.baseURL, '/api')
  assert.equal(config.timeout, 15000)
  return transport({ ...config, baseURL: `${origin}/api`, proxy: false })
}
const { request, ApiError } = await import('../src/services/http.ts')
axios.defaults.adapter = originalAdapter
test.after(async () => {
  server.closeAllConnections()
  await new Promise((resolve) => server.close(resolve))
})

test('real Axios HTTP preserves URL, unwraps data and maps rejected business/HTML responses', async () => {
  assert.deepEqual(await request('/identity'), { path: '/api/identity' })
  await assert.rejects(
    request('/conflict'),
    (error) => error instanceof ApiError && error.status === 409 && error.code === 'USERNAME_TAKEN',
  )
  await assert.rejects(request('/html'), { status: 0, code: 'REQUEST_FAILED' })
})

test('explicit PUT reaches real HTTP with JSON, bearer and an empty or Unicode root selection', async () => {
  for (const paths of [['/电影/中文 空格 &?#%🎬', '/TV'], []]) {
    assert.deepEqual(
      await request('/scan-roots', {
        method: 'PUT',
        body: { paths },
        token: 'synthetic-put-token',
      }),
      {
        method: 'PUT',
        contentType: 'application/json',
        authorization: 'Bearer synthetic-put-token',
        body: { paths },
      },
    )
  }
})

test('real Axios 15000ms timeout becomes REQUEST_FAILED', { timeout: 25000 }, async () => {
  await assert.rejects(request('/timeout'), {
    status: 0,
    code: 'REQUEST_FAILED',
    message: '请求未完成，请检查网络后重试。',
  })
})

test('real Axios request is canceled by native AbortController', async () => {
  const controller = new AbortController()
  const received = once(server, 'request')
  const pending = request('/cancel', { signal: controller.signal })
  await received
  controller.abort()
  await assert.rejects(pending, { status: 0, code: 'REQUEST_FAILED' })
})
