import { mockLibraryMovies, mockLibrarySources } from '../mocks/library'
import type { LibraryMovie, LibrarySourceOption } from '../types/movie'
import { mockSearchMetadata } from '../mocks/search'

// 本地演示数据入口；接入 Spring Boot 时在此替换数据获取实现。
export async function getLibraryMovies(): Promise<LibraryMovie[]> {
  await new Promise<void>(resolve => setTimeout(resolve, 350))
  // 每次请求返回独立副本，个人状态修改不污染共享 Mock。
  return mockLibraryMovies.map(movie => ({
    ...movie, genres: [...movie.genres], sourceIds: [...movie.sourceIds],
  }))
}

export async function getLibrarySources(): Promise<LibrarySourceOption[]> {
  return mockLibrarySources.map(source => ({ ...source }))
}

export async function searchLibraryMovies(query: string): Promise<Array<LibraryMovie & { rating?: string }>> {
  const movies = (await getLibraryMovies()).map(movie => ({ ...movie, rating: mockSearchMetadata[movie.id]?.rating }))
  const keyword = query.trim().toLocaleLowerCase()
  if (!keyword) return movies.sort((a, b) => b.addedAt - a.addedAt).slice(0, 5)
  return movies.filter(movie => {
    const metadata = mockSearchMetadata[movie.id]
    return [movie.title, movie.year, ...movie.genres, metadata?.originalTitle ?? '', ...(metadata?.people ?? [])]
      .join(' ').toLocaleLowerCase().includes(keyword)
  })
}
