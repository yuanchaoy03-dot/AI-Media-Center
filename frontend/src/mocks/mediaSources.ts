import type { MediaSource, MediaScanRoot, ScanTask } from '../types/mediaSource'

// 来自 HTML 原型的五个来源。仅演示本人数据，不是新用户默认片库。
export const mockMediaSources: MediaSource[] = [
  { id: 'source-home-nas', name: '家庭 NAS', address: 'https://nas.example.com/dav', status: 'available', lastScan: '8 分钟前' },
  { id: 'source-alist', name: 'AList · 迅雷云盘', address: 'https://alist.example.com/dav', status: 'available', lastScan: '23 分钟前' },
  { id: 'source-nextcloud', name: '我的 Nextcloud', address: 'https://cloud.example.com/remote.php/dav/files/lin', status: 'error', lastScan: '昨天', connectionError: '服务暂时不可达，请检查地址或稍后重试。' },
  { id: 'source-new', name: '新连接 · 私人云盘', address: 'https://new.example.com/dav', status: 'available', lastScan: '尚未扫描' },
  { id: 'source-ready', name: '纪录片收藏', address: 'https://archive.example.com/dav', status: 'available', lastScan: '尚未扫描' },
].map(source => ({ ...source, type: 'WebDAV', lastConnection: '今天 11:32' }) as MediaSource)

export const mockScanRoots: MediaScanRoot[] = [
  { id: 'root-nas-movies', sourceId: 'source-home-nas', path: '/Movies', enabled: true },
  { id: 'root-nas-4k', sourceId: 'source-home-nas', path: '/电影/4K', enabled: true },
  { id: 'root-alist', sourceId: 'source-alist', path: '/Movies', enabled: true },
  { id: 'root-nextcloud', sourceId: 'source-nextcloud', path: '/Cinema', enabled: true },
  { id: 'root-ready', sourceId: 'source-ready', path: '/Movies/纪录片', enabled: true },
]

export const mockDirectories: Record<string, string[]> = {
  '/': ['Movies', 'TV', 'Downloads', '电影', 'Cinema'],
  '/Movies': ['电影', '动画', '纪录片'], '/电影': ['4K'], '/TV': ['剧集'],
  '/Downloads': [], '/Cinema': [], '/Movies/电影': [], '/Movies/动画': [],
  '/Movies/纪录片': [], '/电影/4K': [], '/TV/剧集': [],
}

export const mockScanTasks: ScanTask[] = [
  { id: 'scan_20260903_1032', sourceId: 'source-home-nas', status: 'completed', time: '8 分钟前', rootPaths: ['/Movies'], recognizedMovieIds: ['movie-dune', 'movie-interstellar', 'movie-dune-part-two', 'movie-the-batman', 'movie-mad-max-fury-road', 'movie-blade-runner-2049'], pendingCount: 3, attentionCount: 2 },
  { id: 'scan-alist', sourceId: 'source-alist', status: 'completed', time: '23 分钟前', rootPaths: ['/Movies'], recognizedMovieIds: [], pendingCount: 0, attentionCount: 0 },
  { id: 'scan-nextcloud', sourceId: 'source-nextcloud', status: 'completed', time: '昨天', rootPaths: ['/Cinema'], recognizedMovieIds: ['movie-oppenheimer'], pendingCount: 0, attentionCount: 0 },
]
