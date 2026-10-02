import { useAuthStore } from '../stores/auth'
import { pinia } from '../stores/index'
import type { SourceConnectionInput } from '../types/mediaSource'
import { ApiError } from './http'

/** Spring Boot 返回的本人来源 DTO；与开发预览的连接/扫描展示模型分开。 */
export interface OwnedMediaSource {
  id: string
  name: string
  type: 'WebDAV'
  address: string
  enabled: boolean
  lastConnectionTestAt: string | null
  createdAt: string
}

export interface ConnectionTestResult {
  testedAt: string
}

function responseError(message: string): never {
  throw new ApiError(0, 'REQUEST_FAILED', message)
}

function isUtcTimestamp(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 19) === value.slice(0, 19)
  )
}

function isSafeAddress(value: unknown): value is string {
  if (typeof value !== 'string') return false
  try {
    const url = new URL(value)
    return (
      ['http:', 'https:'].includes(url.protocol) &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
    )
  } catch {
    return false
  }
}

function readSource(value: unknown): OwnedMediaSource {
  const fields = ['id', 'name', 'type', 'address', 'enabled', 'lastConnectionTestAt', 'createdAt']
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).length !== fields.length ||
    !fields.every((field) => Object.hasOwn(value, field)) ||
    !('id' in value && typeof value.id === 'string' && value.id.trim()) ||
    !('name' in value && typeof value.name === 'string' && value.name.trim()) ||
    !('type' in value && value.type === 'WebDAV') ||
    !('address' in value && isSafeAddress(value.address)) ||
    !('enabled' in value && typeof value.enabled === 'boolean') ||
    !(
      'lastConnectionTestAt' in value &&
      (value.lastConnectionTestAt === null || isUtcTimestamp(value.lastConnectionTestAt))
    ) ||
    !('createdAt' in value && isUtcTimestamp(value.createdAt))
  )
    responseError('来源响应异常，请稍后重试。')
  return {
    id: value.id,
    name: value.name,
    type: value.type,
    address: value.address,
    enabled: value.enabled,
    lastConnectionTestAt: value.lastConnectionTestAt,
    createdAt: value.createdAt,
  }
}

// Service 校验响应；Store 补充会话保护，HTTP 仍由 http.ts 发给 Spring Boot。
export async function getOwnedSources(signal: AbortSignal): Promise<OwnedMediaSource[]> {
  const result = await useAuthStore(pinia).authenticatedRequest<unknown>('/media-sources', signal)
  if (!Array.isArray(result)) responseError('来源列表响应异常，请稍后重试。')
  const sources = result.map(readSource)
  if (new Set(sources.map((source) => source.id)).size !== sources.length)
    responseError('来源列表响应异常，请稍后重试。')
  return sources
}

export async function testOwnedSourceConnection(
  input: SourceConnectionInput,
  signal: AbortSignal,
): Promise<ConnectionTestResult> {
  const result = await useAuthStore(pinia).authenticatedRequest<unknown>(
    '/media-sources/test-connection',
    signal,
    input,
  )
  if (
    !result ||
    typeof result !== 'object' ||
    Object.keys(result).length !== 1 ||
    !('testedAt' in result && isUtcTimestamp(result.testedAt))
  )
    responseError('连接测试响应异常，请稍后重试。')
  return { testedAt: result.testedAt }
}

export async function createOwnedSource(
  input: SourceConnectionInput,
  signal: AbortSignal,
): Promise<OwnedMediaSource> {
  const result = await useAuthStore(pinia).authenticatedRequest<unknown>(
    '/media-sources',
    signal,
    input,
  )
  const source = readSource(result)
  if (source.lastConnectionTestAt === null) responseError('来源响应异常，请稍后重试。')
  return source
}
