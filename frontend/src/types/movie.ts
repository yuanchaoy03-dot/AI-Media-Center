/** 当前片库普通电影卡的展示数据，不是完整 Movie Domain Model。 */
export interface LibraryMovie {
  id: string
  title: string
  year: number
  genreLabel: string
  posterUrl: string
}
