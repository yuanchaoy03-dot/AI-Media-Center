import { useAuthStore } from '../stores/auth'
import { pinia } from '../stores/index'
import type { DirectoryEntry, SourceConnectionInput } from '../types/mediaSource'
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

export interface OwnedSourceDirectory {
  path: string
  entries: DirectoryEntry[]
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

function isDirectoryPath(value: unknown): value is string {
  if (typeof value !== 'string' || !value.startsWith('/')) return false
  if (value === '/') return true
  const characters = [...value]
  return (
    characters.length <= 2048 &&
    !value.includes('\\') &&
    characters.every((character) => {
      const code = character.codePointAt(0) ?? 0
      return code > 31 && (code < 127 || code > 159) && (code < 0xd800 || code > 0xdfff)
    }) &&
    !/%(?:25)*(?:2f|5c|2e)/i.test(value) &&
    value
      .slice(1)
      .split('/')
      .every((part) => part && part !== '.' && part !== '..')
  )
}

export async function getOwnedSourceDirectory(
  sourceId: string,
  path: string,
  signal: AbortSignal,
): Promise<OwnedSourceDirectory> {
  if (!sourceId.trim() || !isDirectoryPath(path)) responseError('目录路径异常，请关闭后重试。')
  const result = await useAuthStore(pinia).authenticatedRequest<unknown>(
    `/media-sources/${encodeURIComponent(sourceId)}/directory?path=${encodeURIComponent(path)}`,
    signal,
  )
  const invalid = () => responseError('目录响应异常，请稍后重试。')
  if (
    !result ||
    typeof result !== 'object' ||
    Array.isArray(result) ||
    Object.keys(result).length !== 2 ||
    !('path' in result && isDirectoryPath(result.path) && result.path === path) ||
    !('entries' in result && Array.isArray(result.entries) && result.entries.length <= 2000)
  )
    return invalid()
  const prefix = path === '/' ? '/' : `${path}/`
  const entries = result.entries.map((entry: unknown): DirectoryEntry => {
    if (
      !entry ||
      typeof entry !== 'object' ||
      Array.isArray(entry) ||
      Object.keys(entry).length !== 3 ||
      !('name' in entry && typeof entry.name === 'string' && entry.name) ||
      !('path' in entry && isDirectoryPath(entry.path)) ||
      !('kind' in entry && (entry.kind === 'directory' || entry.kind === 'file')) ||
      entry.path !== `${prefix}${entry.name}` ||
      entry.name.includes('/')
    )
      return invalid()
    return { name: entry.name, path: entry.path, kind: entry.kind }
  })
  if (new Set(entries.map((entry) => entry.path)).size !== entries.length) return invalid()
  return { path: result.path, entries }
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
