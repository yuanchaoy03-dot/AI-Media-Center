import { mockCollections } from '../mocks/collections'
import type { LibraryCollection, LibraryItem } from '../types/collection'
import type { LibraryMovie } from '../types/movie'

export async function getLibraryCollections(): Promise<LibraryCollection[]> {
  return mockCollections.map(collection => ({ ...collection, memberMovieIds: [...collection.memberMovieIds] }))
}

export function getOwnedCollectionMembers(collection: LibraryCollection, movies: LibraryMovie[]): LibraryMovie[] {
  return collection.memberMovieIds.flatMap(id => movies.filter(movie => movie.id === id))
}

// 输入为已排序的本人电影；首个成员决定合集位置，不构造合集观看状态。
export function aggregateLibraryMovies(movies: LibraryMovie[], collections: LibraryCollection[]): LibraryItem[] {
  const shown = new Set<string>()
  return movies.flatMap<LibraryItem>(movie => {
    const collection = collections.find(item => item.memberMovieIds.includes(movie.id))
    const count = collection ? getOwnedCollectionMembers(collection, movies).length : 0
    if (!collection || count < 2) return [{ type: 'movie', movie }]
    if (shown.has(collection.id)) return []
    shown.add(collection.id)
    return [{ type: 'collection', collection, movieCount: count }]
  })
}
