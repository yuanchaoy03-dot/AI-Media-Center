import { reactive, readonly } from 'vue'
import { ApiError, request } from './http'

export interface CurrentUser { id: string; username: string; role: 'USER' | 'ADMIN' }
const storageKey = 'personal-cinema.access-token'
const state = reactive({ user: null as CurrentUser | null, epoch: 0, verifying: false, tokenPresent: false, error: '', notice: '', registeredUsername: '' })
export const authState = readonly(state)
let token = sessionStorage.getItem(storageKey)
state.tokenPresent = !!token
let restorePromise: Promise<boolean> | undefined
const pending = new Set<AbortController>()
export const hasToken = () => state.tokenPresent
function isCurrentUser(value: unknown): value is CurrentUser {
  return !!value && typeof value === 'object' && 'id' in value && typeof value.id === 'string'
    && 'username' in value && typeof value.username === 'string' && 'role' in value && (value.role === 'USER' || value.role === 'ADMIN')
}

function clearSession() {
  state.epoch++
  for (const controller of pending) controller.abort()
  pending.clear()
  token = null
  state.tokenPresent = false
  sessionStorage.removeItem(storageKey)
  state.user = null
  state.error = ''
  state.notice = ''
  state.registeredUsername = ''
  state.verifying = false
  restorePromise = undefined
}
export function logout(message = '') {
  clearSession()
  state.notice = message
}
function expired(error: unknown) {
  return error instanceof ApiError && ((error.status === 401 && error.code === 'UNAUTHENTICATED')
    || (error.status === 403 && error.code === 'ACCOUNT_DISABLED'))
}
export async function authenticatedRequest<T>(path: string, signal?: AbortSignal): Promise<T> {
  const epoch = state.epoch
  const controller = new AbortController()
  const abort = () => controller.abort()
  signal?.addEventListener('abort', abort, { once: true })
  if (signal?.aborted) controller.abort()
  pending.add(controller)
  try {
    if (!token) throw new ApiError(401, 'UNAUTHENTICATED', '请先登录。')
    const data = await request<T>(path, { token, signal: controller.signal })
    if (epoch !== state.epoch || controller.signal.aborted) throw new ApiError(0, 'STALE_REQUEST', '请求已取消。')
    return data
  } catch (error) {
    if (epoch !== state.epoch || controller.signal.aborted) throw new ApiError(0, 'STALE_REQUEST', '请求已取消。')
    if (expired(error)) logout((error as ApiError).message)
    throw error
  } finally {
    pending.delete(controller)
    signal?.removeEventListener('abort', abort)
  }
}
export function restoreSession(): Promise<boolean> {
  if (state.user) return Promise.resolve(true)
  if (!token) return Promise.resolve(false)
  if (restorePromise) return restorePromise
  const epoch = state.epoch
  state.verifying = true
  state.error = ''
  restorePromise = (async () => {
    try {
      const user = await authenticatedRequest<CurrentUser>('/auth/me')
      if (epoch !== state.epoch) return false
      if (!isCurrentUser(user)) {
        throw new ApiError(0, 'REQUEST_FAILED', '身份验证响应异常，请重试。')
      }
      state.user = user
      return true
    } catch (error) {
      if (epoch === state.epoch) state.error = error instanceof Error ? error.message : '身份验证失败，请重试。'
      return false
    } finally {
      if (epoch === state.epoch) { state.verifying = false; restorePromise = undefined }
    }
  })()
  return restorePromise
}
export async function login(username: string, password: string, signal: AbortSignal) {
  clearSession()
  state.notice = ''
  const epoch = state.epoch
  const result = await request<{ accessToken: string; tokenType: string; expiresIn: number }>('/auth/login', { body: { username, password }, signal })
  if (epoch !== state.epoch || signal.aborted) return false
  if (!result || typeof result.accessToken !== 'string' || !result.accessToken || result.tokenType !== 'Bearer' || result.expiresIn !== 3600) {
    throw new ApiError(0, 'REQUEST_FAILED', '登录响应异常，请重试。')
  }
  sessionStorage.setItem(storageKey, result.accessToken)
  token = result.accessToken
  state.tokenPresent = true
  return restoreSession()
}
export async function register(username: string, password: string, signal: AbortSignal) {
  const epoch = state.epoch
  const user = await request<CurrentUser>('/auth/register', { body: { username, password }, signal })
  if (signal.aborted || epoch !== state.epoch) return
  if (!isCurrentUser(user)) throw new ApiError(0, 'REQUEST_FAILED', '注册响应异常，请尝试登录。')
  state.registeredUsername = user.username
  state.notice = '账号已创建，请登录。'
}
export function takeLoginHint() {
  const hint = { username: state.registeredUsername, message: state.notice }
  state.registeredUsername = ''
  state.notice = ''
  return hint
}
