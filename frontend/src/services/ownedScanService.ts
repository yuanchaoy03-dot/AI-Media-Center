import { useAuthStore } from '../stores/auth'
import { pinia } from '../stores/index'
import { ApiError } from './http'

export interface OwnedScanTask {
  id: string
  sourceId: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  rootPaths: string[]
  discoveredCount: number
  persistedCount: number
  directoryCount: number
  errorCode: string | null
  errorMessage: string | null
  createdAt: string
  startedAt: string | null
  finishedAt: string | null
}

export interface OwnedMediaResource {
  id: string
  sourceId: string
  path: string
  name: string
  size: number | null
  modifiedAt: string | null
  recognitionStatus: 'unidentified'
  nameCandidate: OwnedMediaNameCandidate
}

export interface OwnedMediaNameCandidate {
  title: string | null
  year: number | null
}

export interface OwnedResourcePage {
  items: OwnedMediaResource[]
  total: number
  page: number
  pageSize: number
}

function invalid(): never {
  throw new ApiError(0, 'REQUEST_FAILED', '扫描响应异常，请重新查询。')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function isDateString(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

function isPath(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('/')
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function readNameCandidate(value: unknown): OwnedMediaNameCandidate {
  if (
    !isRecord(value) ||
    !(value.title === null || typeof value.title === 'string') ||
    !(value.year === null || (isCount(value.year) && value.year >= 1888 && value.year <= 2099))
  )
    return invalid()
  return { title: value.title, year: value.year }
}

// 历史任务只按 DTO 读取，不在 Vue 重建状态机或扫描范围不变量。
function readTask(task: unknown, sourceId: string): OwnedScanTask {
  if (
    !isRecord(task) ||
    !isNonEmptyString(task.id) ||
    task.sourceId !== sourceId ||
    !(
      task.status === 'pending' ||
      task.status === 'running' ||
      task.status === 'completed' ||
      task.status === 'failed'
    ) ||
    !Array.isArray(task.rootPaths) ||
    !task.rootPaths.every(isPath) ||
    !isCount(task.discoveredCount) ||
    !isCount(task.persistedCount) ||
    !isCount(task.directoryCount) ||
    !(task.errorCode === null || typeof task.errorCode === 'string') ||
    !(task.errorMessage === null || typeof task.errorMessage === 'string') ||
    !isDateString(task.createdAt) ||
    !(task.startedAt === null || isDateString(task.startedAt)) ||
    !(task.finishedAt === null || isDateString(task.finishedAt))
  )
    return invalid()
  return {
    id: task.id,
    sourceId: task.sourceId,
    status: task.status,
    rootPaths: [...task.rootPaths],
    discoveredCount: task.discoveredCount,
    persistedCount: task.persistedCount,
    directoryCount: task.directoryCount,
    errorCode: task.errorCode,
    errorMessage: task.errorMessage,
    createdAt: task.createdAt,
    startedAt: task.startedAt,
    finishedAt: task.finishedAt,
  }
}

function sourcePath(sourceId: string) {
  if (!sourceId.trim() || sourceId !== sourceId.trim()) return invalid()
  return `/media-sources/${encodeURIComponent(sourceId)}`
}

export async function startOwnedSourceScan(
  sourceId: string,
  signal: AbortSignal,
): Promise<OwnedScanTask> {
  const result = await useAuthStore(pinia).authenticatedRequest<unknown>(
    `${sourcePath(sourceId)}/scans`,
    signal,
    undefined,
    'POST',
  )
  return readTask(result, sourceId)
}

export async function getOwnedSourceScans(
  sourceId: string,
  signal: AbortSignal,
): Promise<OwnedScanTask[]> {
  const result = await useAuthStore(pinia).authenticatedRequest<unknown>(
    `${sourcePath(sourceId)}/scans`,
    signal,
  )
  if (!Array.isArray(result)) return invalid()
  return result.map((value) => readTask(value, sourceId))
}

export async function getOwnedSourceResources(
  sourceId: string,
  page: number,
  signal: AbortSignal,
  pageSize = 50,
): Promise<OwnedResourcePage> {
  if (!isCount(page) || !isCount(pageSize) || pageSize < 1 || pageSize > 100) return invalid()
  const result = await useAuthStore(pinia).authenticatedRequest<unknown>(
    `${sourcePath(sourceId)}/resources?page=${page}&pageSize=${pageSize}`,
    signal,
  )
  if (
    !isRecord(result) ||
    !Array.isArray(result.items) ||
    !isCount(result.total) ||
    result.page !== page ||
    result.pageSize !== pageSize
  )
    return invalid()
  const items = result.items.map((resource: unknown): OwnedMediaResource => {
    if (
      !isRecord(resource) ||
      !isNonEmptyString(resource.id) ||
      resource.sourceId !== sourceId ||
      !isPath(resource.path) ||
      typeof resource.name !== 'string' ||
      !(resource.size === null || isCount(resource.size)) ||
      !(resource.modifiedAt === null || isDateString(resource.modifiedAt)) ||
      resource.recognitionStatus !== 'unidentified'
    )
      return invalid()
    return {
      id: resource.id,
      sourceId: resource.sourceId,
      path: resource.path,
      name: resource.name,
      size: resource.size,
      modifiedAt: resource.modifiedAt,
      recognitionStatus: resource.recognitionStatus,
      nameCandidate: readNameCandidate(resource.nameCandidate),
    }
  })
  return { items, total: result.total, page, pageSize }
}
