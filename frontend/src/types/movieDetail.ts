import type { LibraryMovie } from './movie'

export interface MediaSummaryResource {
  filename: string
  quality?: string
  sizeBytes?: number
  container?: string
  video?: { codec?: string; width?: number; height?: number; bitDepth?: number; hdrFormats?: string[]; bitrate?: number; frameRate?: number }
  audioTracks?: Array<{ codec: string; channels?: string; atmos?: boolean; isDefault?: boolean; language?: string }>
  subtitleTracks?: Array<{ codec: string; language?: string }>
}
export interface MovieDetailMetadata {
  originalTitle: string
  overview: string
  certification?: string
  cast: Array<{ name: string; role: string; portrait?: string }>
  /** 独立横版背景图；缺失时不使用竖版 posterUrl 替代。 */
  backdropUrl?: string
  rating?: string
  sourceId: string
  sourceName: string
  resource: MediaSummaryResource | null
}
export interface MovieDetail {
  movie: LibraryMovie
  metadata: MovieDetailMetadata
}
