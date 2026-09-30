import { authenticatedRequest } from './authService'
import { ApiError } from './http'

// 真实页面的调用链：MediaSourcesView.vue → 本 service → authenticatedRequest → http.ts → Spring Boot。
// 当前接口只支持本人来源的空列表；Promise<[]> 中的 [] 表示空数组，不是任意来源数组。
export async function getOwnedSources(signal: AbortSignal): Promise<[]> {
  const result = await authenticatedRequest<unknown>('/media-sources', signal)
  // 先检查后端实际返回值，避免把尚未支持的非空列表直接当成“没有来源”。
  if (!Array.isArray(result) || result.length !== 0) throw new ApiError(0, 'REQUEST_FAILED', '来源列表响应异常，请稍后重试。')
  return []
}
