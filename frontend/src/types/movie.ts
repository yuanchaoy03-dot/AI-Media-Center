export type WatchStatus = 'unwatched' | 'watching' | 'watched'

/** 当前片库普通电影卡的展示数据，不是完整 Movie Domain Model。 */
export interface LibraryMovie {
  id: string
  title: string
  year: number
  genreLabel: string
  genres: string[]
  sourceIds: string[]
  /** 固定 Mock 毫秒时间戳；没有播放记录时为 null。 */
  addedAt: number
  lastPlayedAt: number | null
  /** 影片标准时长，非资源实测时长。 */
  runtimeMinutes: number
  posterUrl: string
  /** 当前用户的个人状态，不属于公共 Movie 元数据。 */
  favorite: boolean
  watchStatus: WatchStatus
}

export type LibraryYear = 'all' | '2020' | '2010' | '2000' | '1990' | 'older'
export type LibrarySort = 'added' | 'title' | 'year' | 'watched' | 'duration'
export interface LibraryFilters {
  genres: string[]
  sourceIds: string[]
  year: LibraryYear
  status: 'all' | WatchStatus
}
export interface LibrarySourceOption {
  id: string
  name: string
}
