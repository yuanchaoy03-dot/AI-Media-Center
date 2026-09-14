import type { LibraryCollection } from '../types/collection'

export const mockCollections: LibraryCollection[] = [{
  id: 'collection-dune',
  title: '沙丘系列',
  posterUrl: '/mock/posters/tmdb-collection-poster-dune.jpg',
  // 原型未提供官方合集背景，沿用本地成员电影的背景作为演示 fallback。
  backdropUrl: '/mock/backdrops/tmdb-backdrop-dune.jpg',
  memberMovieIds: ['movie-dune', 'movie-dune-part-two'],
}]
