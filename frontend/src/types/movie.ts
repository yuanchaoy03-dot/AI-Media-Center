export type WatchStatus = 'unwatched' | 'watching' | 'watched'

/** 当前片库普通电影卡的展示数据，不是完整 Movie Domain Model。 */
export interface LibraryMovie {
  id: string
  title: string
  year: number
  genreLabel: string
  posterUrl: string
  /** 当前用户的个人状态，不属于公共 Movie 元数据。 */
  favorite: boolean
  watchStatus: WatchStatus
}
