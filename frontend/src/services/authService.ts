import { ApiError, request } from './http'

// CurrentUser 只描述后端身份信息，不包含密码或 Token。
export interface CurrentUser { id: string; username: string; role: 'USER' | 'ADMIN' }
interface LoginResult { accessToken: string; tokenType: string; expiresIn: number }

// Service 只负责认证 API 与关键响应校验，不保存状态、不读取 Store。
// Store → authService → http 的单向依赖，避免认证接口反过来依赖会话而形成循环。
// unknown 必须先检查；value is CurrentUser 让 TypeScript 在检查成功后识别用户类型。
function isCurrentUser(value: unknown): value is CurrentUser {
  return !!value && typeof value === 'object' && 'id' in value && typeof value.id === 'string'
    && 'username' in value && typeof value.username === 'string' && 'role' in value && (value.role === 'USER' || value.role === 'ADMIN')
}

export async function loginUser(username: string, password: string, signal: AbortSignal): Promise<LoginResult> {
  // 不传 token，公开登录不能继承旧会话的 Authorization。
  const result = await request<LoginResult>('/auth/login', { body: { username, password }, signal })
  if (!result || typeof result.accessToken !== 'string' || !result.accessToken || result.tokenType !== 'Bearer' || result.expiresIn !== 3600) {
    throw new ApiError(0, 'REQUEST_FAILED', '登录响应异常，请重试。')
  }
  return result
}

export async function registerUser(username: string, password: string, signal: AbortSignal): Promise<CurrentUser> {
  const user = await request<unknown>('/auth/register', { body: { username, password }, signal })
  if (!isCurrentUser(user)) throw new ApiError(0, 'REQUEST_FAILED', '注册响应异常，请尝试登录。')
  return user
}

export async function getCurrentUser(token: string, signal: AbortSignal): Promise<CurrentUser> {
  const user = await request<unknown>('/auth/me', { token, signal })
  if (!isCurrentUser(user)) throw new ApiError(0, 'REQUEST_FAILED', '身份验证响应异常，请重试。')
  return user
}
