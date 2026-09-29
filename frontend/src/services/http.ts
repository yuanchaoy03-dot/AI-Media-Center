import axios from 'axios'

// Token 由调用方按请求传入；公开登录/注册不继承旧身份。
const apiClient = axios.create({
  baseURL: '/api',
  timeout: 15000,
  withCredentials: false,
  headers: { Accept: 'application/json' },
})

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
  try {
    const response = await apiClient.request<unknown>({
      url: path,
      method: options.body === undefined ? 'GET' : 'POST',
      headers: {
        ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      data: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    }).catch((error: unknown) => {
      // Axios 默认拒绝非 2xx；有 HTTP 响应时仍按后端统一包裹解析。
      if (axios.isAxiosError<unknown>(error) && error.response) return error.response
      throw error
    })
    const body: unknown = response.data
    if (!body || typeof body !== 'object' || !('code' in body) || !('data' in body) || !('message' in body)
      || typeof body.code !== 'string' || typeof body.message !== 'string') throw new Error('Invalid response')
    if (response.status < 200 || response.status >= 300) {
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
  }
}
