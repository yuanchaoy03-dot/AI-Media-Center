import { useAuthStore } from '../stores/auth'
import { pinia } from '../stores/index'
import type { DirectoryEntry, MediaScanRoot, SourceConnectionInput } from '../types/mediaSource'
import { ApiError } from './http'
import { getScanRootRelation, normalizeScanRootPath } from './scanRootPaths'

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isDateString(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

function readSource(value: unknown): OwnedMediaSource {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    !value.id ||
    typeof value.name !== 'string' ||
    value.type !== 'WebDAV' ||
    typeof value.address !== 'string' ||
    typeof value.enabled !== 'boolean' ||
    !(value.lastConnectionTestAt === null || isDateString(value.lastConnectionTestAt)) ||
    !isDateString(value.createdAt)
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

// 只检查页面消费所需的 DTO；权限、安全和领域规则由 Spring Boot 保证。
export async function getOwnedSources(signal: AbortSignal): Promise<OwnedMediaSource[]> {
  const result = await useAuthStore(pinia).authenticatedRequest<unknown>('/media-sources', signal)
  if (!Array.isArray(result)) responseError('来源列表响应异常，请稍后重试。')
  return result.map(readSource)
}

function isDirectoryPath(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('/')
}

// 用户提交前立即提示数量和范围冲突，不用它审计后端返回的扫描根。
function isScanRootSelection(paths: readonly string[]): boolean {
  try {
    if (paths.length > 32) return false
    const normalized = paths.map(normalizeScanRootPath)
    return normalized.every((path, index) =>
      normalized.slice(0, index).every((other) => getScanRootRelation(path, other) === 'none'),
    )
  } catch {
    return false
  }
}

function readScanRoots(value: unknown, sourceId: string): MediaScanRoot[] {
  const invalid = () => responseError('影片文件夹响应异常，请稍后重试。')
  if (!Array.isArray(value)) return invalid()
  return value.map((root: unknown): MediaScanRoot => {
    if (
      !isRecord(root) ||
      typeof root.id !== 'string' ||
      !root.id ||
      root.sourceId !== sourceId ||
      !isDirectoryPath(root.path) ||
      typeof root.enabled !== 'boolean'
    )
      return invalid()
    return { id: root.id, sourceId: root.sourceId, path: root.path, enabled: root.enabled }
  })
}

export async function getOwnedSourceScanRoots(
  sourceId: string,
  signal: AbortSignal,
): Promise<MediaScanRoot[]> {
  if (!sourceId.trim() || sourceId !== sourceId.trim())
    responseError('来源标识异常，请关闭后重试。')
  const result = await useAuthStore(pinia).authenticatedRequest<unknown>(
    `/media-sources/${encodeURIComponent(sourceId)}/scan-roots`,
    signal,
  )
  return readScanRoots(result, sourceId)
}

export async function saveOwnedSourceScanRoots(
  sourceId: string,
  paths: readonly string[],
  signal: AbortSignal,
): Promise<MediaScanRoot[]> {
  if (!sourceId.trim() || sourceId !== sourceId.trim())
    responseError('来源标识异常，请关闭后重试。')
  if (!isScanRootSelection(paths)) {
    const message = '最多选择 32 个影片文件夹，路径不能重复或互相包含。'
    throw new ApiError(400, 'VALIDATION_FAILED', message, { paths: message })
  }
  const result = await useAuthStore(pinia).authenticatedRequest<unknown>(
    `/media-sources/${encodeURIComponent(sourceId)}/scan-roots`,
    signal,
    { paths: [...paths] },
    'PUT',
  )
  return readScanRoots(result, sourceId)
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
  if (!isRecord(result) || result.path !== path || !Array.isArray(result.entries)) return invalid()
  const entries = result.entries.map((entry: unknown): DirectoryEntry => {
    if (
      !isRecord(entry) ||
      typeof entry.name !== 'string' ||
      !isDirectoryPath(entry.path) ||
      !(entry.kind === 'directory' || entry.kind === 'file')
    )
      return invalid()
    return { name: entry.name, path: entry.path, kind: entry.kind }
  })
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
  if (!isRecord(result) || !isDateString(result.testedAt))
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
  return readSource(result)
}
