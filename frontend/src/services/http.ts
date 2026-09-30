import axios from 'axios'

// Token 由调用方按请求传入；公开登录/注册不继承旧身份。
// axios.create 创建共用的请求客户端，各个 service 不用重复写这些配置。
const apiClient = axios.create({
  // path 为 /auth/login 时，请求地址会拼成 /api/auth/login，与后端的 /api/auth 对应。
  baseURL: '/api',
  // timeout 的单位是毫秒；超过 15 秒还没完成就按请求失败处理。
  timeout: 15000,
  // 当前用请求头传 Token；这里不启用跨站请求携带 Cookie。
  withCredentials: false,
  // headers 是请求头；Accept 告诉后端，希望收到 JSON 格式的数据。
  headers: { Accept: 'application/json' },
})

// ApiError 在普通 Error 的 message 之外，保存 HTTP 状态码、业务错误码和表单字段提示。
export class ApiError extends Error {
  status: number
  code: string
  // Record<string, string> 是“字符串键 → 字符串值”的对象，比如 { username: '用户名已存在' }。
  fieldErrors: Record<string, string>
  constructor(status: number, code: string, message: string, fieldErrors: Record<string, string> = {}) {
    super(message)
    this.status = status
    this.code = code
    this.fieldErrors = fieldErrors
  }
}

// <T> 是类型占位符：调用方用 request<CurrentUser> 指定希望拿到的数据类型。
// Promise<T> 表示异步完成后得到 T；它只帮助类型检查，不会自动检查后端 JSON 的实际结构。
// body? 等字段可以不传，signal 是调用方给的取消信号。
export async function request<T>(path: string, options: { body?: unknown; token?: string; signal?: AbortSignal } = {}): Promise<T> {
  try {
    // 当前封装：不传 body 就用 GET 读取数据，传了 body 就用 POST 提交数据。
    const response = await apiClient.request<unknown>({
      url: path,
      method: options.body === undefined ? 'GET' : 'POST',
      headers: {
        // Content-Type 说明发出去的正文是 JSON；JWT 就在这里放进 Authorization 请求头。
        ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      // 把表单对象转成 JSON 正文；signal 被 abort 时，Axios 会取消这次请求。
      data: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    }).catch((error: unknown) => {
      // Axios 默认拒绝非 2xx；有 HTTP 响应时仍按后端统一包裹解析。
      if (axios.isAxiosError<unknown>(error) && error.response) return error.response
      throw error
    })
    // response.data 是 Axios 收到的响应正文，此处仍是后端包裹的 { code, data, message }。
    // 先检查这层结构，再把里面的 data 交给 service；HTTP 状态码则在 response.status 中。
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
    // as T 表示按调用方指定的类型使用 data，不会转换它；service 仍可继续检查关键字段。
    return body.data as T
  } catch (error) {
    // 保留后端已整理好的 ApiError；网络、超时、取消或响应格式异常统一变成 status 为 0 的错误。
    // 这里的 0 是前端标记，不是后端返回的 HTTP 状态码。
    if (error instanceof ApiError) throw error
    throw new ApiError(0, 'REQUEST_FAILED', '请求未完成，请检查网络后重试。')
  }
}
