import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getCurrentUser, loginUser, registerUser } from '../services/authService'
import type { CurrentUser } from '../services/authService'
import { ApiError, request } from '../services/http'

const storageKey = 'personal-cinema.access-token'

export const useAuthStore = defineStore('auth', () => {
  // Setup Store 中，返回的 ref 是 State，函数是 Action；需要派生值时用 computed 作为 Getter。
  // 页面读取这份共享状态，会话修改集中在 Action；表单输入等局部状态仍留在组件。
  const user = ref<CurrentUser | null>(null)
  const epoch = ref(0)
  const verifying = ref(false)
  const error = ref('')
  const notice = ref('')
  const registeredUsername = ref('')
  // JWT 只持久化到当前标签页的 sessionStorage，不把用户缓存当成可信身份。
  // 原始 Token 和请求句柄是本 Store 的运行时细节，不放进可展示的 Pinia State。
  let token = sessionStorage.getItem(storageKey)
  const tokenPresent = ref(!!token)
  let restorePromise: Promise<boolean> | undefined
  const pending = new Set<AbortController>()

  function clearSession() {
    // 先增加会话版本，再取消请求；即使传输层迟到或忽略取消，也不能污染新账号。
    epoch.value++
    for (const controller of pending) controller.abort()
    pending.clear()
    token = null
    tokenPresent.value = false
    sessionStorage.removeItem(storageKey)
    user.value = null
    error.value = ''
    notice.value = ''
    registeredUsername.value = ''
    verifying.value = false
    restorePromise = undefined
  }

  // Store 只清理会话，跳转由 Router 负责，避免 Store 与 Router 互相依赖。
  function logout(message = '') {
    clearSession()
    notice.value = message
  }

  // 统一管理本会话的认证/业务请求，页面离开和会话清除都能取消同一次请求。
  // send 仍交给 service / http.ts 发 HTTP；这里不复制 Axios 配置或错误解析。
  async function sessionRequest<T>(
    send: (signal: AbortSignal) => Promise<T>,
    signal?: AbortSignal,
    protectedRequest = false,
  ): Promise<T> {
    const requestEpoch = epoch.value
    const controller = new AbortController()
    const abort = () => controller.abort()
    const stale = () => requestEpoch !== epoch.value || controller.signal.aborted
    signal?.addEventListener('abort', abort, { once: true })
    if (signal?.aborted) controller.abort()
    pending.add(controller)
    try {
      if (protectedRequest && !token) throw new ApiError(401, 'UNAUTHENTICATED', '请先登录。')
      const data = await send(controller.signal)
      if (stale()) throw new ApiError(0, 'STALE_REQUEST', '请求已取消。')
      return data
    } catch (reason) {
      if (stale()) throw new ApiError(0, 'STALE_REQUEST', '请求已取消。')
      // 只有受保护请求明确返回身份失效/账号禁用才清会话；普通网络失败保留 Token。
      if (
        protectedRequest &&
        reason instanceof ApiError &&
        ((reason.status === 401 && reason.code === 'UNAUTHENTICATED') ||
          (reason.status === 403 && reason.code === 'ACCOUNT_DISABLED'))
      )
        logout(reason.message)
      throw reason
    } finally {
      pending.delete(controller)
      signal?.removeEventListener('abort', abort)
    }
  }

  // 真实业务 service 使用此 Action 携带当前 Token，并获得同样的取消/失效/竞态保护。
  function authenticatedRequest<T>(
    path: string,
    signal?: AbortSignal,
    body?: unknown,
    method?: 'GET' | 'POST' | 'PUT',
  ): Promise<T> {
    return sessionRequest(
      (currentSignal) =>
        request<T>(path, { token: token ?? undefined, signal: currentSignal, body, method }),
      signal,
      true,
    )
  }

  // 刷新后只恢复 Token 存在标记；必须通过 /auth/me 才能恢复可信 user。
  // 并发调用共用一次验证，旧请求的 finally 也不能清掉新会话的验证句柄。
  function restoreSession(): Promise<boolean> {
    if (user.value) return Promise.resolve(true)
    if (!token) return Promise.resolve(false)
    if (restorePromise) return restorePromise
    const requestEpoch = epoch.value
    verifying.value = true
    error.value = ''
    restorePromise = (async () => {
      try {
        const currentUser = await sessionRequest(
          (currentSignal) => getCurrentUser(token!, currentSignal),
          undefined,
          true,
        )
        if (requestEpoch !== epoch.value) return false
        user.value = currentUser
        return true
      } catch (reason) {
        if (requestEpoch === epoch.value)
          error.value = reason instanceof Error ? reason.message : '身份验证失败，请重试。'
        return false
      } finally {
        if (requestEpoch === epoch.value) {
          verifying.value = false
          restorePromise = undefined
        }
      }
    })()
    return restorePromise
  }

  // 登录先清旧会话，公开 API 不携带旧身份；拿到 JWT 后再验证 /auth/me。
  async function login(username: string, password: string, signal: AbortSignal) {
    clearSession()
    const requestEpoch = epoch.value
    try {
      const result = await sessionRequest(
        (currentSignal) => loginUser(username, password, currentSignal),
        signal,
      )
      if (requestEpoch !== epoch.value || signal.aborted) return false
      sessionStorage.setItem(storageKey, result.accessToken)
      token = result.accessToken
      tokenPresent.value = true
      // 身份恢复由本会话共享；表单取消只取消自己的登录结果，不取消路由的恢复。
      const ready = await restoreSession()
      return requestEpoch === epoch.value && !signal.aborted && ready
    } catch (reason) {
      if (reason instanceof ApiError && reason.code === 'STALE_REQUEST') return false
      throw reason
    }
  }

  // 注册不建立身份，只保存下一页的一次性提示；取消后的旧表单不能触发跳转。
  async function register(username: string, password: string, signal: AbortSignal) {
    const requestEpoch = epoch.value
    try {
      const registered = await sessionRequest(
        (currentSignal) => registerUser(username, password, currentSignal),
        signal,
      )
      if (requestEpoch !== epoch.value || signal.aborted) return false
      registeredUsername.value = registered.username
      notice.value = '账号已创建，请登录。'
      return true
    } catch (reason) {
      if (reason instanceof ApiError && reason.code === 'STALE_REQUEST') return false
      throw reason
    }
  }

  function takeLoginHint() {
    const hint = { username: registeredUsername.value, message: notice.value }
    registeredUsername.value = ''
    notice.value = ''
    return hint
  }

  return {
    user,
    epoch,
    verifying,
    tokenPresent,
    error,
    notice,
    registeredUsername,
    logout,
    authenticatedRequest,
    restoreSession,
    login,
    register,
    takeLoginHint,
  }
})
