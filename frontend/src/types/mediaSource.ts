// 来源连接状态和扫描任务状态分开：能连接不等于已经扫描，扫描完成也不保证文件可播放。
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
  // ? 表示字段可省略，没有连接错误时不一定有这条信息。
  connectionError?: string
}

/** 递归包含全部后代；同一来源下路径互不包含，与 enabled 无关。 */
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

/** 仅表单输入；凭据不会进入展示模型或浏览器持久化。 */
export interface SourceConnectionInput {
  name: string
  address: string
  username: string
  password: string
}
