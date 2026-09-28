export class ApiError extends Error {
  status: number
  code: string
  fieldErrors: Record<string, string>
  constructor(status: number, code: string, message: string, fieldErrors: Record<string, string> = {}) {
    super(message)
    this.status = status
    this.code = code
    this.fieldErrors = fieldErrors
  }
}

export async function request<T>(path: string, options: { body?: unknown; token?: string; signal?: AbortSignal } = {}): Promise<T> {
  const controller = new AbortController()
  const abort = () => controller.abort()
  options.signal?.addEventListener('abort', abort, { once: true })
  if (options.signal?.aborted) controller.abort()
  const timeout = setTimeout(abort, 15000)
  try {
    const response = await fetch(`/api${path}`, {
      method: options.body === undefined ? 'GET' : 'POST',
      headers: {
        Accept: 'application/json',
        ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
      credentials: 'omit',
      cache: 'no-store',
    })
    const body: unknown = await response.json()
    if (!body || typeof body !== 'object' || !('code' in body) || !('data' in body) || !('message' in body)
      || typeof body.code !== 'string' || typeof body.message !== 'string') throw new Error('Invalid response')
    if (!response.ok) {
      const fields: Record<string, string> = {}
      if ('fieldErrors' in body && body.fieldErrors && typeof body.fieldErrors === 'object') {
        for (const [key, value] of Object.entries(body.fieldErrors)) if (typeof value === 'string') fields[key] = value
      }
      throw new ApiError(response.status, body.code, body.message, fields)
    }
    if (body.code !== 'OK') throw new Error('Invalid success response')
    return body.data as T
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(0, 'REQUEST_FAILED', '请求未完成，请检查网络后重试。')
  } finally {
    clearTimeout(timeout)
    options.signal?.removeEventListener('abort', abort)
  }
}
