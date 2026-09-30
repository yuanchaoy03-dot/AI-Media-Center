import { useAuthStore } from '../stores/auth'
import { pinia } from '../stores/index'
import { ApiError } from './http'

// 本 service 校验来源数据；Store 只补充会话保护，HTTP 仍由 http.ts 发给 Spring Boot。
// 当前接口只支持本人来源的空列表；Promise<[]> 中的 [] 表示空数组，不是任意来源数组。
export async function getOwnedSources(signal: AbortSignal): Promise<[]> {
  // service 在组件外执行，显式使用应用 Pinia，不依赖当前 active Pinia。
  const result = await useAuthStore(pinia).authenticatedRequest<unknown>('/media-sources', signal)
  // 先检查后端实际返回值，避免把尚未支持的非空列表直接当成“没有来源”。
  if (!Array.isArray(result) || result.length !== 0) throw new ApiError(0, 'REQUEST_FAILED', '来源列表响应异常，请稍后重试。')
  return []
}
