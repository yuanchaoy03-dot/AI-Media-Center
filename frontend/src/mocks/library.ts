import type { LibraryMovie } from '../types/movie'

// 仅供 Frontend Mock 验收；不代表真实登录用户拥有这些影片。
// 摘自 HTML library-mock 的普通卡；正式接入后 posterUrl 使用 API 返回的 OSS 地址。
export const mockLibraryMovies: LibraryMovie[] = [
  {
    "id": "movie-interstellar",
    "title": "星际穿越",
    "year": 2014,
    "genreLabel": "科幻",
    "posterUrl": "/mock/posters/tmdb-poster-interstellar.jpg",
    "favorite": true,
    "watchStatus": "watching"
  },
  {
    "id": "movie-dune",
    "title": "沙丘",
    "year": 2021,
    "genreLabel": "科幻",
    "posterUrl": "/mock/posters/tmdb-poster-dune.jpg",
    "favorite": false,
    "watchStatus": "watched"
  },
  {
    "id": "movie-dune-part-two",
    "title": "沙丘2",
    "year": 2024,
    "genreLabel": "科幻",
    "posterUrl": "/mock/posters/tmdb-poster-dune-part-two.jpg",
    "favorite": false,
    "watchStatus": "unwatched"
  },
  {
    "id": "movie-blade-runner-2049",
    "title": "银翼杀手2049",
    "year": 2017,
    "genreLabel": "科幻",
    "posterUrl": "/mock/posters/tmdb-poster-blade-runner-2049.jpg",
    "favorite": true,
    "watchStatus": "watching"
  },
  {
    "id": "movie-arrival",
    "title": "降临",
    "year": 2016,
    "genreLabel": "科幻",
    "posterUrl": "/mock/posters/tmdb-poster-arrival.jpg",
    "favorite": true,
    "watchStatus": "watching"
  },
  {
    "id": "movie-oppenheimer",
    "title": "奥本海默",
    "year": 2023,
    "genreLabel": "剧情",
    "posterUrl": "/mock/posters/tmdb-poster-oppenheimer.jpg",
    "favorite": false,
    "watchStatus": "watching"
  },
  {
    "id": "movie-the-batman",
    "title": "新蝙蝠侠",
    "year": 2022,
    "genreLabel": "悬疑",
    "posterUrl": "/mock/posters/tmdb-poster-the-batman.jpg",
    "favorite": false,
    "watchStatus": "watched"
  },
  {
    "id": "movie-inception",
    "title": "盗梦空间",
    "year": 2010,
    "genreLabel": "科幻",
    "posterUrl": "/mock/posters/tmdb-poster-inception.jpg",
    "favorite": true,
    "watchStatus": "watching"
  }
]
