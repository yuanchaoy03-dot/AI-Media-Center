<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, useId, watch } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import movieIcons from '../assets/movie-icons.svg?url&no-inline'
import LibraryToolbar from '../components/media/LibraryToolbar.vue'
import CollectionCard from '../components/media/CollectionCard.vue'
import { aggregateLibraryMovies, getLibraryCollections } from '../services/collectionService'
import type { LibraryCollection, LibraryItem } from '../types/collection'
import MovieCard from '../components/media/MovieCard.vue'
import MovieContextMenu from '../components/media/MovieContextMenu.vue'
import MovieCardSkeleton from '../components/media/MovieCardSkeleton.vue'
import { getLibraryMovies, getLibrarySources } from '../services/movieService'
import type { LibraryFilters, LibraryMovie, LibrarySourceOption, LibrarySort, LibraryYear, WatchStatus } from '../types/movie'

// 每次进入页面初始化副本；刷新恢复 Mock，不修改共享常量。
const movies = ref<LibraryMovie[]>([])
const collections = ref<LibraryCollection[]>([])
const router = useRouter()
function openCollection(id: string) { void router.push({ name: 'collection-detail', params: { collectionId: id } }) }
const sources = ref<LibrarySourceOption[]>([])
const loading = ref(true)
// 预留追加请求状态；当前不触发分页或无限滚动。
const loadingMore = ref(false)
onMounted(async () => {
  const [libraryMovies, librarySources, libraryCollections] = await Promise.all([getLibraryMovies(), getLibrarySources(), getLibraryCollections()])
  collections.value = libraryCollections
  movies.value = libraryMovies
  sources.value = librarySources
  loading.value = false
})
const activeMovieId = ref<string | null>(null)
const activeCollection = computed(() => collections.value.find(item => item.id === activeMovieId.value))
const activeTrigger = shallowRef<HTMLButtonElement | null>(null)
const menuOpen = ref(false)
const menuId = `movie-context-menu-${useId()}`
const activeMovie = computed(() => movies.value.find(movie => movie.id === activeMovieId.value))
const announcement = ref('')

const route = useRoute()
const baseGenres = ['科幻', '剧情', '动作', '悬疑', '动画', '喜剧', '恐怖', '纪录片']
const genreOptions = ref([...baseGenres])
function defaultFilters(): LibraryFilters {
  return { genres: [], sourceIds: [], year: 'all', status: 'all' }
}
const filters = ref<LibraryFilters>(defaultFilters())
const sort = ref<LibrarySort>('added')
let routeGenreSelection: string[] | undefined
// 承接原型首页 genre 链接；忽略未知类型，不修改路由配置。
watch([() => route.query.genre, () => loading.value], ([value], [previousValue]) => {
  const genre = typeof value === 'string' ? value : ''
  const known = baseGenres.includes(genre) || movies.value.some(movie => movie.genres.includes(genre))
  genreOptions.value = known && !baseGenres.includes(genre) ? [...baseGenres, genre] : [...baseGenres]
  // 加载完成只补全尚未被用户修改的 URL 初始类型；URL 变化仍正常应用。
  if (value === previousValue && routeGenreSelection && filters.value.genres !== routeGenreSelection) return
  filters.value = { ...filters.value, genres: known ? [genre] : [] }
  routeGenreSelection = filters.value.genres
}, { immediate: true })
function matchesYear(year: number, bucket: LibraryYear) {
  if (bucket === 'all') return true
  if (bucket === '2020') return year >= 2020
  if (bucket === 'older') return year < 1990
  return year >= Number(bucket) && year < Number(bucket) + 10
}
const visibleMovies = computed(() => {
  const selected = filters.value
  const result = movies.value.filter(movie =>
    (!selected.genres.length || selected.genres.some(genre => movie.genres.includes(genre)))
    && (!selected.sourceIds.length || selected.sourceIds.some(id => movie.sourceIds.includes(id)))
    && (selected.status === 'all' || movie.watchStatus === selected.status)
    && matchesYear(movie.year, selected.year))
  return result.sort((a, b) => {
    switch (sort.value) {
      case 'title': return a.title.localeCompare(b.title, 'zh-CN')
      case 'year': return b.year - a.year
      case 'watched': return (b.lastPlayedAt ?? 0) - (a.lastPlayedAt ?? 0)
      case 'duration': return b.runtimeMinutes - a.runtimeMinutes
      default: return b.addedAt - a.addedAt
    }
  })
})
const libraryItems = computed<LibraryItem[]>(() => {
  const selected = filters.value
  const filtered = selected.genres.length || selected.sourceIds.length || selected.year !== 'all' || selected.status !== 'all'
  return filtered ? visibleMovies.value.map(movie => ({ type: 'movie', movie })) : aggregateLibraryMovies(visibleMovies.value, collections.value)
})
function clearFilters() { filters.value = defaultFilters() }
watch(libraryItems, result => {
  if (!result.some(item => (item.type === 'movie' ? item.movie.id : item.collection.id) === activeMovieId.value)) {
    menuOpen.value = false
    activeMovieId.value = null
    activeTrigger.value = null
  }
})

function openMenu({ movieId, trigger }: { movieId: string; trigger: HTMLButtonElement }) {
  // 同一个 … 再次点击：关闭菜单
  if (menuOpen.value && activeMovieId.value === movieId && activeTrigger.value === trigger) {
    menuOpen.value = false
    return
  }
  // 不同电影或首次打开：直接设置（Vue watch 会处理定位更新）
  activeMovieId.value = movieId
  activeTrigger.value = trigger
  menuOpen.value = true
}
function changeFavorite(movieId: string, next: boolean) {
  const movie = movies.value.find(movie => movie.id === movieId)
  if (!movie) return
  movie.favorite = next
  announcement.value = `《${movie.title}》${next ? '已加入收藏' : '已取消收藏'}`
}
function changeWatchStatus(movieId: string, next: WatchStatus) {
  const movie = movies.value.find(movie => movie.id === movieId)
  if (!movie) return
  movie.watchStatus = next
  announcement.value = `《${movie.title}》已标记为${next === 'watched' ? '已看' : '未看'}`
}
// 详情进入正式页面；播放与版本选择仍为 Mock 占位。
function recordIntent(action: 'detail' | 'play' | 'versions', movieId: string) {
  if (action === 'detail') { void router.push({ name: 'movie-detail', params: { movieId } }); return }
  if (import.meta.env.DEV) console.info('[Library Mock intent]', action, movieId)
}
</script>

<template>
  <section class="library-content" lang="zh-CN" aria-labelledby="library-title">
    <header class="movie-page-heading"><h1 id="library-title" class="page-title">电影</h1></header>
    <LibraryToolbar v-model:filters="filters" v-model:sort="sort"
      :genre-options="genreOptions" :source-options="sources" @clear-filters="clearFilters" />
    <div v-if="loading" class="movie-grid" aria-label="电影片库" aria-busy="true">
      <MovieCardSkeleton v-for="index in 12" :key="index" />
    </div>
    <div v-else-if="visibleMovies.length || loadingMore" class="movie-grid" aria-label="电影片库" :aria-busy="loadingMore">
      <template v-for="item in libraryItems" :key="item.type === 'movie' ? item.movie.id : item.collection.id">
        <CollectionCard v-if="item.type === 'collection'" :collection="item.collection" :movie-count="item.movieCount"
          :menu-id="menuId" :more-expanded="menuOpen && activeMovieId === item.collection.id"
          @detail="openCollection" @more="openMenu({ movieId: $event.collectionId, trigger: $event.trigger })" />
        <MovieCard v-else :movie="item.movie" :menu-id="menuId" :more-expanded="menuOpen && activeMovieId === item.movie.id"
          @detail="recordIntent('detail', $event)" @play="recordIntent('play', $event)" @more="openMenu" />
      </template>
      <template v-if="loadingMore">
        <MovieCardSkeleton v-for="index in 6" :key="`loading-more-${index}`" />
      </template>
    </div>
    <section v-else class="library-state">
      <span class="state-icon"><svg viewBox="0 0 256 256" aria-hidden="true"><template v-if="movies.length"><path d="M230.6,49.53A15.81,15.81,0,0,0,216,40H40A16,16,0,0,0,28.19,66.78L96,141.32V216a8,8,0,0,0,12.29,6.75l32-20A8,8,0,0,0,144,196V141.32l67.81-74.54A15.81,15.81,0,0,0,230.6,49.53ZM130.08,132.58A8,8,0,0,0,128,138v53.57l-16,10V138a8,8,0,0,0-2.08-5.42L40,56H216Z"/></template><use v-else :href="`${movieIcons}#ph-film-slate`" /></svg></span>
      <strong>{{ movies.length ? '没有符合条件的电影' : '还没有电影' }}</strong>
      <p>{{ movies.length ? '尝试调整筛选条件' : '新账号默认没有公共片库。添加 WebDAV 媒体来源后，影片会出现在这里。' }}</p>
      <button v-if="movies.length" class="state-action" type="button" @click="clearFilters">清除筛选</button>
      <RouterLink v-else class="state-action" to="/media-sources">添加 WebDAV 来源</RouterLink>
    </section>
    <MovieContextMenu :id="menuId" :open="menuOpen" :trigger="activeTrigger"
      :movie-id="activeMovieId ?? ''" :title="activeMovie?.title ?? activeCollection?.title ?? ''" :collection="!!activeCollection"
      :favorite="activeMovie?.favorite ?? false" :watch-status="activeMovie?.watchStatus ?? 'unwatched'"
      @close="menuOpen = false" @favorite-change="changeFavorite" @watch-status-change="changeWatchStatus"
      @play="recordIntent('play', $event)" @detail="activeCollection ? openCollection($event) : recordIntent('detail', $event)"
      @versions="recordIntent('versions', $event)" />
    <p class="sr-only" role="status">{{ loading ? '正在加载片库' : loadingMore ? '正在加载更多电影' : announcement }}</p>
  </section>
</template>

<style scoped>
.state-icon{display:grid;place-items:center;width:44px;height:44px;margin-bottom:13px;border-radius:var(--radius-circle);background:rgba(255,255,255,.055);color:var(--icon-default)}
.state-icon svg{width:22px;height:22px;fill:currentColor}
.library-state{display:grid;justify-items:center;width:100%;padding:72px 20px;color:#a1a1a6;text-align:center}
.library-state strong{color:#f5f5f7;font-size:16px;font-weight:600}
.library-state p{margin-top:4px;color:rgba(255,255,255,.46);font-size:13px}
.state-action{min-height:34px;margin-top:16px;padding:0 12px;border:1px solid rgba(255,255,255,.1);border-radius:10px;background:rgba(255,255,255,.055);color:rgba(255,255,255,.92);font-size:13px}
.state-action:hover{background:rgba(255,255,255,.08)}
.state-action { font-family: inherit; cursor: pointer; text-decoration: none; }
.library-state p { margin: 4px 0 0; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
.library-content {
  /* Shell 已提供 32px / 40px padding，仅补原型内容区差额。 */
  padding-top: 4px;
  padding-bottom: 44px;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'PingFang SC', 'Segoe UI', sans-serif;
  font-size: 15px;
  line-height: 1.45;
  -webkit-font-smoothing: antialiased;
  font-synthesis: weight style small-caps;
  text-rendering: auto;
}
.movie-page-heading { display: flex; align-items: baseline; margin-bottom: 22px; }
.page-title {
  margin: 0;
  font: 700 clamp(30px, 2vw, 32px)/1.12 -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'PingFang SC', 'Segoe UI', sans-serif;
  letter-spacing: -.032em;
}
.movie-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(clamp(150px, 9vw, 170px), 1fr)); gap: 20px; width: 100%; align-items: start; }
@media (max-width: 900px) {
  .library-content { margin-top: -4px; margin-inline: -12px; padding-top: 0; }
}
@media (max-width: 680px) {
  .library-content { margin-inline: -22px; }
  .movie-page-heading { margin-bottom: 18px; }
  .movie-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px 16px; }
}
@media (max-width: 420px) {
  .movie-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
