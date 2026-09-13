<script setup lang="ts">
import MovieCard from '../components/media/MovieCard.vue'
import { mockLibraryMovies } from '../mocks/library'

// 临时开发验收入口；仅记录意图，不代表已导航、播放或打开菜单。
function recordIntent(action: 'detail' | 'play' | 'more', movieId: string) {
  if (import.meta.env.DEV) console.info('[Library Mock intent]', action, movieId)
}
</script>

<template>
  <section class="library-content" lang="zh-CN" aria-labelledby="library-title">
    <header class="movie-page-heading"><h1 id="library-title" class="page-title">电影</h1></header>
    <!-- Toolbar 下一阶段迁移；当前不制造占位操作。 -->
    <div class="movie-grid" aria-label="电影片库">
      <MovieCard v-for="movie in mockLibraryMovies" :key="movie.id" :movie="movie"
        @detail="recordIntent('detail', $event)" @play="recordIntent('play', $event)"
        @more="recordIntent('more', $event.movieId)" />
    </div>
  </section>
</template>

<style scoped>
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
