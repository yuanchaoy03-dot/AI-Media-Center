import type { LibraryMovie, LibrarySourceOption } from '../types/movie'

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
    "watchStatus": "watching",
    "genres": [
      "科幻",
      "剧情",
      "冒险"
    ],
    "sourceIds": [
      "source-home-nas"
    ],
    "addedAt": 1757980800000,
    "lastPlayedAt": 1760572800000,
    "runtimeMinutes": 169
  },
  {
    "id": "movie-dune",
    "title": "沙丘",
    "year": 2021,
    "genreLabel": "科幻",
    "posterUrl": "/mock/posters/tmdb-poster-dune.jpg",
    "favorite": false,
    "watchStatus": "watched",
    "genres": [
      "科幻",
      "冒险"
    ],
    "sourceIds": [
      "source-home-nas"
    ],
    "addedAt": 1757894400000,
    "lastPlayedAt": 1760400000000,
    "runtimeMinutes": 155
  },
  {
    "id": "movie-dune-part-two",
    "title": "沙丘2",
    "year": 2024,
    "genreLabel": "科幻",
    "posterUrl": "/mock/posters/tmdb-poster-dune-part-two.jpg",
    "favorite": false,
    "watchStatus": "unwatched",
    "genres": [
      "科幻",
      "冒险"
    ],
    "sourceIds": [
      "source-home-nas"
    ],
    "addedAt": 1757376000000,
    "lastPlayedAt": null,
    "runtimeMinutes": 166
  },
  {
    "id": "movie-blade-runner-2049",
    "title": "银翼杀手2049",
    "year": 2017,
    "genreLabel": "科幻",
    "posterUrl": "/mock/posters/tmdb-poster-blade-runner-2049.jpg",
    "favorite": true,
    "watchStatus": "watching",
    "genres": [
      "科幻",
      "剧情"
    ],
    "sourceIds": [
      "source-home-nas"
    ],
    "addedAt": 1757808000000,
    "lastPlayedAt": 1760313600000,
    "runtimeMinutes": 164
  },
  {
    "id": "movie-arrival",
    "title": "降临",
    "year": 2016,
    "genreLabel": "科幻",
    "posterUrl": "/mock/posters/tmdb-poster-arrival.jpg",
    "favorite": true,
    "watchStatus": "watching",
    "genres": [
      "剧情",
      "科幻",
      "悬疑"
    ],
    "sourceIds": [
      "source-alist"
    ],
    "addedAt": 1757721600000,
    "lastPlayedAt": 1760227200000,
    "runtimeMinutes": 116
  },
  {
    "id": "movie-oppenheimer",
    "title": "奥本海默",
    "year": 2023,
    "genreLabel": "剧情",
    "posterUrl": "/mock/posters/tmdb-poster-oppenheimer.jpg",
    "favorite": false,
    "watchStatus": "watching",
    "genres": [
      "剧情",
      "历史"
    ],
    "sourceIds": [
      "source-nextcloud"
    ],
    "addedAt": 1757635200000,
    "lastPlayedAt": 1760486400000,
    "runtimeMinutes": 181
  },
  {
    "id": "movie-the-batman",
    "title": "新蝙蝠侠",
    "year": 2022,
    "genreLabel": "悬疑",
    "posterUrl": "/mock/posters/tmdb-poster-the-batman.jpg",
    "favorite": false,
    "watchStatus": "watched",
    "genres": [
      "犯罪",
      "悬疑",
      "剧情"
    ],
    "sourceIds": [
      "source-home-nas"
    ],
    "addedAt": 1757548800000,
    "lastPlayedAt": 1760140800000,
    "runtimeMinutes": 176
  },
  {
    "id": "movie-inception",
    "title": "盗梦空间",
    "year": 2010,
    "genreLabel": "科幻",
    "posterUrl": "/mock/posters/tmdb-poster-inception.jpg",
    "favorite": true,
    "watchStatus": "watching",
    "genres": [
      "动作",
      "科幻",
      "冒险"
    ],
    "sourceIds": [
      "source-alist"
    ],
    "addedAt": 1757462400000,
    "lastPlayedAt": 1760054400000,
    "runtimeMinutes": 148
  },
  {
    "id": "movie-prisoners",
    "title": "囚徒",
    "year": 2013,
    "genreLabel": "悬疑",
    "posterUrl": "/mock/posters/tmdb-poster-prisoners.jpg",
    "favorite": false,
    "watchStatus": "watching",
    "genres": [
      "剧情",
      "悬疑",
      "犯罪"
    ],
    "sourceIds": [
      "source-alist"
    ],
    "addedAt": 1757289600000,
    "lastPlayedAt": 1759968000000,
    "runtimeMinutes": 153
  },
  {
    "id": "movie-1917",
    "title": "1917",
    "year": 2019,
    "genreLabel": "剧情",
    "posterUrl": "/mock/posters/tmdb-poster-1917.jpg",
    "favorite": false,
    "watchStatus": "watched",
    "genres": [
      "战争",
      "剧情"
    ],
    "sourceIds": [
      "source-nextcloud"
    ],
    "addedAt": 1757203200000,
    "lastPlayedAt": 1759881600000,
    "runtimeMinutes": 119
  },
  {
    "id": "movie-mad-max-fury-road",
    "title": "疯狂的麦克斯4：狂暴之路",
    "year": 2015,
    "genreLabel": "动作",
    "posterUrl": "/mock/posters/tmdb-poster-mad-max-fury-road.jpg",
    "favorite": true,
    "watchStatus": "unwatched",
    "genres": [
      "动作",
      "冒险",
      "科幻"
    ],
    "sourceIds": [
      "source-home-nas"
    ],
    "addedAt": 1757116800000,
    "lastPlayedAt": null,
    "runtimeMinutes": 120
  },
  {
    "id": "movie-parasite",
    "title": "寄生虫",
    "year": 2019,
    "genreLabel": "剧情",
    "posterUrl": "/mock/posters/tmdb-poster-parasite.jpg",
    "favorite": true,
    "watchStatus": "watched",
    "genres": [
      "剧情",
      "悬疑"
    ],
    "sourceIds": [
      "source-nextcloud"
    ],
    "addedAt": 1757030400000,
    "lastPlayedAt": 1759795200000,
    "runtimeMinutes": 133
  },
  {
    "id": "movie-whiplash",
    "title": "爆裂鼓手",
    "year": 2014,
    "genreLabel": "剧情",
    "posterUrl": "/mock/posters/tmdb-poster-whiplash.jpg",
    "favorite": false,
    "watchStatus": "unwatched",
    "genres": [
      "剧情",
      "音乐"
    ],
    "sourceIds": [
      "source-alist"
    ],
    "addedAt": 1756944000000,
    "lastPlayedAt": null,
    "runtimeMinutes": 107
  },
  {
    "id": "movie-gone-girl",
    "title": "消失的爱人",
    "year": 2014,
    "genreLabel": "悬疑",
    "posterUrl": "/mock/posters/tmdb-poster-gone-girl.jpg",
    "favorite": false,
    "watchStatus": "watched",
    "genres": [
      "剧情",
      "悬疑"
    ],
    "sourceIds": [
      "source-alist"
    ],
    "addedAt": 1756857600000,
    "lastPlayedAt": 1759708800000,
    "runtimeMinutes": 149
  },
  {
    "id": "movie-ex-machina",
    "title": "机械姬",
    "year": 2015,
    "genreLabel": "科幻",
    "posterUrl": "/mock/posters/tmdb-poster-ex-machina.jpg",
    "favorite": true,
    "watchStatus": "unwatched",
    "genres": [
      "科幻",
      "悬疑",
      "剧情"
    ],
    "sourceIds": [
      "source-alist"
    ],
    "addedAt": 1756771200000,
    "lastPlayedAt": null,
    "runtimeMinutes": 108
  }
]

// 当前演示用户自己的 WebDAV 来源实例；不包含连接地址或凭据。
export const mockLibrarySources: LibrarySourceOption[] = [
  { id: 'source-alist', name: 'AList · 迅雷云盘' },
  { id: 'source-home-nas', name: '家庭 NAS' },
  { id: 'source-nextcloud', name: '我的 Nextcloud' },
]
