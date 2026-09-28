import { authenticatedRequest } from './authService'
import { ApiError } from './http'

export async function getOwnedSources(signal: AbortSignal): Promise<[]> {
  const result = await authenticatedRequest<unknown>('/media-sources', signal)
  if (!Array.isArray(result) || result.length !== 0) throw new ApiError(0, 'REQUEST_FAILED', '来源列表响应异常，请稍后重试。')
  return []
}
