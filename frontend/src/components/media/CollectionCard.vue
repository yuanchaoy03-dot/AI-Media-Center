<script setup lang="ts">
import { ref, watch } from 'vue'
import movieIcons from '../../assets/movie-icons.svg?url&no-inline'
import type { LibraryCollection } from '../../types/collection'

const props = withDefaults(defineProps<{ collection: LibraryCollection; movieCount: number; moreExpanded?: boolean; menuId?: string }>(), { moreExpanded: false })
const emit = defineEmits<{
  detail: [collectionId: string]
  more: [payload: { collectionId: string; trigger: HTMLButtonElement }]
}>()
const imageFailed = ref(false)
watch(() => [props.collection.id, props.collection.posterUrl], () => { imageFailed.value = false })

function requestMore(event: MouseEvent) {
  if (event.currentTarget instanceof HTMLButtonElement) {
    emit('more', { collectionId: props.collection.id, trigger: event.currentTarget })
  }
}
</script>

<template>
  <article class="movie-card collection-card">
    <div class="poster-art" :data-fallback="collection.title">
      <img v-if="collection.posterUrl && !imageFailed" :key="collection.posterUrl" :src="collection.posterUrl"
        :alt="`${collection.title}合集海报`" @error="imageFailed = true" />
      <button class="poster-detail-hit" type="button" :aria-label="`查看${collection.title}合集`"
        @click="emit('detail', collection.id)" />
      <button class="series-mark" type="button" :aria-label="`查看${collection.title}合集`" @click="emit('detail', collection.id)">
        <svg viewBox="0 0 256 256" aria-hidden="true" focusable="false"><use :href="`${movieIcons}#ph-caret-right`" /></svg>
      </button>
      <button class="poster-more-mark" type="button" :aria-label="`${collection.title}更多操作`"
        :aria-expanded="moreExpanded" :aria-controls="menuId" @click="requestMore">
        <svg viewBox="0 0 256 256" aria-hidden="true" focusable="false"><use :href="`${movieIcons}#ph-dots-three-bold`" /></svg>
      </button>
    </div>
    <div class="poster-copy">
      <strong class="poster-title" :title="collection.title">{{ collection.title }}</strong>
      <span class="poster-meta">{{ movieCount }} 部电影</span>
    </div>
  </article>
</template>

<style scoped>
.movie-card {
  --poster-text-primary: rgba(255, 255, 255, .92);
  --poster-text-secondary: rgba(255, 255, 255, .62);
  min-width: 0;
}
.poster-art {
  position: relative;
  aspect-ratio: 2 / 3;
  overflow: hidden;
  border-radius: 10px;
  background: #1c1c1e;
  box-shadow: 0 8px 22px color-mix(in oklch, #0a0a0b 46%, transparent);
}
.poster-art > img { display: block; width: 100%; height: 100%; border-radius: inherit; object-fit: cover; }
.poster-art::after {
  content: ''; position: absolute; inset: 0; z-index: 2; border-radius: inherit;
  background: rgba(0, 0, 0, .38); opacity: 0; pointer-events: none;
  transition: opacity var(--motion-fast) var(--motion-ease);
}
.poster-art:not(:has(img))::before {
  content: attr(data-fallback); position: absolute; inset: 0; display: grid;
  place-items: center; padding: 12px; color: var(--poster-text-secondary);
  text-align: center; font-size: 13px; overflow-wrap: anywhere;
}
button { padding: 0; font: inherit; cursor: pointer; }
button:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px; }
.poster-detail-hit { position: absolute; inset: 0; z-index: 1; width: 100%; border: 0; border-radius: inherit; background: transparent; }
.poster-detail-hit:focus-visible { outline-offset: -3px; }
.poster-copy { display: grid; grid-template-rows: 16px 15px; gap: 2px; height: 41px; padding-top: 8px; }
.poster-title, .poster-meta { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.poster-title { color: var(--poster-text-primary); font-size: 13px; font-weight: 500; line-height: 16px; }
.poster-meta { color: var(--poster-text-secondary); font-size: 12px; font-weight: 400; line-height: 15px; }
.series-mark, .poster-more-mark {
  position: absolute; z-index: 5; display: grid; place-items: center;
  width: 30px; height: 30px; bottom: 12px; border: 1px solid rgba(255, 255, 255, .16);
  border-radius: 50%; opacity: 0;
  box-shadow: 0 5px 16px rgba(0, 0, 0, .22), inset 0 1px 0 rgba(255, 255, 255, .1);
  -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px);
  transition: opacity var(--motion-fast) var(--motion-ease), background-color var(--motion-fast) var(--motion-ease), color var(--motion-fast) var(--motion-ease);
}
.series-mark { left: 10px; background: rgba(246, 246, 246, .74); color: #111113; }
.poster-more-mark { right: 10px; background: rgba(246, 246, 246, .20); color: rgba(245, 245, 247, .94); }
svg { display: block; max-width: 100%; fill: currentColor; }
.series-mark svg { width: 13px; height: 13px; }
.poster-more-mark svg { width: 15px; height: 15px; }
@media (hover: hover) {
  .movie-card:hover .poster-art::after { opacity: 1; }
  .movie-card:hover .series-mark { opacity: 1; background: rgba(245, 245, 247, .9); }
  .movie-card:hover .poster-more-mark { opacity: 1; background: rgba(245, 245, 247, .24); }
}
/* 键盘聚焦任一入口时一起显示控制，避免不可见焦点。 */
.movie-card:has(:focus-visible) .poster-art::after { opacity: 1; }
.movie-card:has(:focus-visible) .series-mark { opacity: 1; background: rgba(245, 245, 247, .9); }
.movie-card:has(:focus-visible) .poster-more-mark { opacity: 1; background: rgba(245, 245, 247, .24); }
/* 原型已有的菜单打开态；不改变卡片其他视觉。 */
.movie-card .poster-more-mark[aria-expanded="true"] { opacity: 1; background: rgba(245, 245, 247, .28); }
@media (prefers-reduced-motion: reduce) {
  .poster-art::after, .series-mark, .poster-more-mark { transition: none; }
}
/* 材质由页面显式偏好控制，不跟随系统透明度设置。 */
:global(html[data-transparency='reduced']) .poster-more-mark { background: var(--color-surface-2); -webkit-backdrop-filter: none; backdrop-filter: none; }
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .poster-more-mark { background: var(--color-surface-2); }
}
:global(html[data-transparency='reduced']) .series-mark { background: #f6f6f6; -webkit-backdrop-filter: none; backdrop-filter: none; }
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .series-mark { background: #f6f6f6; }
}
</style>
