import { useAuthStore } from '../stores/auth'
import { pinia } from '../stores/index'
import { ApiError } from './http'
import { getScanRootRelation } from './scanRootPaths'

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
  editionLabel:
    | 'Theatrical Cut'
    | "Director's Cut"
    | 'Extended Cut'
    | 'Final Cut'
    | 'IMAX'
    | 'Special Edition'
    | 'Unrated'
    | 'Uncut'
    | 'Anniversary Edition'
    | null
}

const editionLabels: readonly string[] = [
  'Theatrical Cut',
  "Director's Cut",
  'Extended Cut',
  'Final Cut',
  'IMAX',
  'Special Edition',
  'Unrated',
  'Uncut',
  'Anniversary Edition',
]

export interface OwnedResourcePage {
  items: OwnedMediaResource[]
  total: number
  page: number
  pageSize: number
}

function invalid(): never {
  throw new ApiError(0, 'REQUEST_FAILED', '扫描响应异常，请重新查询。')
}

function object(value: unknown, fields: readonly string[]): Record<string, unknown> {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).length !== fields.length ||
    !fields.every((field) => Object.hasOwn(value, field))
  )
    return invalid()
  return value as Record<string, unknown>
}

function id(value: unknown): value is string {
  return typeof value === 'string' && !!value.trim() && value === value.trim()
}

function timestamp(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 19) === value.slice(0, 19)
  )
}

function path(value: unknown): value is string {
  if (typeof value !== 'string' || !value.startsWith('/') || [...value].length > 2048) return false
  return (
    !value.includes('\\') &&
    !/%(?:25)*(?:2f|5c|2e)/i.test(value) &&
    [...value].every((character) => {
      const code = character.codePointAt(0) ?? 0
      return code > 31 && (code < 127 || code > 159) && (code < 0xd800 || code > 0xdfff)
    }) &&
    (value === '/' ||
      value
        .slice(1)
        .split('/')
        .every((part) => part && part !== '.' && part !== '..'))
  )
}

function count(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function readNameCandidate(value: unknown): OwnedMediaNameCandidate {
  const candidate = object(value, ['title', 'year', 'editionLabel'])
  if (
    !(candidate.title === null || id(candidate.title)) ||
    !(
      candidate.year === null ||
      (count(candidate.year) &&
        candidate.year >= 1888 &&
        candidate.year <= 2099 &&
        candidate.title !== null)
    ) ||
    !(
      candidate.editionLabel === null ||
      (typeof candidate.editionLabel === 'string' && editionLabels.includes(candidate.editionLabel))
    )
  )
    return invalid()
  return candidate as unknown as OwnedMediaNameCandidate
}

function readTask(value: unknown, sourceId: string): OwnedScanTask {
  const task = object(value, [
    'id',
    'sourceId',
    'status',
    'rootPaths',
    'discoveredCount',
    'persistedCount',
    'directoryCount',
    'errorCode',
    'errorMessage',
    'createdAt',
    'startedAt',
    'finishedAt',
  ])
  if (
    !id(task.id) ||
    task.sourceId !== sourceId ||
    !['pending', 'running', 'completed', 'failed'].includes(task.status as string) ||
    !Array.isArray(task.rootPaths) ||
    !task.rootPaths.length ||
    task.rootPaths.length > 32 ||
    !task.rootPaths.every(path) ||
    !count(task.discoveredCount) ||
    !count(task.persistedCount) ||
    !count(task.directoryCount) ||
    task.persistedCount > task.discoveredCount ||
    !(task.errorCode === null || id(task.errorCode)) ||
    !(task.errorMessage === null || id(task.errorMessage)) ||
    !timestamp(task.createdAt) ||
    !(task.startedAt === null || timestamp(task.startedAt)) ||
    !(task.finishedAt === null || timestamp(task.finishedAt))
  )
    return invalid()
  const roots = task.rootPaths as string[]
  if (
    roots.some((root, index) =>
      roots.slice(0, index).some((other) => getScanRootRelation(root, other) !== 'none'),
    )
  )
    return invalid()
  if (
    (task.status === 'completed' || task.status === 'failed') !== (task.finishedAt !== null) ||
    (task.status === 'pending' && task.startedAt !== null) ||
    (task.status === 'running' && task.startedAt === null)
  )
    return invalid()
  return { ...task, rootPaths: [...roots] } as unknown as OwnedScanTask
}

function sourcePath(sourceId: string) {
  if (!id(sourceId)) return invalid()
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
  if (!Array.isArray(result) || result.length > 20) return invalid()
  const tasks = result.map((value) => readTask(value, sourceId))
  if (new Set(tasks.map((task) => task.id)).size !== tasks.length) return invalid()
  return tasks
}

export async function getOwnedSourceResources(
  sourceId: string,
  page: number,
  signal: AbortSignal,
  pageSize = 50,
): Promise<OwnedResourcePage> {
  if (!count(page) || !count(pageSize) || pageSize < 1 || pageSize > 100) return invalid()
  const result = await useAuthStore(pinia).authenticatedRequest<unknown>(
    `${sourcePath(sourceId)}/resources?page=${page}&pageSize=${pageSize}`,
    signal,
  )
  const resultPage = object(result, ['items', 'total', 'page', 'pageSize'])
  if (
    !Array.isArray(resultPage.items) ||
    !count(resultPage.total) ||
    resultPage.page !== page ||
    resultPage.pageSize !== pageSize ||
    resultPage.items.length > pageSize ||
    resultPage.items.length > resultPage.total ||
    (resultPage.items.length > 0 && page * pageSize + resultPage.items.length > resultPage.total)
  )
    return invalid()
  const items = resultPage.items.map((value): OwnedMediaResource => {
    const resource = object(value, [
      'id',
      'sourceId',
      'path',
      'name',
      'size',
      'modifiedAt',
      'recognitionStatus',
      'nameCandidate',
    ])
    if (
      !id(resource.id) ||
      resource.sourceId !== sourceId ||
      !path(resource.path) ||
      resource.path === '/' ||
      typeof resource.name !== 'string' ||
      resource.name !== resource.path.slice(resource.path.lastIndexOf('/') + 1) ||
      !(resource.size === null || count(resource.size)) ||
      !(resource.modifiedAt === null || timestamp(resource.modifiedAt)) ||
      resource.recognitionStatus !== 'unidentified'
    )
      return invalid()
    return {
      ...resource,
      nameCandidate: readNameCandidate(resource.nameCandidate),
    } as unknown as OwnedMediaResource
  })
  if (
    new Set(items.map((item) => item.id)).size !== items.length ||
    new Set(items.map((item) => item.path)).size !== items.length
  )
    return invalid()
  return { items, total: resultPage.total, page, pageSize }
}
