import { reactive, readonly } from 'vue'
import { ApiError, request } from './http'

// CurrentUser 描述后端返回的当前用户长什么样，只包含身份信息，不包含密码或 Token。
export interface CurrentUser { id: string; username: string; role: 'USER' | 'ADMIN' }
const storageKey = 'personal-cinema.access-token'
// 这份响应式登录状态供多个页面共用。as CurrentUser | null 告诉 TypeScript：user 可以是用户对象，也可以为空。
// epoch 是会话版本号；清掉旧会话时加一，让旧请求的结果无法写进新会话。
const state = reactive({ user: null as CurrentUser | null, epoch: 0, verifying: false, tokenPresent: false, error: '', notice: '', registeredUsername: '' })
// readonly 让页面读取 authState 来更新界面，状态修改集中在本 service 中。
export const authState = readonly(state)
// sessionStorage 在当前标签页刷新后仍保留数据，通常关闭标签页后清除。
// token 保存后端登录时签发的 JWT；是否仍然有效，要通过 /auth/me 向后端确认。
let token = sessionStorage.getItem(storageKey)
state.tokenPresent = !!token
let restorePromise: Promise<boolean> | undefined
// 记录正在进行的认证请求，退出登录时可以一起取消。
const pending = new Set<AbortController>()
export const hasToken = () => state.tokenPresent
// unknown 表示还不知道值的结构，检查之前不能直接当成用户使用。
// value is CurrentUser 告诉 TypeScript：本函数返回 true 后，就可以按 CurrentUser 读取它。
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
// 退出时清掉内存状态和保存的 Token，同时取消旧认证请求；页面跳转由路由层处理。
export function logout(message = '') {
  clearSession()
  state.notice = message
}
function expired(error: unknown) {
  return error instanceof ApiError && ((error.status === 401 && error.code === 'UNAUTHENTICATED')
    || (error.status === 403 && error.code === 'ACCOUNT_DISABLED'))
}
// 需要登录的 service 从这里发请求：带上当前 Token，再交给 http.ts 处理 HTTP。
// 把页面的取消信号接到自己的 controller 上，页面离开或退出登录都能取消同一请求。
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
    // 后端明确表示身份失效时清掉会话；普通网络失败仍保留 Token，方便重试。
    if (expired(error)) logout((error as ApiError).message)
    throw error
  } finally {
    pending.delete(controller)
    signal?.removeEventListener('abort', abort)
  }
}
// 刷新后内存中的 user 会丢失，这里用保存的 Token 请求 /auth/me，恢复可信的当前用户。
// restorePromise 让同时触发的身份验证共用一次请求；boolean 表示这次是否确认了身份。
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
// 登录先用 POST 发送账号密码，拿到 Token 后保存，再调用 restoreSession 获取 CurrentUser。
// 有 Token 和拿到可信用户是两步；页面只有等这两步完成后才进入个人区域。
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
// 注册只创建账号，不自动登录；返回的用户名用于下一页的登录提示。
export async function register(username: string, password: string, signal: AbortSignal) {
  const epoch = state.epoch
  const user = await request<CurrentUser>('/auth/register', { body: { username, password }, signal })
  if (signal.aborted || epoch !== state.epoch) return
  if (!isCurrentUser(user)) throw new ApiError(0, 'REQUEST_FAILED', '注册响应异常，请尝试登录。')
  state.registeredUsername = user.username
  state.notice = '账号已创建，请登录。'
}
// 提示取出后立即清空，避免以后再次打开登录页时重复显示注册成功的信息。
export function takeLoginHint() {
  const hint = { username: state.registeredUsername, message: state.notice }
  state.registeredUsername = ''
  state.notice = ''
  return hint
}
