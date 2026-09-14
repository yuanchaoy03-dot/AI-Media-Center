import type { LibraryMovie } from './movie'

/** 公共系列关联，不包含合集级收藏或观看状态。 */
export interface LibraryCollection {
  id: string
  title: string
  posterUrl: string
  backdropUrl: string | null
  memberMovieIds: string[]
}

export type LibraryItem =
  | { type: 'movie'; movie: LibraryMovie }
  | { type: 'collection'; collection: LibraryCollection; movieCount: number }
