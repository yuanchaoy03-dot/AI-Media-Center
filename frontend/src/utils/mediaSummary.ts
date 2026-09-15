import type { MediaSummaryResource } from '../types/movieDetail'

const positive = (n: number | undefined): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0
export function mediaSummary(resource: MediaSummaryResource | null): string[][] {
  if (!resource) return []
  const video = resource.video ?? {}
  const size = positive(resource.sizeBytes) ? resource.sizeBytes >= 1e9 ? `${(resource.sizeBytes / 1e9).toFixed(1)} GB` : `${(resource.sizeBytes / 1e6).toFixed(1)} MB` : ''
  const codecs: Record<string, string> = { hevc:'HEVC', h265:'HEVC', 'h.265':'HEVC', avc:'H.264', h264:'H.264', 'h.264':'H.264', av1:'AV1' }
  const codec = video.codec ? codecs[video.codec.toLowerCase()] ?? video.codec : ''
  const resolution = positive(video.width) && positive(video.height)
    ? video.width >= 3800 && video.height >= 2100 ? '4K' : video.width >= 1900 && video.height >= 1000 ? '1080p' : video.width >= 1200 && video.height >= 700 ? '720p' : `${video.width}×${video.height}` : ''
  const hdr = [...new Set((video.hdrFormats ?? []).filter(Boolean).map(value => value === 'Dolby Vision' ? 'DV' : value))].join(' / ')
  const tracks = (resource.audioTracks ?? []).filter(track => track.codec.trim())
  const order = ['TrueHD Atmos','TrueHD','DTS-HD MA','DTS-HD','E-AC-3 Atmos','E-AC-3','DTS','AC-3','AAC']
  const rank = (track: typeof tracks[number]) => { const i = order.indexOf(track.atmos && ['TrueHD','E-AC-3'].includes(track.codec) ? `${track.codec} Atmos` : track.codec); return i < 0 ? order.length : i }
  const audio = tracks.find(track => track.isDefault) ?? [...tracks].sort((a,b) => rank(a)-rank(b))[0]
  return [
    [size, codec, [resolution,hdr].filter(Boolean).join(' ') || resource.quality || '', audio ? [audio.codec,audio.channels,audio.atmos ? 'Atmos' : ''].filter(Boolean).join(' ') : ''],
    [positive(video.bitrate) ? video.bitrate < 1e5 ? '<0.1 Mbps' : `${(video.bitrate/1e6).toFixed(1)} Mbps` : '', positive(video.frameRate) ? `${video.frameRate} fps` : '', positive(video.bitDepth) ? `${video.bitDepth}-bit` : ''],
  ].map(row => row.filter(Boolean))
}
