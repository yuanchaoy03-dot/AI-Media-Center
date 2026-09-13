<script setup lang="ts">
import { computed, ref, shallowRef, useId } from 'vue'
import MovieCard from '../components/media/MovieCard.vue'
import MovieContextMenu from '../components/media/MovieContextMenu.vue'
import { mockLibraryMovies } from '../mocks/library'
import type { WatchStatus } from '../types/movie'

// 每次进入页面初始化副本；刷新恢复 Mock，不修改共享常量。
const movies = ref(mockLibraryMovies.map(movie => ({ ...movie })))
const activeMovieId = ref<string | null>(null)
const activeTrigger = shallowRef<HTMLButtonElement | null>(null)
const menuOpen = ref(false)
const menuId = `movie-context-menu-${useId()}`
const activeMovie = computed(() => movies.value.find(movie => movie.id === activeMovieId.value))
const announcement = ref('')

function openMenu({ movieId, trigger }: { movieId: string; trigger: HTMLButtonElement }) {
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
// 临时开发验收入口；仅记录意图，不代表已导航、播放或打开媒体版本。
function recordIntent(action: 'detail' | 'play' | 'versions', movieId: string) {
  if (import.meta.env.DEV) console.info('[Library Mock intent]', action, movieId)
}
</script>

<template>
  <section class="library-content" lang="zh-CN" aria-labelledby="library-title">
    <header class="movie-page-heading"><h1 id="library-title" class="page-title">电影</h1></header>
    <!-- Toolbar 下一阶段迁移；当前不制造占位操作。 -->
    <div class="movie-grid" aria-label="电影片库">
      <MovieCard v-for="movie in movies" :key="movie.id" :movie="movie"
        :menu-id="menuId" :more-expanded="menuOpen && activeMovieId === movie.id"
        @detail="recordIntent('detail', $event)" @play="recordIntent('play', $event)"
        @more="openMenu" />
    </div>
    <MovieContextMenu :id="menuId" :open="menuOpen" :trigger="activeTrigger"
      :movie-id="activeMovie?.id ?? ''" :title="activeMovie?.title ?? ''"
      :favorite="activeMovie?.favorite ?? false" :watch-status="activeMovie?.watchStatus ?? 'unwatched'"
      @close="menuOpen = false" @favorite-change="changeFavorite" @watch-status-change="changeWatchStatus"
      @play="recordIntent('play', $event)" @detail="recordIntent('detail', $event)"
      @versions="recordIntent('versions', $event)" />
    <p class="sr-only" aria-live="polite">{{ announcement }}</p>
  </section>
</template>

<style scoped>
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
