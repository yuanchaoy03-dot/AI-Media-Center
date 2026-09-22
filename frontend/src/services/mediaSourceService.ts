import { reactive, readonly } from 'vue'
import { mockDirectories, mockMediaSources, mockScanRoots, mockScanTasks } from '../mocks/mediaSources'
import type { DirectoryEntry, MediaSource, SourceConnectionInput, ScanTask } from '../types/mediaSource'

// 同一应用会话内共享；刷新恢复 fixture。不存储凭据或使用浏览器 storage。
const state = reactive({
  sources: structuredClone(mockMediaSources),
  roots: structuredClone(mockScanRoots),
  tasks: structuredClone(mockScanTasks),
})
export const mediaSourceState = readonly(state)
const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))
const scanTimers = new Map<string, ReturnType<typeof setTimeout>>()

function requireSource(id: string) {
  const source = state.sources.find(item => item.id === id)
  if (!source) throw new Error('未找到这个媒体来源。')
  return source
}

export function validateEndpoint(address: string): string {
  try {
    const url = new URL(address)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error()
    return url.href
  } catch {
    throw new Error('请输入 HTTP(S) WebDAV 地址；凭据请填在独立字段，不要放入地址。')
  }
}

function connectionFails(address: string) {
  const host = new URL(address).hostname
  return host.includes('offline') || host === 'cloud.example.com'
}

export async function testConnectionInput(input: SourceConnectionInput): Promise<boolean> {
  const address = validateEndpoint(input.address)
  await delay(850)
  return !connectionFails(address)
}

export async function testSourceConnection(id: string): Promise<void> {
  const source = requireSource(id)
  if (source.status === 'testing') return
  const address = source.address
  source.status = 'testing'
  await delay(650)
  if (!state.sources.includes(source) || source.address !== address) return
  source.status = connectionFails(address) ? 'error' : 'available'
  source.connectionError = source.status === 'error' ? '服务暂时不可达，请检查地址或稍后重试。' : undefined
  source.lastConnection = '刚刚'
}

export async function saveSource(input: SourceConnectionInput, id?: string): Promise<string> {
  if (!input.name.trim()) throw new Error('请填写来源名称。')
  const address = validateEndpoint(input.address)
  if (connectionFails(address)) throw new Error('连接失败（演示）：请检查地址后重试。')
  await delay(250)
  const values = { name: input.name.trim(), address, status: 'available' as const, lastConnection: '刚刚', connectionError: undefined }
  if (id) Object.assign(requireSource(id), values)
  else {
    id = `source-${crypto.randomUUID()}`
    state.sources.push({ ...values, id, type: 'WebDAV', lastScan: '尚未扫描' })
  }
  return id
}

export function removeSource(id: string): void {
  requireSource(id)
  clearTimeout(scanTimers.get(id))
  scanTimers.delete(id)
  state.sources = state.sources.filter(source => source.id !== id)
  state.roots = state.roots.filter(root => root.sourceId !== id)
  state.tasks = state.tasks.filter(task => task.sourceId !== id)
}

export function browseDirectory(id: string, path: string): DirectoryEntry[] {
  if (requireSource(id).status !== 'available') throw new Error('请先检查来源连接。')
  const children = mockDirectories[path]
  if (!Object.hasOwn(mockDirectories, path) || !children) throw new Error('目录不存在，请返回上一级。')
  return children.map(name => ({ name, path: `${path === '/' ? '' : path}/${name}`, kind: 'directory' }))
}

export function addScanRoots(id: string, paths: string[]): void {
  // 先验证整批再写入，浏览与保存均不会创建任务或资源。
  for (const path of paths) browseDirectory(id, path)
  for (const path of new Set(paths)) {
    if (!state.roots.some(root => root.sourceId === id && root.path === path)) {
      state.roots.push({ id: `root-${crypto.randomUUID()}`, sourceId: id, path, enabled: true })
    }
  }
}

export function setRootEnabled(sourceId: string, rootId: string, enabled: boolean): void {
  requireSource(sourceId)
  const root = state.roots.find(item => item.id === rootId && item.sourceId === sourceId)
  if (!root) throw new Error('扫描目录已移除。')
  root.enabled = enabled
}

export function removeScanRoot(sourceId: string, rootId: string): void {
  requireSource(sourceId)
  state.roots = state.roots.filter(root => root.id !== rootId || root.sourceId !== sourceId)
}

export function scanLabel(source: MediaSource): string {
  if (source.status !== 'available') return '检查连接'
  const roots = state.roots.filter(root => root.sourceId === source.id)
  if (!roots.length) return '选择扫描目录'
  if (!roots.some(root => root.enabled)) return '启用扫描目录'
  if (state.tasks.some(task => task.sourceId === source.id && task.status === 'running')) return '查看扫描'
  return '立即扫描'
}

export function startScan(id: string): string {
  const source = requireSource(id)
  if (source.status !== 'available') throw new Error('请先检查来源连接。')
  const rootPaths = state.roots.filter(root => root.sourceId === id && root.enabled).map(root => root.path)
  if (!rootPaths.length) throw new Error('请先选择并启用扫描目录。')
  const running = state.tasks.find(task => task.sourceId === id && task.status === 'running')
  if (running) return running.id
  const task: ScanTask = { id: `scan-${crypto.randomUUID()}`, sourceId: id, rootPaths: Object.freeze(rootPaths), status: 'running', time: '刚刚', recognizedMovieIds: [], pendingCount: 0, attentionCount: 0 }
  state.tasks.unshift(task)
  source.lastScan = '扫描中'
  scanTimers.set(id, setTimeout(() => {
    const current = state.tasks.find(item => item.id === task.id)
    if (!current) return
    // 示例执行只验证所选范围；不伪造发现文件或入库结果。
    current.status = source.status === 'error' ? 'failed' : 'completed'
    current.error = current.status === 'failed' ? '来源连接中断，本次扫描未完成。' : undefined
    source.lastScan = current.status === 'failed' ? '扫描未完成' : '刚刚'
    scanTimers.delete(id)
  }, 4000))
  return task.id
}
