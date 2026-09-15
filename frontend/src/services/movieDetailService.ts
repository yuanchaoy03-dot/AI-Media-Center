import { getLibraryMovies } from './movieService'
import { mockMovieDetails } from '../mocks/movieDetails'
import type { MovieDetail } from '../types/movieDetail'

export async function getMovieDetail(id: string): Promise<MovieDetail | null> {
  // 先确认本人片库关联，不能通过公共元数据直接构造个人详情。
  const movie = (await getLibraryMovies()).find(item => item.id === id)
  if (!movie) return null
  const metadata = structuredClone(mockMovieDetails[id] ?? {
    originalTitle: '', overview: '', cast: [], sourceId: '', sourceName: '未知来源', resource: null,
  })
  if (!movie.sourceIds.includes(metadata.sourceId)) {
    metadata.resource = null
    metadata.sourceName = '未知来源'
  }
  return { movie, metadata }
}
