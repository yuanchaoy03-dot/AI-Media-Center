export type ConnectionState = 'available' | 'error' | 'testing'
export type ScanState = 'pending' | 'running' | 'completed' | 'failed'

/** 展示模型，不包含密码、认证 Header 或扫描路径。 */
export interface MediaSource {
  id: string
  name: string
  type: 'WebDAV'
  address: string
  status: ConnectionState
  lastConnection: string
  lastScan: string
  connectionError?: string
}

export interface MediaScanRoot {
  id: string
  sourceId: string
  path: string
  enabled: boolean
}

export interface DirectoryEntry {
  name: string
  path: string
  kind: 'directory' | 'file'
}

export interface ScanTask {
  id: string
  sourceId: string
  status: ScanState
  time: string
  /** 启动时复制；后续目录配置变化不修改本次范围。 */
  rootPaths: readonly string[]
  recognizedMovieIds: readonly string[]
  pendingCount: number
  attentionCount: number
  error?: string
}

/** 仅表单输入；凭据不会进入 MediaSource 或持久化。 */
export interface SourceConnectionInput {
  name: string
  address: string
  username: string
  password: string
}
