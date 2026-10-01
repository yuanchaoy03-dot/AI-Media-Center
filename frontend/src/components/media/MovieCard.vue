<script setup lang="ts">
import { ref, watch } from 'vue'
import movieIcons from '../../assets/movie-icons.svg?url&no-inline'
import type { LibraryMovie } from '../../types/movie'

// 父页面通过 props 给卡片数据；withDefaults 为没传的可选属性补默认值。
// defineEmits 声明卡片向父页面发出的事件，卡片只通知点击意图，由父页面处理跳转或播放。
const props = withDefaults(
  defineProps<{ movie: LibraryMovie; moreExpanded?: boolean; menuId?: string }>(),
  { moreExpanded: false },
)
const emit = defineEmits<{
  detail: [movieId: string]
  play: [movieId: string]
  more: [payload: { movieId: string; trigger: HTMLButtonElement }]
}>()
const imageFailed = ref(false)
// 卡片换了电影或海报地址时，重新尝试显示图片，不沿用上一张海报的失败状态。
watch(
  () => [props.movie.id, props.movie.posterUrl],
  () => {
    imageFailed.value = false
  },
)

function requestMore(event: MouseEvent) {
  if (event.currentTarget instanceof HTMLButtonElement) {
    emit('more', { movieId: props.movie.id, trigger: event.currentTarget })
  }
}
</script>

<template>
  <article class="movie-card">
    <div class="poster-art" :data-fallback="movie.title">
      <img
        v-if="movie.posterUrl && !imageFailed"
        :key="movie.posterUrl"
        :src="movie.posterUrl"
        :alt="`${movie.title}电影海报`"
        @error="imageFailed = true"
      />
      <button
        class="poster-detail-hit"
        type="button"
        :aria-label="`查看${movie.title}详情`"
        @click="emit('detail', movie.id)"
      />
      <button
        class="play-mark"
        type="button"
        :aria-label="`播放${movie.title}`"
        @click="emit('play', movie.id)"
      >
        <svg viewBox="0 0 256 256" aria-hidden="true" focusable="false">
          <use :href="`${movieIcons}#ph-play-fill`" />
        </svg>
      </button>
      <button
        class="poster-more-mark"
        type="button"
        :aria-label="`${movie.title}更多操作`"
        :aria-expanded="moreExpanded"
        :aria-controls="menuId"
        @click="requestMore"
      >
        <svg viewBox="0 0 256 256" aria-hidden="true" focusable="false">
          <use :href="`${movieIcons}#ph-dots-three-bold`" />
        </svg>
      </button>
    </div>
    <div class="poster-copy">
      <strong class="poster-title" :title="movie.title">{{ movie.title }}</strong>
      <span class="poster-meta">{{ movie.year }} · {{ movie.genreLabel }}</span>
    </div>
  </article>
</template>

<style scoped src="../../assets/poster-card.css"></style>
